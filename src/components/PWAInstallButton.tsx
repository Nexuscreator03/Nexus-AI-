import React, { useState } from 'react';
import { Smartphone, X, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { ThemeMode } from '../types/chat';
import { getThemeColors } from '../utils/themeStyles';
import { cyberAudio } from '../utils/audio';

interface PWAInstallButtonProps {
  theme?: ThemeMode;
  variant?: 'navbar' | 'sidebar' | 'site';
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  theme = 'cyber',
  variant = 'navbar',
  compact = false,
}) => {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || (!canInstall && !isIOS)) {
    return null;
  }

  const colors = getThemeColors(theme);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    cyberAudio.playClick();
    if (canInstall) {
      await promptInstall();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const buttonClass =
    variant === 'site'
      ? 'inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer'
      : variant === 'sidebar'
      ? `w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-mono transition-all ${colors.badgeBg} hover:opacity-90 cursor-pointer`
      : `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all whitespace-nowrap ${colors.badgeBg} hover:opacity-90 cursor-pointer`;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={buttonClass}
        title="Instalar aplicativo NexusBye AI"
      >
        <Smartphone className="w-3.5 h-3.5 shrink-0" />
        <span className={compact ? 'hidden md:inline text-[11px]' : ''}>
          {variant === 'sidebar' ? 'Instalar App NexusBye' : 'Instalar App'}
        </span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[#071124] border border-cyan-500/40 p-5 shadow-2xl text-slate-100 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                <Smartphone className="w-4 h-4" />
                <span>Instalar NexusBye AI no iPhone/iPad</span>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="text-xs text-slate-300 space-y-2 leading-relaxed list-decimal list-inside">
              <li className="flex items-center gap-1.5">
                <span>Toque no botão</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">
                  <Share className="w-3 h-3" /> Compartilhar
                </span>
                <span>na barra do Safari.</span>
              </li>
              <li>Escolha a opção &ldquo;Adicionar à Tela de Início&rdquo;.</li>
              <li>Toque em &ldquo;Adicionar&rdquo; para abrir o NexusBye AI como aplicativo.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};
