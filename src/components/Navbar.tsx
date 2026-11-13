import React, { useState } from 'react';
import {
  Menu,
  Plus,
  Volume2,
  VolumeX,
  Download,
  Globe,
  Share2,
  Check,
  Palette,
} from 'lucide-react';
import { cyberAudio } from '../utils/audio';
import { CyberGearLogo } from './CyberGearLogo';
import { ThemeMode } from '../types/chat';
import { ThemeSelector } from './ThemeSelector';
import { getThemeColors } from '../utils/themeStyles';

interface NavbarProps {
  onOpenSidebar: () => void;
  onNewConversation: () => void;
  onExportChat?: () => void;
  hasActiveMessages: boolean;
  useSearch: boolean;
  onToggleSearch: () => void;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  onOpenSite?: () => void;
}

export function getPublicNexusUrl(): string {
  if (typeof window === 'undefined') return '';
  const { origin, hostname } = window.location;
  if (hostname.startsWith('ais-dev-')) {
    return origin.replace('://ais-dev-', '://ais-pre-');
  }
  return origin;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSidebar,
  onNewConversation,
  onExportChat,
  hasActiveMessages,
  useSearch,
  onToggleSearch,
  theme,
  onThemeChange,
  onOpenSite,
}) => {
  const [soundOn, setSoundOn] = useState(cyberAudio.isEnabled());
  const [copiedLink, setCopiedLink] = useState(false);
  const colors = getThemeColors(theme);

  const handleToggleSound = () => {
    const next = !soundOn;
    cyberAudio.setEnabled(next);
    setSoundOn(next);
    if (next) cyberAudio.playClick();
  };

  const handleCopyLink = async () => {
    cyberAudio.playClick();
    const shareUrl = getPublicNexusUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const newBtnClass =
    theme === 'simple'
      ? 'bg-white hover:bg-slate-200 text-[#0d0f16]'
      : theme === 'nebula'
      ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
      : 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-[#020814] shadow-[0_0_18px_rgba(34,211,238,0.45)]';

  return (
    <header
      className={`h-14 md:h-16 border-b px-2.5 sm:px-4 md:px-6 flex items-center justify-between gap-2 sticky top-0 z-30 shrink-0 transition-colors duration-300 ${colors.headerBg}`}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        <button
          onClick={onOpenSidebar}
          className={`md:hidden p-2 rounded-lg text-slate-300 border transition-colors shrink-0 ${colors.borderSubtle} ${colors.hoverBg}`}
          title="Abrir histórico de conversas"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (onOpenSite) {
              cyberAudio.playClick();
              onOpenSite();
            }
          }}
          title={onOpenSite ? 'Ver página oficial do Nexus AI' : 'NEXUS AI'}
          className={`flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0 text-left ${
            onOpenSite ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
          }`}
        >
          <div
            className={`relative w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-300 shrink-0 ${colors.logoBox}`}
          >
            <CyberGearLogo size={22} glow theme={theme} />
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping ${colors.dot}`} />
          </div>
          <div className="min-w-0">
            <h1
              className={`font-['Chakra_Petch'] font-black tracking-wider text-sm sm:text-base md:text-lg flex items-center gap-2 whitespace-nowrap ${colors.textPrimary}`}
            >
              NEXUS AI
            </h1>
          </div>
        </button>
      </div>

      {/* Center functional web search toggle on desktop */}
      <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
        <button
          onClick={() => {
            cyberAudio.playClick();
            onToggleSearch();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
            useSearch
              ? colors.badgeBg
              : 'bg-transparent border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Alternar Pesquisa Multi-Sites"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Pesquisa Multi-Sites: {useSearch ? 'Ativa' : 'Desativada'}</span>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="hidden sm:block">
          <ThemeSelector currentTheme={theme} onSelectTheme={onThemeChange} compact />
        </div>

        <button
          onClick={() => {
            cyberAudio.playClick();
            const nextTheme = theme === 'cyber' ? 'nebula' : theme === 'nebula' ? 'simple' : 'cyber';
            onThemeChange(nextTheme);
          }}
          className={`sm:hidden p-2 rounded-lg border bg-black/30 ${colors.borderSubtle} ${colors.accent}`}
          title={`Tema atual: ${theme}. Toque para alternar`}
        >
          <Palette className="w-4 h-4" />
        </button>

        <button
          onClick={handleCopyLink}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all whitespace-nowrap ${
            copiedLink
              ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
              : `${colors.badgeBg} hover:opacity-90`
          }`}
          title="Copiar link público direto do NEXUS AI"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-semibold">Copiado!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Link</span>
            </>
          )}
        </button>

        <button
          onClick={handleToggleSound}
          className={`p-2 rounded-lg border transition-all ${
            soundOn
              ? colors.badgeBg
              : 'text-slate-500 bg-black/30 border-slate-800 hover:text-slate-400'
          }`}
          title={soundOn ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros'}
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {hasActiveMessages && onExportChat && (
          <button
            onClick={() => {
              cyberAudio.playClick();
              onExportChat();
            }}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${colors.badgeBg}`}
            title="Exportar conversa"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        )}

        <button
          onClick={() => {
            cyberAudio.playClick();
            onNewConversation();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all font-['Space_Grotesk'] whitespace-nowrap ${newBtnClass}`}
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">Nova Conversa</span>
        </button>
      </div>
    </header>
  );
};
