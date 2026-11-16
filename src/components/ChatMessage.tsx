import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Copy,
  Check,
  Volume2,
  VolumeX,
  AlertTriangle,
  RotateCcw,
  Clock,
  FileText,
  FileCode,
  Maximize2,
  X,
  ThumbsUp,
  ThumbsDown,
  Mic,
  Loader2,
  Pencil,
  Scissors,
} from 'lucide-react';
import { Message, ThemeMode, Attachment, AiVoiceId, Reminder } from '../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GroundingSources } from './GroundingSources';
import { CyberGearLogo } from './CyberGearLogo';
import { cyberAudio } from '../utils/audio';
import { getThemeColors } from '../utils/themeStyles';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  base64ToPlayableUrl,
  getCachedClientTts,
  getVoiceMeta,
  playAudioBase64ViaContext,
  registerGlobalTtsStop,
  revokePlayableUrl,
  setCachedClientTts,
  speakWithDistinctBrowserVoice,
  stopActiveWebAudio,
  stopGlobalTts,
  unlockAudioContextSync,
} from '../utils/browserTts';

interface ChatMessageProps {
  message: Message;
  onRetry?: () => void;
  onRegenerate?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onFeedback?: (messageId: string, feedback: 'like' | 'dislike' | null) => void;
  onPollVote?: (question: string, option: string) => void;
  onAddReminder?: (input: { title: string; dueAt?: number | null; notes?: string }) => void;
  reminders?: Reminder[];
  isBusy?: boolean;
  isStreaming?: boolean;
  textSize?: 'small' | 'medium' | 'large';
  voiceName?: AiVoiceId;
  theme?: ThemeMode;
}

