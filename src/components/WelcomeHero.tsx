import React from 'react';
import { Sparkles, Globe, ArrowUpRight, ShieldCheck, Zap, CloudSun, Compass } from 'lucide-react';
import { ThemeMode } from '../types/chat';
import { CyberGearLogo } from './CyberGearLogo';

interface WelcomeHeroProps {
  onSelectPrompt: (prompt: string, enableSearch?: boolean) => void;
  theme?: ThemeMode;
}

const STARTER_PROMPTS = [
  {
    icon: CloudSun,
    title: 'Previsão Temporal & Clima',
    prompt: 'Qual a previsão do tempo e temperatura exata para hoje e os próximos dias em São Paulo?',
    tag: 'Dados Meteorológicos em Tempo Real',
    enableSearch: true,
  },
  {
    icon: Globe,
    title: 'Pesquisa Avançada Multi-Site',
    prompt: 'Pesquise a fundo as últimas descobertas em fusão nuclear e IA cruzando Wikipédia, artigos científicos e portais.',
    tag: 'Pesquisa Profunda Multi-Fontes',
    enableSearch: true,
  },
  {
    icon: Compass,
    title: 'Escolha Autônoma & Opinião',
    prompt: 'Entre Rust e Go para construir microsserviços de altíssima concorrência, qual você prefere e por quê? Seja decisivo.',
    tag: 'Tomada de Decisão Autônoma',
    enableSearch: false,
  },
  {
    icon: Sparkles,
    title: 'Engenharia de Software',
    prompt: 'Crie uma função completa em TypeScript com tipagem estrita para calcular rotação e engrenagens com taxa de torque.',
    tag: 'Precisão Técnica Elevada',
    enableSearch: false,
  },
];

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({ onSelectPrompt, theme = 'cyber' }) => {
  const isSimple = theme === 'simple';
  const isNebula = theme === 'nebula';

  const ringClass = isSimple
    ? 'border-white/25 bg-[#161a26]/90 shadow-md'
    : isNebula
    ? 'border-purple-400/50 bg-gradient-to-b from-[#22074d]/80 to-[#0c021c]/95 shadow-[0_0_40px_rgba(168,85,247,0.45)]'
    : 'border-cyan-300/60 bg-gradient-to-b from-[#062246]/80 to-[#020a18]/95 shadow-[0_0_45px_rgba(34,211,238,0.45)]';

  const innerRingClass = isSimple
    ? 'border-white/30 text-white'
    : isNebula
    ? 'border-purple-300/70 text-purple-300 shadow-[inset_0_0_24px_rgba(168,85,247,0.45)]'
    : 'border-cyan-300/80 text-cyan-200 shadow-[inset_0_0_26px_rgba(34,211,238,0.45)]';

  const titleGradient = isSimple
    ? 'bg-gradient-to-r from-white via-slate-100 to-slate-300'
    : isNebula
    ? 'bg-gradient-to-r from-purple-100 via-purple-300 to-fuchsia-400 drop-shadow-[0_0_25px_rgba(168,85,247,0.45)]'
    : 'bg-gradient-to-r from-cyan-50 via-cyan-300 to-blue-400 drop-shadow-[0_0_28px_rgba(34,211,238,0.5)]';

  const badgeClass = isSimple
    ? 'bg-[#181d28] border-white/25 text-white'
    : isNebula
    ? 'bg-purple-950/70 border-purple-400/40 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
    : 'bg-cyan-950/75 border-cyan-400/45 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.25)]';

  const creatorHighlight = isSimple
    ? 'text-white font-bold'
    : isNebula
    ? 'text-purple-300 font-bold'
    : 'text-cyan-300 font-bold';

  const cardClass = isSimple
    ? 'bg-[#151924] hover:bg-[#1a2030] border-white/15 hover:border-white/35 text-slate-200 shadow-sm'
    : isNebula
    ? 'bg-gradient-to-br from-[#160633]/90 to-[#0c021c]/90 hover:from-[#22094d] hover:to-[#13042b] border-purple-500/25 hover:border-purple-400/60 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:shadow-[0_0_25px_rgba(168,85,247,0.3)]'
    : 'bg-gradient-to-br from-[#051833]/90 to-[#020a19]/95 hover:from-[#08244a] hover:to-[#04122b] border-cyan-400/30 hover:border-cyan-300/75 text-slate-100 shadow-[0_0_20px_rgba(6,182,212,0.12)] hover:shadow-[0_0_28px_rgba(34,211,238,0.3)]';

  const dotClass = isSimple
    ? 'bg-white shadow-[0_0_8px_#ffffff]'
    : isNebula
    ? 'bg-purple-400 shadow-[0_0_10px_#c084fc]'
    : 'bg-cyan-300 shadow-[0_0_12px_#22d3ee]';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-4xl mx-auto text-center animate-fadeIn my-auto">
      {/* Holographic Cyber Gear Core Emblem */}
      <div className="relative mb-6">
        <div
          className={`w-24 h-24 md:w-28 md:h-28 rounded-full border flex items-center justify-center backdrop-blur-md transition-all duration-300 ${ringClass}`}
        >
          <div
            className={`w-16 h-16 md:w-20 md:h-20 rounded-full border flex items-center justify-center transition-all duration-300 ${innerRingClass}`}
          >
            <CyberGearLogo size={48} spinning glow theme={theme} />
          </div>
        </div>

        <span
          className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full animate-ping ${dotClass}`}
        />
        <span className={`absolute -bottom-1 right-2 w-2 h-2 rounded-full ${dotClass}`} />
      </div>

      {/* Main Branding Titles */}
      <div className="space-y-2 mb-6">
        <h1
          className={`text-3xl md:text-5xl font-black font-['Chakra_Petch'] tracking-wide text-transparent bg-clip-text ${titleGradient}`}
        >
          NEXUS AI
        </h1>

        <p className="text-sm md:text-base text-slate-300 max-w-lg mx-auto font-normal leading-relaxed">
          Inteligência artificial avançada com memória global contínua, pesquisa profunda na web, Google Drive e áudio multimodal.
        </p>

        <div className="pt-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono shadow-sm ${badgeClass}`}
          >
            Criada pela <strong className={creatorHighlight}>NexusBye</strong>
          </span>
        </div>
      </div>

      {/* Capability tags */}
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-8 text-xs font-mono">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${badgeClass}`}>
          <Globe className="w-3.5 h-3.5" />
          Pesquisa Multi-Sites
        </span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${badgeClass}`}>
          <Zap className="w-3.5 h-3.5" />
          Memória Global Ativa
        </span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${badgeClass}`}>
          <ShieldCheck className="w-3.5 h-3.5" />
          NexusBye Core
        </span>
      </div>

      {/* Prompt Starter Cards */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
        {STARTER_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectPrompt(item.prompt, item.enableSearch)}
              className={`group relative p-4 rounded-xl border transition-all duration-200 text-left flex flex-col justify-between overflow-hidden ${cardClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg border ${badgeClass}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-['Space_Grotesk'] font-bold text-sm tracking-wide">
                      {item.title}
                    </span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <p className="text-xs opacity-80 line-clamp-2 leading-relaxed">{item.prompt}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono opacity-75">
                <span>{item.tag}</span>
                <span className="group-hover:opacity-100">Iniciar →</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
