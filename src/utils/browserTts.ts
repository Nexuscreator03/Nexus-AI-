import { AiVoiceId, AiVoiceOption, AI_VOICE_OPTIONS } from '../types/chat';

let globalStopHandler: (() => void) | null = null;

export function registerGlobalTtsStop(fn: (() => void) | null) {
  globalStopHandler = fn;
}

export function stopGlobalTts() {
  if (globalStopHandler) {
    const fn = globalStopHandler;
    globalStopHandler = null;
    fn();
  }
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
    const second = scored[1];
    if (second.score >= scored[0].score - 35) {
      return second.voice;
    }
  }

  return scored[0]?.voice || pool[0];
}

export function getDistinctBrowserSpeechParams(voiceId: AiVoiceId): { pitch: number; rate: number } {
  switch (voiceId) {
    case 'Kore':
      return { pitch: 1.06, rate: 1.02 };
    case 'Zephyr':
      return { pitch: 1.28, rate: 1.08 };
    case 'Charon':
      return { pitch: 0.62, rate: 0.94 };
    case 'Fenrir':
      return { pitch: 0.80, rate: 1.07 };
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

    window.speechSynthesis.speak(utterance);
  };

  window.speechSynthesis.cancel();
  speakNext();
  return true;
}
