import React, { useState, useEffect } from 'react';
import {
  X,
  LogOut,
  Heart,
  ThumbsDown,
  Brain,
  Plus,
  Trash2,
  Mail,
  CheckCircle2,
  Loader2,
  User as UserIcon,
  SlidersHorizontal,
  RotateCcw,
  Volume2,
  Home,
  Sparkles,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ThemeMode,
  UserProfile,
  ResponseCustomization,
  AiVoiceId,
  AI_VOICE_OPTIONS,
} from '../types/chat';
import { getThemeColors } from '../utils/themeStyles';
import { cyberAudio } from '../utils/audio';
import {
  base64ToPlayableUrl,
  getCachedClientTts,
  getVoicePreviewSampleText,
  playAudioBase64ViaContext,
  prefetchVoicePreviews,
  registerGlobalTtsStop,
  revokePlayableUrl,
  setCachedClientTts,
  speakWithDistinctBrowserVoice,
  stopActiveWebAudio,
  stopGlobalTts,
  unlockAudioContextSync,
} from '../utils/browserTts';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoHome: () => void;
  authUser: User | null;
  isAuthLoading: boolean;
  authError: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  userProfile: UserProfile;
  onUpdateProfile: (updater: (prev: UserProfile) => UserProfile) => void;
  responsePrefs: ResponseCustomization;
  onUpdateResponsePrefs: (updater: (prev: ResponseCustomization) => ResponseCustomization) => void;
  onResetResponsePrefs: () => void;
  theme: ThemeMode;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onGoHome,
  authUser,
  isAuthLoading,
  authError,
  onSignIn,
  onSignOut,
  userProfile,
  onUpdateProfile,
  responsePrefs,
  onUpdateResponsePrefs,
  onResetResponsePrefs,
  theme,
}) => {
  const [newLike, setNewLike] = useState('');
  const [newDislike, setNewDislike] = useState('');
  const [editingName, setEditingName] = useState(userProfile.name || '');
  const [previewingVoice, setPreviewingVoice] = useState<AiVoiceId | null>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previewBlobUrlRef = React.useRef<string | null>(null);
  const previewAbortRef = React.useRef<AbortController | null>(null);
  const previewRequestIdRef = React.useRef(0);
  const colors = getThemeColors(theme);

  const stopPreviewVoice = () => {
    previewRequestIdRef.current += 1;
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
      previewAbortRef.current = null;
    }
    stopActiveWebAudio();
    if (previewAudioRef.current) {
      previewAudioRef.current.onended = null;
      previewAudioRef.current.onerror = null;
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    revokePlayableUrl(previewBlobUrlRef.current);
    previewBlobUrlRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPreviewingVoice(null);
  };

  useEffect(() => {
    if (isOpen) {
      setEditingName(userProfile.name || authUser?.displayName || '');
      let retryTimer: number | null = null;
      void prefetchVoicePreviews().then((complete) => {
        if (!complete) {
          retryTimer = window.setTimeout(() => {
            void prefetchVoicePreviews();
          }, 3200);
        }
      });
      return () => {
        if (retryTimer) window.clearTimeout(retryTimer);
      };
    } else {
      stopPreviewVoice();
    }
  }, [isOpen, userProfile.name, authUser?.displayName]);

  useEffect(() => {
    return () => {
      stopPreviewVoice();
    };
  }, []);

  if (!isOpen) return null;

  const activeVoiceId: AiVoiceId = responsePrefs.voiceName || 'Kore';

  const handlePreviewVoice = async (voiceId: AiVoiceId, forcePlay = false) => {
    if (!forcePlay && previewingVoice === voiceId) {
      stopPreviewVoice();
      registerGlobalTtsStop(null);
      return;
    }

    stopGlobalTts();
    stopPreviewVoice();
    unlockAudioContextSync();

    const reqId = ++previewRequestIdRef.current;
    const controller = new AbortController();
    previewAbortRef.current = controller;
    registerGlobalTtsStop(stopPreviewVoice);
    setPreviewingVoice(voiceId);

    const sampleText = getVoicePreviewSampleText(voiceId);

    const playWav = async (audioBase64: string, mimeType: string): Promise<boolean> => {
      if (previewRequestIdRef.current !== reqId) return false;

      const playedViaCtx = await playAudioBase64ViaContext(audioBase64, {
        mimeType,
        isCancelled: () => previewRequestIdRef.current !== reqId,
        onEnded: () => {
          if (previewRequestIdRef.current === reqId) setPreviewingVoice(null);
        },
        onError: () => {
          if (previewRequestIdRef.current === reqId) setPreviewingVoice(null);
        },
      });
      if (playedViaCtx || previewRequestIdRef.current !== reqId) return playedViaCtx;

      const { url, isBlob } = base64ToPlayableUrl(audioBase64, mimeType || 'audio/wav');
      if (isBlob) {
        previewBlobUrlRef.current = url;
      }
      const audio = new Audio(url);
      previewAudioRef.current = audio;

      const cleanup = () => {
        if (previewAudioRef.current === audio) {
          previewAudioRef.current = null;
        }
        if (previewBlobUrlRef.current === url) {
          revokePlayableUrl(url);
          previewBlobUrlRef.current = null;
        }
        if (previewRequestIdRef.current === reqId) {
          setPreviewingVoice(null);
        }
      };

      audio.onended = cleanup;
      audio.onerror = cleanup;

      try {
        await audio.play();
        if (previewRequestIdRef.current !== reqId) {
          audio.pause();
          cleanup();
          return false;
        }
        return true;
      } catch {
        audio.pause();
        cleanup();
        return false;
      }
    };

    try {
      const cached = getCachedClientTts(voiceId, sampleText);
      if (cached) {
        const played = await playWav(cached.audioBase64, cached.mimeType);
        if (played || previewRequestIdRef.current !== reqId) return;
      }

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText, voiceName: voiceId }),
        signal: controller.signal,
      });

      if (previewRequestIdRef.current !== reqId) return;

      if (res.ok) {
        const data = await res.json();
        if (previewRequestIdRef.current !== reqId) return;
        if (data.audioBase64) {
          const mime = data.mimeType || 'audio/wav';
          setCachedClientTts(voiceId, sampleText, {
            audioBase64: data.audioBase64,
            mimeType: mime,
            cleanSpeechText: data.cleanSpeechText || sampleText,
          });
          const played = await playWav(data.audioBase64, mime);
          if (played || previewRequestIdRef.current !== reqId) return;
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || previewRequestIdRef.current !== reqId) return;
    }

    if (previewRequestIdRef.current !== reqId) return;
    const started = await speakWithDistinctBrowserVoice({
      text: sampleText,
      voiceId,
      isCancelled: () => previewRequestIdRef.current !== reqId,
      onStart: () => {},
      onEnd: () => {
        if (previewRequestIdRef.current === reqId) setPreviewingVoice(null);
      },
      onError: () => {
        if (previewRequestIdRef.current === reqId) setPreviewingVoice(null);
      },
    });
    if (!started && previewRequestIdRef.current === reqId) {
      setPreviewingVoice(null);
    }
  };

  const handleAddLike = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newLike.trim();
    if (!val) return;
    cyberAudio.playLike();
    onUpdateProfile((prev) => ({
      ...prev,
      likedTopics: Array.from(new Set([val, ...prev.likedTopics])).slice(0, 30),
    }));
    setNewLike('');
  };

  const handleAddDislike = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newDislike.trim();
    if (!val) return;
    cyberAudio.playDislike();
    onUpdateProfile((prev) => ({
      ...prev,
      dislikedTopics: Array.from(new Set([val, ...prev.dislikedTopics])).slice(0, 30),
    }));
    setNewDislike('');
  };

  const handleSaveName = () => {
    const trimmed = editingName.trim();
    onUpdateProfile((prev) => ({
      ...prev,
      name: trimmed || undefined,
    }));
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[88vh] overflow-y-auto scrollbar-thin rounded-2xl border p-5 space-y-4 shadow-2xl ${colors.panelBg} ${colors.borderStrong}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl border ${colors.badgeBg}`}>
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-['Space_Grotesk'] font-bold text-base text-white truncate">
                Conta & Memória Pessoal
              </h3>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                O NEXUS aprende seus gostos e memoriza tudo no seu e-mail
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {authError && (
          <div className="px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-mono">
            {authError}
          </div>
        )}

        {/* Auth Section */}
        {!authUser ? (
          <div className="p-4 rounded-xl bg-black/35 border border-white/10 text-center space-y-3">
            {userProfile.email && (
              <div className="p-2.5 rounded-xl bg-cyan-950/35 border border-cyan-500/35 flex items-center justify-between gap-2 text-left">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-cyan-300 font-semibold truncate">
                    E-mail salvo: {userProfile.email}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">
                    Acesso direto ativado apenas no chat
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    cyberAudio.playClick();
                    onUpdateProfile((prev) => ({ ...prev, email: undefined }));
                  }}
                  className="px-2.5 py-1 rounded-lg border border-rose-500/35 bg-rose-950/40 hover:bg-rose-900/50 text-rose-200 text-[11px] font-mono shrink-0 transition-colors"
                >
                  Remover
                </button>
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Entre com seu <strong className="text-white">e-mail Google</strong> para o NEXUS
              memorizar quem você é, salvar o que você gosta ou não gosta e manter suas conversas
              sempre sincronizadas.
            </p>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playClick();
                  onSignIn();
                }}
                disabled={isAuthLoading}
                className="gsi-material-button inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-medium text-sm shadow-lg transition-all disabled:opacity-60"
              >
                {isAuthLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
                ) : (
                  <div className="w-5 h-5 shrink-0">
                    <svg viewBox="0 0 48 48" className="w-full h-full block">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                  </div>
                )}
                <span>{isAuthLoading ? 'Conectando...' : 'Entrar com E-mail Google'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/35 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={authUser.displayName || 'Usuário'}
                  className="w-9 h-9 rounded-full border border-emerald-400/50 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-200 shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {authUser.displayName || userProfile.name || 'Conta Conectada'}
                </p>
                <p className="text-[11px] font-mono text-emerald-300 flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{authUser.email}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                cyberAudio.playClick();
                onSignOut();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/35 bg-rose-950/40 hover:bg-rose-900/50 text-rose-200 text-xs font-mono shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        )}

        {/* User Name */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-mono text-slate-400">
            Como você gostaria de ser chamado(a):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleSaveName}
              placeholder="Seu nome ou apelido..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={() => {
                cyberAudio.playClick();
                handleSaveName();
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono ${colors.badgeBg}`}
            >
              Salvar
            </button>
          </div>
        </div>

        {/* Likes */}
        <div className="space-y-2 p-3 rounded-xl bg-black/30 border border-emerald-500/20">
          <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-300 font-semibold">
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>O que você gosta ({userProfile.likedTopics.length})</span>
          </div>

          <form onSubmit={handleAddLike} className="flex gap-2">
            <input
              type="text"
              value={newLike}
              onChange={(e) => setNewLike(e.target.value)}
              placeholder="Ex: explicações simples, café, animes, programação..."
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30"
              title="Adicionar gosto"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {userProfile.likedTopics.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/30 text-[11px] font-mono text-emerald-200"
              >
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProfile((prev) => ({
                      ...prev,
                      likedTopics: prev.likedTopics.filter((t) => t !== item),
                    }))
                  }
                  className="text-emerald-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Dislikes */}
        <div className="space-y-2 p-3 rounded-xl bg-black/30 border border-rose-500/20">
          <div className="flex items-center gap-1.5 text-xs font-mono text-rose-300 font-semibold">
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>O que você não gosta / evitar ({userProfile.dislikedTopics.length})</span>
          </div>

          <form onSubmit={handleAddDislike} className="flex gap-2">
            <input
              type="text"
              value={newDislike}
              onChange={(e) => setNewDislike(e.target.value)}
              placeholder="Ex: textos gigantes, spoilers, gírias..."
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
            />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 hover:bg-rose-500/30"
              title="Adicionar item a evitar"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {userProfile.dislikedTopics.length === 0 ? (
              <span className="text-[11px] font-mono text-slate-500">
                Nada marcado ainda — conforme conversamos, aprendo o que evitar!
              </span>
            ) : (
              userProfile.dislikedTopics.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/50 border border-rose-500/30 text-[11px] font-mono text-rose-200"
                >
                  <span>{item}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProfile((prev) => ({
                        ...prev,
                        dislikedTopics: prev.dislikedTopics.filter((t) => t !== item),
                      }))
                    }
                    className="text-rose-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Learned Notes */}
        <div className="space-y-2 p-3 rounded-xl bg-black/30 border border-white/10">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 font-semibold">
            <Brain className={`w-3.5 h-3.5 ${colors.accent}`} />
            <span>Memórias aprendidas ({userProfile.notes.length})</span>
          </div>

          {userProfile.notes.length === 0 ? (
            <p className="text-[11px] font-mono text-slate-500">
              Converse naturalmente comigo! Tudo que você contar sobre você ficará salvo aqui.
            </p>
          ) : (
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {userProfile.notes.map((note, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-mono text-slate-300"
                >
                  <span className="truncate">{note}</span>
                  <button
                    type="button"
                    onClick={() => {
                      cyberAudio.playDelete();
                      onUpdateProfile((prev) => ({
                        ...prev,
                        notes: prev.notes.filter((_, i) => i !== idx),
                      }));
                    }}
                    className="text-slate-500 hover:text-rose-400 shrink-0"
                    title="Remover memória"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Learned Slang & Frequent Informal Words */}
        <div className="space-y-2 p-3 rounded-xl bg-black/30 border border-cyan-500/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gírias & Seu Jeito de Falar ({userProfile.slangTerms?.length ?? 0})</span>
            </div>
            {(userProfile.slangTerms?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playDelete();
                  onUpdateProfile((prev) => ({ ...prev, slangTerms: [], slangCounts: {} }));
                }}
                className="text-[10px] font-mono text-slate-400 hover:text-rose-300 transition-colors"
                title="Limpar gírias aprendidas"
              >
                Limpar
              </button>
            )}
          </div>

          {!userProfile.slangTerms || userProfile.slangTerms.length === 0 ? (
            <p className="text-[11px] font-mono text-slate-500">
              Converse naturalmente usando suas gírias e expressões — o NEXUS aprende e entra na sua vibe quando fizer sentido.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {userProfile.slangTerms.map((term) => (
                <span
                  key={term}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/50 border border-cyan-500/30 text-[11px] font-mono text-cyan-200"
                >
                  <span>{term}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProfile((prev) => {
                        const nextCounts = { ...(prev.slangCounts || {}) };
                        delete nextCounts[term];
                        return {
                          ...prev,
                          slangTerms: (prev.slangTerms || []).filter((t) => t !== term),
                          slangCounts: nextCounts,
                        };
                      })
                    }
                    className="text-cyan-400 hover:text-white"
                    title="Remover expressão"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Estilo da IA & Preferências de Texto */}
        <div className="space-y-2.5 p-3 rounded-xl bg-black/35 border border-white/10 text-[11px] font-mono">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold min-w-0">
              <SlidersHorizontal className={`w-3.5 h-3.5 shrink-0 ${colors.accent}`} />
              <span className="truncate">Estilo, Voz & Tema</span>
              {authUser && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shrink-0">
                  Sincronizado
                </span>
              )}
            </div>
            {(responsePrefs.tone !== 'friendly' ||
              responsePrefs.length !== 'balanced' ||
              responsePrefs.format !== 'rich' ||
              !responsePrefs.useEmojis ||
              responsePrefs.fontSize !== 'medium' ||
              activeVoiceId !== 'Kore' ||
              responsePrefs.customInstructions.trim().length > 0) && (
              <button
                type="button"
                onClick={() => {
                  cyberAudio.playDelete();
                  onResetResponsePrefs();
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-white/15 bg-black/40 text-slate-300 hover:text-white text-[10px]"
                title="Restaurar estilo padrão"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Padrão</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Tom</span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['friendly', 'Amigável'],
                    ['professional', 'Profissional'],
                    ['creative', 'Criativo'],
                    ['didactic', 'Didático'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      cyberAudio.playTab();
                      onUpdateResponsePrefs((p) => ({ ...p, tone: val }));
                    }}
                    className={`px-2 py-1 rounded-md border transition-colors ${
                      responsePrefs.tone === val
                        ? colors.badgeBg
                        : 'bg-black/30 text-slate-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Tamanho da resposta
              </span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['short', 'Curta'],
                    ['balanced', 'Normal'],
                    ['detailed', 'Detalhada'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      cyberAudio.playTab();
                      onUpdateResponsePrefs((p) => ({ ...p, length: val }));
                    }}
                    className={`px-2 py-1 rounded-md border transition-colors ${
                      responsePrefs.length === val
                        ? colors.badgeBg
                        : 'bg-black/30 text-slate-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Formato
              </span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['rich', 'Livre / Visual'],
                    ['bullets', 'Tópicos'],
                    ['steps', 'Passos'],
                    ['plain', 'Texto corrido'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      cyberAudio.playTab();
                      onUpdateResponsePrefs((p) => ({ ...p, format: val }));
                    }}
                    className={`px-2 py-1 rounded-md border transition-colors ${
                      responsePrefs.format === val
                        ? colors.badgeBg
                        : 'bg-black/30 text-slate-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Letra e Emojis
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['small', 'A-'],
                    ['medium', 'A'],
                    ['large', 'A+'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      cyberAudio.playClick();
                      onUpdateResponsePrefs((p) => ({ ...p, fontSize: val }));
                    }}
                    className={`px-2.5 py-1 rounded-md border transition-colors ${
                      responsePrefs.fontSize === val
                        ? colors.badgeBg
                        : 'bg-black/30 text-slate-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const next = !responsePrefs.useEmojis;
                    cyberAudio.playToggle(next);
                    onUpdateResponsePrefs((p) => ({ ...p, useEmojis: next }));
                  }}
                  className={`ml-auto px-2.5 py-1 rounded-md border transition-colors ${
                    responsePrefs.useEmojis
                      ? colors.badgeBg
                      : 'bg-black/30 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  Emojis: {responsePrefs.useEmojis ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-white/10">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Voz da IA (2 femininas · 2 masculinas)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {AI_VOICE_OPTIONS.map((voice) => {
                const isSelected = activeVoiceId === voice.id;
                const isTesting = previewingVoice === voice.id;
                return (
                  <div
                    key={voice.id}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? colors.badgeBg
                        : 'bg-black/35 text-slate-300 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        cyberAudio.playClick();
                        onUpdateResponsePrefs((p) => ({ ...p, voiceName: voice.id }));
                        void handlePreviewVoice(voice.id, true);
                      }}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white truncate">{voice.label}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border ${
                            voice.gender === 'female'
                              ? 'border-pink-400/35 bg-pink-500/15 text-pink-200'
                              : 'border-sky-400/35 bg-sky-500/15 text-sky-200'
                          }`}
                        >
                          {voice.genderLabel}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{voice.style}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        cyberAudio.playClick();
                        if (!isSelected) {
                          onUpdateResponsePrefs((p) => ({ ...p, voiceName: voice.id }));
                          void handlePreviewVoice(voice.id, true);
                        } else {
                          void handlePreviewVoice(voice.id, false);
                        }
                      }}
                      className="p-1.5 rounded-md bg-black/45 border border-white/15 text-slate-200 hover:text-white hover:border-cyan-400/50 shrink-0 cursor-pointer"
                      title={isTesting ? `Parar prévia da voz ${voice.label}` : `Ouvir prévia da voz ${voice.label}`}
                    >
                      {isTesting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Regra fixa personalizada (opcional)
            </span>
            <input
              type="text"
              maxLength={240}
              value={responsePrefs.customInstructions}
              onChange={(e) =>
                onUpdateResponsePrefs((p) => ({ ...p, customInstructions: e.target.value }))
              }
              placeholder="Ex: sempre dê exemplos práticos, grife datas em amarelo..."
              className="w-full rounded-lg bg-black/45 border border-white/15 px-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Bottom Tab: Voltar pra página inicial */}
        <div className="pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              cyberAudio.playClick();
              onGoHome();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-black/45 hover:bg-white/10 border border-white/15 hover:border-cyan-400/50 text-xs font-mono font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
          >
            <Home className="w-4 h-4 text-cyan-300" />
            <span>Voltar pra página inicial</span>
          </button>
        </div>
      </div>
    </div>
  );
};
