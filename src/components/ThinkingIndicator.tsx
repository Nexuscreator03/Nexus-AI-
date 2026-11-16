import React, { useEffect, useMemo, useState } from 'react';
import { Cpu, Globe, Zap, Sparkles } from 'lucide-react';
import { PersonaMode, ThemeMode } from '../types/chat';

interface ThinkingIndicatorProps {
  useSearch: boolean;
  persona?: PersonaMode;
  theme?: ThemeMode;
  statusText?: string;
  progressPct?: number;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  useSearch,
  persona = 'standard',
  theme = 'cyber',
  statusText,
  progressPct,
}) => {
  const [subStepIndex, setSubStepIndex] = useState(0);

  const serverText = statusText?.trim() || '';
  const isSpecificQueryStatus = /^(Varrendo rede:|Rastreando:|Buscando:|Pesquisando:|Sondando clima:|Vendo clima:|Decodificando|Triangulando)/i.test(
    serverText
  );

  const stageSequence = useMemo(() => {
    if (useSearch || isSpecificQueryStatus) {
      const first = serverText || 'Abrindo varredura neural';
      return Array.from(
        new Set([
          first,
          'Cruzando dados em tempo real',
          'Validando fontes da rede',
          'Sintetizando resposta neural',
        ])
      );
    }
    if (persona === 'code') {
      const first = serverText || 'Mapeando arquitetura lógica';
      return Array.from(
        new Set([
          first,
          'Analisando padrões técnicos',
          'Estruturando solução neural',
          'Calibrando resposta técnica',
        ])
      );
    }
    if (persona === 'concise') {
      const first = serverText || 'Filtrando dados essenciais';
      return Array.from(
        new Set([
          first,
          'Comprimindo núcleo de resposta',
          'Calibrando síntese direta',
        ])
      );
    }
    const first = serverText || 'Ativando núcleo neural';
    return Array.from(
      new Set([
        first,
        'Sincronizando memória e contexto',
        'Estruturando sinapses lógicas',
        'Calibrando transmissão neural',
      ])
    );
  }, [serverText, useSearch, isSpecificQueryStatus, persona]);

  useEffect(() => {
    setSubStepIndex(0);
    if (stageSequence.length <= 1) return;

    const delayMs = isSpecificQueryStatus ? 2100 : 1200;
    const timer = window.setInterval(() => {
      setSubStepIndex((prev) => (prev + 1) % stageSequence.length);
    }, delayMs);

    return () => window.clearInterval(timer);
  }, [stageSequence, isSpecificQueryStatus]);

  const displayStatus = stageSequence[subStepIndex] || stageSequence[0] || 'Ativando núcleo neural';
  const baseProgress = progressPct ?? (useSearch ? 42 : 48);
  const dynamicBoost = Math.min(28, subStepIndex * 9);
  const safeProgress = Math.max(20, Math.min(94, baseProgress + dynamicBoost));

  const avatarClass =
    theme === 'simple'
      ? 'bg-[#181d28] border-white/40 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]'
      : theme === 'nebula'
      ? 'bg-[#1f093d] border-purple-400 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.5)]'
      : 'bg-[#04152b] border-cyan-300 text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.55)]';

  const containerClass =
    theme === 'simple'
      ? 'bg-[#141824] border-white/20 shadow-md'
      : theme === 'nebula'
      ? 'bg-gradient-to-r from-[#14052c] via-[#1d083d] to-[#14052c] border-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.25)]'
      : 'bg-gradient-to-r from-[#041226]/95 via-[#071f3f]/95 to-[#041226]/95 border-cyan-400/50 shadow-[0_0_28px_rgba(6,182,212,0.24)]';

  const badgeClass =
    theme === 'simple'
      ? 'bg-white/10 text-white border-white/25'
      : theme === 'nebula'
      ? 'bg-purple-950/80 text-purple-200 border-purple-500/40'
      : 'bg-cyan-950/80 text-cyan-200 border-cyan-400/40';

  const progressClass =
    theme === 'simple'
      ? 'bg-gradient-to-r from-slate-400 to-white shadow-[0_0_8px_#ffffff]'
      : theme === 'nebula'
      ? 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-300 shadow-[0_0_10px_#a855f7]'
      : 'bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-300 shadow-[0_0_12px_#22d3ee]';

  const waveClass =
    theme === 'simple'
      ? 'bg-gradient-to-t from-slate-400 to-white'
      : theme === 'nebula'
      ? 'bg-gradient-to-t from-purple-600 to-purple-300 shadow-[0_0_8px_#a855f7]'
      : 'bg-gradient-to-t from-blue-500 via-cyan-400 to-teal-300 shadow-[0_0_10px_#22d3ee]';

  const dotClass =
    theme === 'simple'
      ? 'bg-white'
      : theme === 'nebula'
      ? 'bg-purple-400'
      : 'bg-cyan-300';

  return (
    <div className="flex items-start gap-3.5 my-3 w-full min-w-0">
      <div className={`relative w-9 h-9 shrink-0 flex items-center justify-center rounded-xl border ${avatarClass}`}>
        <Cpu className="w-5 h-5 animate-pulse" />
        <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping ${dotClass}`} />
        <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${dotClass}`} />
      </div>

      <div className={`flex-1 min-w-0 max-w-2xl rounded-2xl px-4 py-3.5 relative overflow-hidden border ${containerClass}`}>
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-current to-transparent opacity-60 animate-pulse" />

        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase border ${badgeClass}`}>
              <Sparkles className="w-3 h-3 animate-spin" style={{ animationDuration: '4s' }} />
              NEXUS NEURAL CORE
            </span>
            {useSearch && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${badgeClass}`}>
                <Globe className="w-2.5 h-2.5 animate-pulse" />
                Multi-Pesquisa
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono opacity-80">
            <Zap className="w-3 h-3" />
            <span>PROCESSANDO</span>
          </div>
        </div>

        <div className="flex items-center gap-3 min-w-0 min-h-[28px]">
          <div className="flex items-center gap-1 h-5 shrink-0">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-1 rounded-full animate-pulse ${waveClass}`}
                style={{
                  height: `${12 + ((i * 5) % 12)}px`,
                  animationDelay: `${i * 150}ms`,
                  animationDuration: '800ms',
                }}
              />
            ))}
          </div>

          <div className="flex-1 min-w-0 font-mono text-[11px] sm:text-xs leading-[1.25] opacity-95 tracking-wide whitespace-normal break-words">
            {displayStatus}
          </div>
        </div>

        <div className="mt-2.5 w-full bg-black/40 h-1 rounded-full overflow-hidden border border-white/10">
          <div
            className={`h-full transition-all duration-500 rounded-full ${progressClass}`}
            style={{ width: `${safeProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
