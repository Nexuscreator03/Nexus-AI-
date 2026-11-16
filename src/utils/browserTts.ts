import { AiVoiceId, AiVoiceOption, AI_VOICE_OPTIONS } from '../types/chat';

let globalStopHandler: (() => void) | null = null;
let sharedAudioCtx: AudioContext | null = null;
let activeBufferSource: AudioBufferSourceNode | null = null;
let sharedAudioEl: HTMLAudioElement | null = null;
let sharedAudioBlobUrl: string | null = null;

// 1-sample silent WAV to synchronously unlock HTMLAudioElement inside user tap/click
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  return sharedAudioCtx;
}

function getOrCreateSharedAudioEl(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!sharedAudioEl) {
    sharedAudioEl = new Audio();
    sharedAudioEl.preload = 'auto';
    sharedAudioEl.setAttribute('playsinline', 'true');
  }
  return sharedAudioEl;
}

export function unlockAudioContextSync() {
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      const silent = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch {}

  // Also synchronously unlock a reusable HTMLAudioElement on user gesture for mobile/iframe fallback
  try {
    const el = getOrCreateSharedAudioEl();
    if (el && el.paused) {
      el.muted = true;
      el.src = SILENT_WAV_DATA_URI;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          if (el.src === SILENT_WAV_DATA_URI) {
            el.pause();
            el.currentTime = 0;
          }
          el.muted = false;
        }).catch(() => {
          el.muted = false;
        });
      } else {
        el.muted = false;
      }
    }
  } catch {}
}

export function stopActiveWebAudio() {
  if (activeBufferSource) {
    try {
      activeBufferSource.onended = null;
      activeBufferSource.stop(0);
      activeBufferSource.disconnect();
    } catch {}
    activeBufferSource = null;
  }
  if (sharedAudioEl) {
    try {
      sharedAudioEl.onended = null;
      sharedAudioEl.onerror = null;
      sharedAudioEl.pause();
      sharedAudioEl.removeAttribute('src');
    } catch {}
  }
  if (sharedAudioBlobUrl) {
    revokePlayableUrl(sharedAudioBlobUrl);
    sharedAudioBlobUrl = null;
  }
}

