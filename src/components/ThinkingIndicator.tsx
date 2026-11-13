import React, { useEffect, useState } from 'react';
import { Cpu, Globe, Zap, Sparkles } from 'lucide-react';
import { ThemeMode } from '../types/chat';

interface ThinkingIndicatorProps {
  useSearch: boolean;
  theme?: ThemeMode;
}

const THINKING_STEPS_SEARCH = [
  'Ativando malha de pesquisa multi-fontes em tempo real...',
  'Consultando Google Search, Wikipédia e portais verificados...',
  'Buscando artigos científicos, repositórios técnicos e referências...',
  'Verificando dados temporais, meteorológicos e geográficos...',
  'Cruzando memória global de conversas anteriores...',
  'Filtrando fontes confiáveis e removendo ruídos...',
  'Avaliando contexto aprofundado para resposta completa...',
  'Estruturando tabelas, destaques e tópicos de fácil leitura...',
  'Aplicando seu perfil de preferências e bom humor...',
  'Preparando enquete ou pergunta interativa para continuar o papo...',
  'Validando links de referência e precisão dos fatos...',
  'Finalizando síntese neural no NEXUS Core...',
];

const THINKING_STEPS_STANDARD = [
  'Processando tensores neurais no NEXUS Core...',
  'Consultando memória global de conversas anteriores...',
  'Relembrando detalhes e preferências aprendidas sobre você...',
  'Sincronizando data, fuso horário e contexto local...',
  'Analisando intenções, nuances e tom ideal da resposta...',
  'Construindo raciocínio lógico passo a passo...',
  'Refinando explicação com exemplos claros e criativos...',
  'Adicionando toques de humor amigável e leve...',
  'Formatando palavras em destaque para leitura rápida...',
  'Preparando uma pergunta curiosa para você responder...',
  'Revisando clareza e precisão técnica do conteúdo...',
  'Transmitindo resposta final em alta velocidade...',
];

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ useSearch, theme = 'cyber' }) => {
  const steps = useSearch ? THINKING_STEPS_SEARCH : THINKING_STEPS_STANDARD;
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  useEffect(() => {
    setCurrentStepIdx(0);
  }, [useSearch]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIdx((prev) => (prev + 1) % steps.length);
    }, 1250);
    return () => clearInterval(interval);
  }, [steps.length]);

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

      <div className={`flex-1 min-w-0 max-w-2xl rounded-2xl p-4 relative overflow-hidden border ${containerClass}`}>
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-current to-transparent opacity-60 animate-pulse" />

        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
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

        <div className="flex items-center gap-3 min-w-0">
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

          <div className="flex-1 min-w-0 font-mono text-xs opacity-95 tracking-wide transition-all duration-300 truncate">
            {steps[currentStepIdx]}
          </div>
        </div>

        <div className="mt-3 w-full bg-black/40 h-1 rounded-full overflow-hidden border border-white/10">
          <div
            className={`h-full transition-all duration-500 rounded-full ${progressClass}`}
            style={{ width: `${((currentStepIdx + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
