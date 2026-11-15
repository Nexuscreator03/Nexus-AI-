import React, { useState } from 'react';
import {
  X,
  Bell,
  BellRing,
  Plus,
  Check,
  Trash2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Reminder, ThemeMode } from '../types/chat';
import { getThemeColors } from '../utils/themeStyles';
import { cyberAudio } from '../utils/audio';
import { formatReminderDue } from '../utils/reminders';

interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: Reminder[];
  onAddReminder: (input: { title: string; dueAt?: number | null; notes?: string }) => void;
  onToggleReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onClearCompleted: () => void;
  theme: ThemeMode;
  isSynced: boolean;
}

export const RemindersModal: React.FC<RemindersModalProps> = ({
  isOpen,
  onClose,
  reminders,
  onAddReminder,
  onToggleReminder,
  onDeleteReminder,
  onClearCompleted,
  theme,
  isSynced,
}) => {
  const [title, setTitle] = useState('');
  const [dueLocal, setDueLocal] = useState('');
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const colors = getThemeColors(theme);

  if (!isOpen) return null;

  const now = Date.now();
  const pendingCount = reminders.filter((r) => !r.completed).length;
  const completedCount = reminders.filter((r) => r.completed).length;
  const overdueCount = reminders.filter((r) => !r.completed && r.dueAt && r.dueAt <= now).length;

  const filtered = reminders
    .filter((r) => {
      if (filter === 'pending') return !r.completed;
      if (filter === 'completed') return r.completed;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aDue = a.dueAt ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueAt ?? Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return b.createdAt - a.createdAt;
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    let dueAt: number | null = null;
    if (dueLocal) {
      const parsed = new Date(dueLocal).getTime();
      if (!Number.isNaN(parsed)) {
        dueAt = parsed;
      }
    }

    cyberAudio.playLike();
    onAddReminder({
      title: cleanTitle.slice(0, 200),
      dueAt,
      notes: notes.trim() ? notes.trim().slice(0, 500) : undefined,
    });
    setTitle('');
    setDueLocal('');
    setNotes('');
    setFilter('pending');
  };

  const handleEnableBrowserNotifs = async () => {
    if (typeof Notification === 'undefined') return;
    cyberAudio.playClick();
    try {
      const res = await Notification.requestPermission();
      setNotifPerm(res);
    } catch {}
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
        <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl border ${colors.badgeBg} relative`}>
              {overdueCount > 0 ? <BellRing className="w-5 h-5 animate-pulse" /> : <Bell className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-['Space_Grotesk'] font-bold text-base text-white truncate">
                  Lembretes & Tarefas
                </h3>
                {isSynced && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shrink-0">
                    Na conta
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                {pendingCount === 0
                  ? 'Nenhum lembrete pendente'
                  : `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}${
                      overdueCount > 0 ? ` · ${overdueCount} no horário` : ''
                    }`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Fechar lembretes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Notification Opt-in */}
        {notifPerm === 'default' && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-cyan-950/35 border border-cyan-500/30 text-[11px] font-mono text-cyan-200">
            <span>Ativar alertas do navegador quando um lembrete vencer?</span>
            <button
              type="button"
              onClick={handleEnableBrowserNotifs}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-white shrink-0 transition-colors"
            >
              Ativar
            </button>
          </div>
        )}

        {/* Quick Add Form */}
        <form onSubmit={handleSubmit} className="p-3 rounded-xl bg-black/35 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Sparkles className={`w-3 h-3 ${colors.accent}`} />
              <span>Novo lembrete</span>
            </span>
            <span className="normal-case text-slate-500">Você também pode pedir no chat!</span>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Ex: Estudar TypeScript, Pagar conta, Reunião..."
            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <CalendarClock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-black/50 border border-white/15 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
                title="Data e hora opcional"
              />
            </div>

            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              placeholder="Nota curta (opcional)..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-[11px] font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!title.trim()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all disabled:opacity-40 cursor-pointer ${colors.badgeBg}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </div>
        </form>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/40 border border-white/10 text-[11px] font-mono flex-1">
            {(
              [
                ['pending', `Pendentes (${pendingCount})`],
                ['completed', `Feitos (${completedCount})`],
                ['all', `Todos (${reminders.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  cyberAudio.playTab();
                  setFilter(key);
                }}
                className={`py-1 px-2 rounded-lg transition-all truncate ${
                  filter === key ? colors.badgeBg : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {completedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                cyberAudio.playDelete();
                onClearCompleted();
              }}
              className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-[10px] font-mono shrink-0 transition-colors"
              title="Remover todos os lembretes concluídos"
            >
              Limpar feitos
            </button>
          )}
        </div>

        {/* Reminders List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="p-6 rounded-xl bg-black/25 border border-white/10 text-center space-y-1.5">
              <CheckCircle2 className="w-6 h-6 text-slate-500 mx-auto" />
              <p className="text-xs font-mono text-slate-400">
                {filter === 'pending'
                  ? 'Tudo em dia! Nenhum lembrete pendente.'
                  : filter === 'completed'
                  ? 'Nenhum lembrete concluído ainda.'
                  : 'Você ainda não adicionou nenhum lembrete.'}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isOverdue = Boolean(!item.completed && item.dueAt && item.dueAt <= now);
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all ${
                    item.completed
                      ? 'bg-black/20 border-white/10 opacity-70'
                      : isOverdue
                      ? 'bg-amber-950/25 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                      : 'bg-black/35 border-white/15 hover:border-cyan-500/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      cyberAudio.playToggle(!item.completed);
                      onToggleReminder(item.id);
                    }}
                    className={`mt-0.5 w-4.5 h-4.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      item.completed
                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300'
                        : 'bg-black/40 border-cyan-500/50 text-transparent hover:border-cyan-300'
                    }`}
                    title={item.completed ? 'Marcar como pendente' : 'Concluir lembrete'}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <p
                      className={`text-xs sm:text-[13px] font-medium break-words ${
                        item.completed ? 'line-through text-slate-400' : 'text-white'
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.notes && (
                      <p className="text-[11px] font-mono text-slate-400 break-words">{item.notes}</p>
                    )}
                    {item.dueAt && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          isOverdue
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                            : item.completed
                            ? 'bg-white/5 border-white/10 text-slate-400'
                            : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300'
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>
                          {isOverdue ? `No horário · ${formatReminderDue(item.dueAt)}` : formatReminderDue(item.dueAt)}
                        </span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      cyberAudio.playDelete();
                      onDeleteReminder(item.id);
                    }}
                    className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors shrink-0"
                    title="Excluir lembrete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