function cleanSpeechClientFallback(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' Código exibido na tela. ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s)]+/g, '')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^>\s*(\[!.*?\]\s*)?/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\|/g, ', ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  onRetry,
  onRegenerate,
  onEditMessage,
  onFeedback,
  onPollVote,
  onAddReminder,
  reminders = [],
  isBusy = false,
  isStreaming = false,
  textSize = 'medium',
  voiceName = 'Kore',
  theme = 'cyber',
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [copiedSelection, setCopiedSelection] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const colors = getThemeColors(theme);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const speechRequestIdRef = useRef(0);
  const contentBoxRef = useRef<HTMLDivElement>(null);

  const checkLocalSelection = () => {
    if (typeof window === 'undefined' || !contentBoxRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectedSnippet('');
      return;
    }
    const text = sel.toString().trim();
    if (!text) {
      setSelectedSnippet('');
      return;
    }
    const anchorInBox = sel.anchorNode && contentBoxRef.current.contains(sel.anchorNode);
    const focusInBox = sel.focusNode && contentBoxRef.current.contains(sel.focusNode);
    if (anchorInBox || focusInBox) {
      setSelectedSnippet(text);
    } else {
      setSelectedSnippet('');
    }
  };

  useEffect(() => {
    const handleSelChange = () => {
      checkLocalSelection();
    };
    document.addEventListener('selectionchange', handleSelChange);
    return () => document.removeEventListener('selectionchange', handleSelChange);
  }, []);

  const stopAllSpeech = () => {
    speechRequestIdRef.current += 1;
    if (speechAbortRef.current) {
      speechAbortRef.current.abort();
      speechAbortRef.current = null;
    }
    stopActiveWebAudio();
    if (audioElRef.current) {
      audioElRef.current.onended = null;
      audioElRef.current.onerror = null;
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    revokePlayableUrl(audioBlobUrlRef.current);
    audioBlobUrlRef.current = null;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsLoadingVoice(false);
  };

  useEffect(() => {
    stopAllSpeech();
  }, [voiceName]);

  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, []);

  const handleCopy = async () => {
    cyberAudio.playCopy();
    const ok = await copyTextToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySelection = async () => {
    if (!selectedSnippet) return;
    cyberAudio.playCopy();
    const ok = await copyTextToClipboard(selectedSnippet);
    if (ok) {
      setCopiedSelection(true);
      setTimeout(() => setCopiedSelection(false), 1800);
    }
  };

  const playBase64Audio = async (
    audioBase64: string,
    mimeType: string,
    reqId: number
  ): Promise<boolean> => {
    if (speechRequestIdRef.current !== reqId) return false;

    const playedViaCtx = await playAudioBase64ViaContext(audioBase64, {
      mimeType,
      isCancelled: () => speechRequestIdRef.current !== reqId,
      onEnded: () => {
        if (speechRequestIdRef.current === reqId) {
          setIsSpeaking(false);
          setIsLoadingVoice(false);
        }
      },
      onError: () => {
        if (speechRequestIdRef.current === reqId) {
          setIsSpeaking(false);
          setIsLoadingVoice(false);
        }
      },
    });
    if (playedViaCtx) {
      setIsLoadingVoice(false);
      setIsSpeaking(true);
      return true;
    }
    if (speechRequestIdRef.current !== reqId) return false;

    const { url, isBlob } = base64ToPlayableUrl(audioBase64, mimeType || 'audio/wav');
    if (isBlob) {
      audioBlobUrlRef.current = url;
    }
    const audio = new Audio(url);
    audioElRef.current = audio;

    const cleanup = () => {
      if (audioElRef.current === audio) {
        audioElRef.current = null;
      }
      if (audioBlobUrlRef.current === url) {
        revokePlayableUrl(url);
        audioBlobUrlRef.current = null;
      }
      if (speechRequestIdRef.current === reqId) {
        setIsSpeaking(false);
        setIsLoadingVoice(false);
      }
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;

    try {
      setIsLoadingVoice(false);
      setIsSpeaking(true);
      await audio.play();
      if (speechRequestIdRef.current !== reqId) {
        audio.pause();
        cleanup();
        return false;
      }
      return true;
    } catch {
      audio.pause();
      cleanup();
      if (speechRequestIdRef.current === reqId) {
        setIsLoadingVoice(true);
      }
      return false;
    }
  };

  const handleSpeak = async () => {
    if (isSpeaking || isLoadingVoice) {
      cyberAudio.playClick();
      stopAllSpeech();
      registerGlobalTtsStop(null);
      return;
    }

    stopGlobalTts();
    stopAllSpeech();
    unlockAudioContextSync();
    registerGlobalTtsStop(stopAllSpeech);
    const reqId = ++speechRequestIdRef.current;
    const controller = new AbortController();
    speechAbortRef.current = controller;
    setIsLoadingVoice(true);
    cyberAudio.playVoice();

    try {
      const voiceMeta = getVoiceMeta(voiceName);
      let cleanText = cleanSpeechClientFallback(message.content);

      const cachedAudio = getCachedClientTts(voiceMeta.id, message.content);
      if (cachedAudio) {
        if (speechRequestIdRef.current !== reqId) return;
        const played = await playBase64Audio(cachedAudio.audioBase64, cachedAudio.mimeType, reqId);
        if (played || speechRequestIdRef.current !== reqId) return;
      }

      // 1. Try server-side Neural TTS / cleaner first
      try {
        const ttsRes = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message.content, voiceName: voiceMeta.id }),
          signal: controller.signal,
        });

        if (speechRequestIdRef.current !== reqId) return;

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (speechRequestIdRef.current !== reqId) return;

          if (ttsData.audioBase64) {
            const mime = ttsData.mimeType || 'audio/wav';
            setCachedClientTts(voiceMeta.id, message.content, {
              audioBase64: ttsData.audioBase64,
              mimeType: mime,
              cleanSpeechText: ttsData.cleanSpeechText || cleanText,
            });
            const played = await playBase64Audio(ttsData.audioBase64, mime, reqId);
            if (played || speechRequestIdRef.current !== reqId) return;
          }

          if (ttsData.cleanSpeechText) {
            cleanText = ttsData.cleanSpeechText;
          }
        }
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError' || speechRequestIdRef.current !== reqId) return;
      }

      if (speechRequestIdRef.current !== reqId) return;
      const started = await speakWithDistinctBrowserVoice({
        text: cleanText,
        voiceId: voiceMeta.id,
        isCancelled: () => speechRequestIdRef.current !== reqId,
        onStart: () => {
          if (speechRequestIdRef.current !== reqId) return;
          setIsLoadingVoice(false);
          setIsSpeaking(true);
        },
        onEnd: () => {
          if (speechRequestIdRef.current !== reqId) return;
          setIsSpeaking(false);
          setIsLoadingVoice(false);
        },
        onError: () => {
          if (speechRequestIdRef.current !== reqId) return;
          setIsSpeaking(false);
          setIsLoadingVoice(false);
        },
      });
      if (!started && speechRequestIdRef.current === reqId) {
        setIsLoadingVoice(false);
        setIsSpeaking(false);
      }
    } catch {
      if (speechRequestIdRef.current === reqId) {
        setIsLoadingVoice(false);
        setIsSpeaking(false);
      }
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (sec?: number) => {
    if (!sec && sec !== 0) return '';
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  const renderAttachments = (attachments?: Attachment[]) => {
    if (!attachments || attachments.length === 0) return null;

    const images = attachments.filter((a) => a.type === 'image');
    const audios = attachments.filter((a) => a.type === 'audio');
    const docs = attachments.filter((a) => a.type !== 'image' && a.type !== 'audio');

    return (
      <div className="space-y-2.5 mb-2.5 w-full min-w-0">
        {/* Images Grid */}
        {images.length > 0 && (
          <div
            className={`grid gap-2 ${
              images.length === 1
                ? 'grid-cols-1'
                : images.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-3'
            }`}
          >
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => img.dataUrl && setPreviewImage(img.dataUrl)}
                className={`group/img relative rounded-xl overflow-hidden cursor-pointer border ${
                  theme === 'simple'
                    ? 'border-white/20 bg-white/5'
                    : theme === 'nebula'
                    ? 'border-purple-500/40 bg-purple-950/30'
                    : 'border-cyan-500/40 bg-cyan-950/30'
                } max-h-56 transition-all duration-200 hover:scale-[1.01]`}
              >
                {img.dataUrl ? (
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-full h-full object-cover max-h-56 block"
                  />
                ) : (
                  <div className="p-4 text-xs font-mono text-slate-400">Imagem: {img.name}</div>
                )}
                {img.dataUrl && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white backdrop-blur-[2px]">
                    <Maximize2 className="w-4 h-4" />
                    <span>Ampliar</span>
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-slate-300 truncate">
                  {img.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Voice / Audio Attachments */}
        {audios.length > 0 && (
          <div className="space-y-2 w-full min-w-0">
            {audios.map((aud) => (
              <div
                key={aud.id}
                className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-mono w-full min-w-0 ${
                  theme === 'simple'
                    ? 'bg-white/5 border-white/20 text-slate-200'
                    : theme === 'nebula'
                    ? 'bg-purple-950/50 border-purple-500/40 text-purple-200'
                    : 'bg-cyan-950/50 border-cyan-500/40 text-cyan-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 shrink-0">
                      <Mic className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate font-semibold text-[11px] sm:text-xs">
                      Mensagem de Áudio
                    </span>
                  </div>
                  {aud.durationSec !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-cyan-300 shrink-0 tabular-nums">
                      {formatDuration(aud.durationSec)}
                    </span>
                  )}
                </div>
                {aud.dataUrl ? (
                  <audio controls src={aud.dataUrl} className="w-full h-8 rounded-lg" />
                ) : (
                  <span className="text-[10px] opacity-70">Áudio processado na sessão anterior</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Documents Cards */}
        {docs.length > 0 && (
          <div className="space-y-1.5 w-full min-w-0">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-mono ${
                  theme === 'simple'
                    ? 'bg-white/5 border-white/20 text-slate-200'
                    : theme === 'nebula'
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                    : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    theme === 'simple'
                      ? 'bg-white/10 text-white'
                      : theme === 'nebula'
                      ? 'bg-purple-900/60 text-purple-300'
                      : 'bg-cyan-900/60 text-cyan-300'
                  }`}
                >
                  {doc.type === 'document' ? (
                    <FileText className="w-4 h-4" />
                  ) : (
                    <FileCode className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-[11px] sm:text-xs">{doc.name}</p>
                  <p className="text-[10px] opacity-70">
                    {doc.type === 'document' ? 'Documento / PDF' : 'Arquivo de Dados'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isUser) {
    const userBubbleClass =
      theme === 'simple'
        ? 'bg-[#181d28] border border-white/20 text-white shadow-sm'
        : theme === 'nebula'
        ? 'bg-gradient-to-br from-[#260c4d] via-[#1d093b] to-[#120426] border border-purple-500/40 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
        : 'bg-gradient-to-br from-[#0c2444] via-[#091b35] to-[#08152b] border border-cyan-500/40 text-slate-100 shadow-[0_0_15px_rgba(6,182,212,0.15)]';

    const userAvatarClass =
      theme === 'simple'
        ? 'bg-[#181d28] border border-white/25 text-white'
        : theme === 'nebula'
        ? 'bg-[#1e093b] border border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.35)] text-purple-300'
        : 'bg-[#091e38] border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)] text-cyan-300';

    const handleStartEdit = () => {
      if (isBusy) return;
      cyberAudio.playClick();
      setEditDraft(message.content);
      setIsEditing(true);
    };

    const handleSaveEdit = () => {
      const cleaned = editDraft.trim();
      if (!cleaned && (!message.attachments || message.attachments.length === 0)) return;
      cyberAudio.playClick();
      setIsEditing(false);
      onEditMessage?.(message.id, cleaned);
    };

    return (
      <div className="flex items-start justify-end gap-2.5 sm:gap-3 my-4 group animate-fadeIn w-full min-w-0">
        <div className="flex flex-col items-end max-w-[88%] sm:max-w-xl md:max-w-2xl min-w-0">
          <div className="flex items-center gap-2 mb-1 text-[11px] font-mono text-slate-400">
            {onEditMessage && !isEditing && (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleStartEdit}
                title="Editar mensagem e reenviar"
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-transparent transition-all ${
                  isBusy
                    ? 'opacity-40 cursor-not-allowed'
                    : 'opacity-75 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:text-cyan-300 hover:bg-white/5 cursor-pointer'
                }`}
              >
                <Pencil className="w-3 h-3" />
                <span>Editar</span>
              </button>
            )}
            <span>VOCÊ</span>
            <span>•</span>
            <span>{formatTime(message.timestamp)}</span>
          </div>

          <div
            className={`p-3.5 sm:p-4 rounded-2xl rounded-tr-sm leading-relaxed text-[13.5px] sm:text-[14.5px] break-words [overflow-wrap:anywhere] max-w-full min-w-0 ${userBubbleClass} ${
              isEditing ? 'w-full sm:min-w-[340px]' : ''
            }`}
          >
            {renderAttachments(message.attachments)}

            {isEditing ? (
              <div className="space-y-2.5">
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsEditing(false);
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                  }}
                  rows={3}
                  autoFocus
                  className="w-full rounded-xl bg-black/40 border border-cyan-400/50 px-3 py-2 text-[13.5px] sm:text-[14px] text-white placeholder-slate-400 focus:outline-none focus:border-cyan-300 resize-y"
                />
                <div className="flex items-center justify-end gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-2.5 py-1 rounded-lg border border-white/15 bg-black/30 text-slate-300 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={!editDraft.trim() && (!message.attachments || message.attachments.length === 0)}
                    className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold transition-colors"
                  >
                    Salvar e Enviar
                  </button>
                </div>
              </div>
            ) : (
              message.content && (
                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {message.content}
                </div>
              )
            )}
          </div>
        </div>

        <div
          className={`relative w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-xl mt-1 ${userAvatarClass}`}
        >
          <User className="w-4 h-4" />
        </div>

        {previewImage && (
          <div
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewImage}
                alt="Visualização ampliada"
                className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl border border-white/20"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Model / NEXUS AI message
  const aiAvatarClass =
    theme === 'simple'
      ? 'bg-[#181d28] border border-white/30 text-white shadow-sm'
      : theme === 'nebula'
      ? 'bg-gradient-to-b from-[#240a47] to-[#110324] border border-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.5)] text-purple-300'
      : 'bg-gradient-to-b from-[#061830] to-[#040e1f] border border-cyan-400/80 shadow-[0_0_18px_rgba(6,182,212,0.4)] text-cyan-300';

  const aiCardClass =
    theme === 'simple'
      ? 'bg-[#131722]/95 border-white/15 text-slate-100'
      : theme === 'nebula'
      ? 'bg-[#100424]/90 border-purple-500/35 shadow-[0_0_20px_rgba(168,85,247,0.15)] text-purple-100'
      : 'bg-[#050e1c]/90 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.08)] text-slate-100';

  const actionBtnClass =
    theme === 'simple'
      ? 'bg-white/5 hover:bg-white/10 border-white/20 hover:border-white/40 text-slate-200'
      : theme === 'nebula'
      ? 'bg-purple-950/40 hover:bg-purple-900/60 border-purple-500/30 hover:border-purple-400/60 text-purple-300'
      : 'bg-[#071529] hover:bg-cyan-950/70 border-cyan-500/20 hover:border-cyan-400/50 text-cyan-300';

  const actionBorderClass =
    theme === 'simple'
      ? 'border-white/10'
      : theme === 'nebula'
      ? 'border-purple-500/20'
      : 'border-cyan-500/15';

  const protocolTextClass =
    theme === 'simple'
      ? 'text-white/40'
      : theme === 'nebula'
      ? 'text-purple-400/50'
      : 'text-cyan-400/40';

  return (
    <div className="flex items-start gap-2.5 sm:gap-3.5 my-5 group animate-fadeIn w-full min-w-0">
      <div
        className={`relative w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-xl mt-1 ${aiAvatarClass}`}
      >
        <CyberGearLogo size={20} glow={theme !== 'simple'} theme={theme} />
        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${colors.dot}`} />
      </div>

      <div className="flex-1 min-w-0 max-w-full md:max-w-3xl">
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`font-bold tracking-wider flex items-center gap-1.5 ${colors.accent}`}>
              <CyberGearLogo size={13} glow={false} theme={theme} />
              NEXUS AI
            </span>
            {isStreaming && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 animate-pulse">
                Escrevendo...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-slate-500">
            {message.durationMs && (
              <span className={`flex items-center gap-1 text-[10px] ${colors.accent}`}>
                <Clock className="w-2.5 h-2.5" />
                {(message.durationMs / 1000).toFixed(1)}s
              </span>
            )}
            <span>{formatTime(message.timestamp)}</span>
          </div>
        </div>

        <div
          ref={contentBoxRef}
          onMouseUp={checkLocalSelection}
          onTouchEnd={checkLocalSelection}
          className={`relative p-3.5 sm:p-4 rounded-2xl rounded-tl-sm border min-w-0 w-full overflow-hidden select-text ${
            message.error ? 'border-red-500/50 bg-red-950/10' : aiCardClass
          }`}
        >
          {message.error ? (
            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  {message.content.includes('429') || message.content.includes('cota')
                    ? 'Aviso de Cota do Sistema Neural (429)'
                    : 'Falha na transmissão neural'}
                </span>
              </div>
              <div className="text-sm text-slate-200 leading-relaxed min-w-0">
                <MarkdownRenderer
                  content={message.content}
                  onPollVote={onPollVote}
                  isBusy={isBusy}
                  textSize={textSize}
                />
              </div>
              {onRetry && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      cyberAudio.playTab();
                      onRetry();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 hover:text-cyan-100 text-xs font-mono transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Tentar novamente agora
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <MarkdownRenderer
                content={message.content}
                onPollVote={onPollVote}
                onAddReminder={onAddReminder}
                reminders={reminders}
                isBusy={isBusy}
                isStreaming={isStreaming}
                textSize={textSize}
              />

              {!isStreaming && message.groundingSources && message.groundingSources.length > 0 && (
                <GroundingSources
                  sources={message.groundingSources}
                  queries={message.searchQueries}
                />
              )}
            </>
          )}

          {!message.error && !isStreaming && (
            <div
              className={`flex flex-wrap items-center justify-between gap-2 mt-3.5 pt-2.5 border-t ${actionBorderClass} text-xs text-slate-400 font-mono`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border transition-colors ${actionBtnClass}`}
                  title="Copiar toda a resposta"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>

                {(selectedSnippet || copiedSelection) && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleCopySelection}
                    className="flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-400/60 bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-200 transition-colors animate-fadeIn"
                    title="Copiar apenas as palavras selecionadas"
                  >
                    {copiedSelection ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Trecho copiado!</span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Copiar seleção</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleSpeak}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border transition-colors ${
                    isSpeaking || isLoadingVoice
                      ? theme === 'simple'
                        ? 'bg-white/20 border-white text-white animate-pulse'
                        : theme === 'nebula'
                        ? 'bg-purple-500/20 border-purple-400 text-purple-200 animate-pulse'
                        : 'bg-cyan-500/20 border-cyan-400 text-cyan-200 animate-pulse'
                      : actionBtnClass
                  }`}
                  title={isSpeaking ? 'Parar leitura' : 'Ouvir resposta com voz neural'}
                >
                  {isLoadingVoice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Carregando voz...</span>
                    </>
                  ) : isSpeaking ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Parar</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Ouvir</span>
                    </>
                  )}
                </button>

                {onRegenerate && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      if (isBusy) return;
                      cyberAudio.playTab();
                      onRegenerate(message.id);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded border transition-colors ${
                      isBusy ? 'opacity-40 cursor-not-allowed ' : ''
                    }${actionBtnClass}`}
                    title="Gerar outra resposta a partir deste ponto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Regenerar</span>
                  </button>
                )}

                {/* Discrete Likes / Dislikes */}
                <div className="flex items-center gap-1 border-l pl-2 ml-0.5 border-slate-700/60">
                  <button
                    onClick={() => {
                      const next = message.feedback === 'like' ? null : 'like';
                      if (next === 'like') cyberAudio.playLike();
                      else cyberAudio.playClick();
                      onFeedback?.(message.id, next);
                    }}
                    className={`p-1.5 rounded transition-all flex items-center justify-center ${
                      message.feedback === 'like'
                        ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.35)]'
                        : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 border border-transparent'
                    }`}
                    title={
                      message.feedback === 'like'
                        ? 'Avaliado positivamente'
                        : 'Gostei desta resposta'
                    }
                  >
                    <ThumbsUp
                      className={`w-3.5 h-3.5 ${message.feedback === 'like' ? 'fill-current' : ''}`}
                    />
                  </button>

                  <button
                    onClick={() => {
                      const next = message.feedback === 'dislike' ? null : 'dislike';
                      if (next === 'dislike') cyberAudio.playDislike();
                      else cyberAudio.playClick();
                      onFeedback?.(message.id, next);
                    }}
                    className={`p-1.5 rounded transition-all flex items-center justify-center ${
                      message.feedback === 'dislike'
                        ? 'text-rose-400 bg-rose-950/60 border border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.35)]'
                        : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/50 border border-transparent'
                    }`}
                    title={message.feedback === 'dislike' ? 'Avaliado negativamente' : 'Não gostei'}
                  >
                    <ThumbsDown
                      className={`w-3.5 h-3.5 ${message.feedback === 'dislike' ? 'fill-current' : ''}`}
                    />
                  </button>
                </div>
              </div>

              <span className={`text-[10px] tracking-wider hidden sm:inline ${protocolTextClass}`}>
                NEXUS PROTOCOL OK
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ChatMessage = React.memo(
  ChatMessageComponent,
  (prev, next) =>
    prev.message === next.message &&
    prev.isBusy === next.isBusy &&
    prev.isStreaming === next.isStreaming &&
    prev.textSize === next.textSize &&
    prev.voiceName === next.voiceName &&
    prev.theme === next.theme &&
    prev.reminders === next.reminders
);