export async function playAudioBase64ViaContext(
  audioBase64: string,
  options: {
    mimeType?: string;
    isCancelled: () => boolean;
    onEnded: () => void;
    onError: () => void;
  }
): Promise<boolean> {
  // 1. Try Web Audio API (fastest, zero autoplay drift once context is running)
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await Promise.race([
          ctx.resume().catch(() => {}),
          new Promise<void>((r) => setTimeout(r, 450)),
        ]);
      }
      if (options.isCancelled()) return false;

      if (ctx.state === 'running') {
        const cleanB64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
        const binary = atob(cleanB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0));
        if (options.isCancelled()) return false;

        stopActiveWebAudio();
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.connect(ctx.destination);
        activeBufferSource = source;

        source.onended = () => {
          if (activeBufferSource === source) {
            activeBufferSource = null;
          }
          if (!options.isCancelled()) {
            options.onEnded();
          }
        };

        source.start(0);
        return true;
      }
    }
  } catch {}

  // 2. Fallback to synchronously primed shared HTMLAudioElement
  try {
    if (options.isCancelled()) return false;
    const el = getOrCreateSharedAudioEl();
    if (!el) return false;

    stopActiveWebAudio();
    const { url, isBlob } = base64ToPlayableUrl(audioBase64, options.mimeType || 'audio/wav');
    if (isBlob) sharedAudioBlobUrl = url;

    el.muted = false;
    el.volume = 1;
    el.src = url;
    el.onended = () => {
      if (sharedAudioBlobUrl === url) {
        revokePlayableUrl(url);
        sharedAudioBlobUrl = null;
      }
      if (!options.isCancelled()) options.onEnded();
    };
    el.onerror = () => {
      if (sharedAudioBlobUrl === url) {
        revokePlayableUrl(url);
        sharedAudioBlobUrl = null;
      }
      if (!options.isCancelled()) options.onError();
    };

    await el.play();
    if (options.isCancelled()) {
      stopActiveWebAudio();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function registerGlobalTtsStop(fn: (() => void) | null) {
  globalStopHandler = fn;
}

export function stopGlobalTts() {
  if (globalStopHandler) {
    const fn = globalStopHandler;
    globalStopHandler = null;
    fn();
  }
  stopActiveWebAudio();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

interface CachedTtsEntry {
  audioBase64: string;
  mimeType: string;
  cleanSpeechText: string;
}

const clientTtsCache = new Map<string, CachedTtsEntry>();

export function getCachedClientTts(voiceId: AiVoiceId, rawText: string): CachedTtsEntry | null {
  const key = `${voiceId}:${rawText.slice(0, 600)}:${rawText.length}`;
  return clientTtsCache.get(key) || null;
}

export function setCachedClientTts(voiceId: AiVoiceId, rawText: string, entry: CachedTtsEntry) {
  const key = `${voiceId}:${rawText.slice(0, 600)}:${rawText.length}`;
  if (clientTtsCache.size >= 32) {
    const oldest = clientTtsCache.keys().next().value;
    if (oldest) clientTtsCache.delete(oldest);
  }
  clientTtsCache.set(key, entry);
}

export function getVoiceMeta(voiceId?: AiVoiceId): AiVoiceOption {
  return AI_VOICE_OPTIONS.find((v) => v.id === voiceId) || AI_VOICE_OPTIONS[0];
}

export function getVoicePreviewSampleText(voiceId: AiVoiceId): string {
  const meta = getVoiceMeta(voiceId);
  return `Olá! Eu sou ${meta.label}, a voz ${meta.genderLabel.toLowerCase()} do Nexus AI.`;
}

export function base64ToPlayableUrl(audioBase64: string, mimeType = 'audio/wav'): { url: string; isBlob: boolean } {
  try {
    const cleanB64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const binary = atob(cleanB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
    return { url: URL.createObjectURL(blob), isBlob: true };
  } catch {
    return { url: `data:${mimeType || 'audio/wav'};base64,${audioBase64}`, isBlob: false };
  }
}

export function revokePlayableUrl(url: string | null | undefined) {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
}

export async function prefetchVoicePreviews(): Promise<boolean> {
  try {
    const res = await fetch('/api/tts/previews');
    if (!res.ok) return false;
    const data = await res.json();
    const previews = data?.previews || {};
    for (const [voiceId, item] of Object.entries<any>(previews)) {
      if (!item?.audioBase64 || !item?.sampleText) continue;
      setCachedClientTts(voiceId as AiVoiceId, item.sampleText, {
        audioBase64: item.audioBase64,
        mimeType: item.mimeType || 'audio/wav',
        cleanSpeechText: item.sampleText,
      });
    }
    return Boolean(data?.complete);
  } catch {
    return false;
  }
}

export function splitIntoSpeechChunks(text: string, maxLen = 175): string[] {
  const sentences = text
    .split(/(?<=[.!?…:;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const words = sentence.split(/\s+/);
      let part = '';
      for (const word of words) {
        if ((part + ' ' + word).trim().length > maxLen) {
          if (part) chunks.push(part);
          part = word;
        } else {
          part = (part + ' ' + word).trim();
        }
      }
      if (part) chunks.push(part);
      continue;
    }

    if ((current + ' ' + sentence).trim().length <= maxLen) {
      current = (current + ' ' + sentence).trim();
    } else {
      if (current) chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

export function getAvailableBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    let resolved = false;
    const handleVoices = () => {
      if (resolved) return;
      resolved = true;
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoices);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
        resolve(window.speechSynthesis.getVoices());
      }
    }, 350);
  });
}

export function pickDistinctPortugueseVoice(
  voices: SpeechSynthesisVoice[],
  voiceId: AiVoiceId
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const ptBrVoices = voices.filter(
    (v) => v.lang.toLowerCase() === 'pt-br' || v.lang.toLowerCase().startsWith('pt_br')
  );
  const ptAnyVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'));
  const pool = ptBrVoices.length > 0 ? ptBrVoices : ptAnyVoices;
  if (pool.length === 0) return null;

  const femaleHints = ['francisca', 'thalita', 'luciana', 'maria', 'raquel', 'fernanda', 'vitória', 'vitoria', 'helena', 'ines', 'female', 'mulher', 'google português do brasil', 'google portugues do brasil'];
  const maleHints = ['antonio', 'antônio', 'felipe', 'daniel', 'ricardo', 'rodrigo', 'duarte', 'tiago', 'fabio', 'fábio', 'male', 'homem'];

  const isMaleVoice = voiceId === 'Charon' || voiceId === 'Fenrir';
  const targetHints = isMaleVoice ? maleHints : femaleHints;
  const oppositeHints = isMaleVoice ? femaleHints : maleHints;

  const scored = pool.map((v, idx) => {
    const lower = v.name.toLowerCase();
    let score = v.lang.toLowerCase().includes('br') ? 15 : 0;
    for (let i = 0; i < targetHints.length; i++) {
      if (lower.includes(targetHints[i])) score += 60 - i;
    }
    for (const opp of oppositeHints) {
      if (lower.includes(opp)) score -= 45;
    }
    // Local OS voices honor pitch adjustments reliably compared to remote Google TTS voices
    if (v.localService) score += 12;
    return { voice: v, score, idx };
  });

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);

  // Pick a second distinct voice for Aura / Orion when multiple voices are available
  const prefersSecondVoice = voiceId === 'Zephyr' || voiceId === 'Fenrir';
  if (prefersSecondVoice && scored.length > 1) {
    const second = scored.find((s) => s.voice.name !== scored[0].voice.name);
    if (second && second.score >= scored[0].score - 45) {
      return second.voice;
    }
  }

  // If browser only has one single non-local Google female voice and user wants male (Atlas/Orion), check if another pt voice exists
  if (isMaleVoice && scored[0] && !scored[0].voice.localService && scored[0].voice.name.toLowerCase().includes('google') && scored.length > 1) {
    const alt = scored.find((s) => s.voice.localService || !s.voice.name.toLowerCase().includes('google'));
    if (alt) return alt.voice;
  }

  return scored[0]?.voice || pool[0];
}

export function getDistinctBrowserSpeechParams(voiceId: AiVoiceId): { pitch: number; rate: number } {
  switch (voiceId) {
    case 'Kore':
      return { pitch: 1.06, rate: 1.02 };
    case 'Zephyr':
      return { pitch: 1.32, rate: 1.08 };
    case 'Charon':
      return { pitch: 0.58, rate: 0.93 };
    case 'Fenrir':
      return { pitch: 0.78, rate: 1.06 };
    default:
      return { pitch: 1.05, rate: 1.02 };
  }
}

export async function speakWithDistinctBrowserVoice(opts: {
  text: string;
  voiceId: AiVoiceId;
  isCancelled: () => boolean;
  onStart: () => void;
  onEnd: () => void;
  onError: () => void;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !opts.text.trim()) {
    return false;
  }

  const voices = await getAvailableBrowserVoices();
  if (opts.isCancelled()) return false;

  const chosenVoice = pickDistinctPortugueseVoice(voices, opts.voiceId);
  const { pitch, rate } = getDistinctBrowserSpeechParams(opts.voiceId);
  const chunks = splitIntoSpeechChunks(opts.text, 175);

  opts.onStart();

  let chunkIdx = 0;
  const speakNext = () => {
    if (opts.isCancelled() || chunkIdx >= chunks.length) {
      opts.onEnd();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[chunkIdx]);
    utterance.lang = chosenVoice?.lang || 'pt-BR';
    utterance.rate = rate;
    utterance.pitch = pitch;
    if (chosenVoice) utterance.voice = chosenVoice;

    utterance.onend = () => {
      if (opts.isCancelled()) return;
      chunkIdx++;
      speakNext();
    };
    utterance.onerror = (ev: SpeechSynthesisErrorEvent) => {
      if (opts.isCancelled() || ev?.error === 'interrupted' || ev?.error === 'canceled') {
        return;
      }
      opts.onError();
    };

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.speak(utterance);
  };

  window.speechSynthesis.cancel();
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
  speakNext();
  return true;
}
