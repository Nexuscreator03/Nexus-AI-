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
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ThemeMode, UserProfile } from '../types/chat';
import { getThemeColors } from '../utils/themeStyles';
import { cyberAudio } from '../utils/audio';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: User | null;
  isAuthLoading: boolean;
  authError: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  userProfile: UserProfile;
  onUpdateProfile: (updater: (prev: UserProfile) => UserProfile) => void;
  theme: ThemeMode;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  authUser,
  isAuthLoading,
  authError,
  onSignIn,
  onSignOut,
  userProfile,
  onUpdateProfile,
  theme,
}) => {
  const [newLike, setNewLike] = useState('');
  const [newDislike, setNewDislike] = useState('');
  const [editingName, setEditingName] = useState(userProfile.name || '');
  const colors = getThemeColors(theme);

  useEffect(() => {
    if (isOpen) {
      setEditingName(userProfile.name || authUser?.displayName || '');
    }
  }, [isOpen, userProfile.name, authUser?.displayName]);

  if (!isOpen) return null;

  const handleAddLike = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newLike.trim();
    if (!val) return;
    cyberAudio.playClick();
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
    cyberAudio.playClick();
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
                    onClick={() =>
                      onUpdateProfile((prev) => ({
                        ...prev,
                        notes: prev.notes.filter((_, i) => i !== idx),
                      }))
                    }
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
      </div>
    </div>
  );
};
