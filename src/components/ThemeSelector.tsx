import React from 'react';
import { Palette, Sparkles, Cpu, Moon } from 'lucide-react';
import { ThemeMode } from '../types/chat';
import { cyberAudio } from '../utils/audio';

interface ThemeSelectorProps {
  currentTheme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
  compact?: boolean;
}

export const THEMES_CONFIG = [
  {
    id: 'simple' as ThemeMode,
    name: 'Simples',
    desc: 'Estilo clean (ChatGPT / Gemini)',
    icon: Sparkles,
    badgeBg: 'bg-slate-800',
    borderActive: 'border-slate-300 text-slate-100',
    colorDot: 'bg-slate-300',
  },
  {
    id: 'cyber' as ThemeMode,
    name: 'Cyber',
    desc: 'Neon azul ciano futurista',
    icon: Cpu,
    badgeBg: 'bg-cyan-950',
    borderActive: 'border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.4)]',
    colorDot: 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]',
  },
  {
    id: 'nebula' as ThemeMode,
    name: 'Nebulosa',
    desc: 'Roxo cósmico e magenta neon',
    icon: Moon,
    badgeBg: 'bg-purple-950',
    borderActive: 'border-purple-400 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.4)]',
    colorDot: 'bg-purple-400 shadow-[0_0_8px_#c084fc]',
  },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onSelectTheme,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#050914] border border-cyan-500/20">
        {THEMES_CONFIG.map((t) => {
          const active = currentTheme === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                cyberAudio.playTheme();
                onSelectTheme(t.id);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                active
                  ? `${t.borderActive} bg-white/10 font-bold`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
              title={t.desc}
            >
              <span className={`w-2 h-2 rounded-full ${t.colorDot}`} />
              <span>{t.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-mono uppercase text-slate-400 px-1 font-semibold">
        <span className="flex items-center gap-1.5">
          <Palette className="w-3 h-3 text-cyan-400" />
          <span>Tema de Fundo</span>
        </span>
        <span className="text-[10px] text-cyan-400/80 font-bold">
          {THEMES_CONFIG.find((t) => t.id === currentTheme)?.name}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {THEMES_CONFIG.map((t) => {
          const active = currentTheme === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                cyberAudio.playTheme();
                onSelectTheme(t.id);
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                active
                  ? `${t.borderActive} bg-white/10`
                  : 'bg-black/20 text-slate-400 hover:text-slate-200 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <span className={`w-2 h-2 rounded-full ${t.colorDot}`} />
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-mono font-medium">{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
