import { ThemeMode } from '../types/chat';

export interface ThemeColors {
  name: string;
  border: string;
  borderStrong: string;
  borderSubtle: string;
  surfaceBg: string;
  panelBg: string;
  inputBg: string;
  badgeBg: string;
  hoverBg: string;
  accent: string;
  accentLight: string;
  accentDim: string;
  textPrimary: string;
  textSecondary: string;
  sendBtn: string;
  glow: string;
  glowStrong: string;
  dot: string;
  logoBox: string;
  headerBg: string;
  sidebarBg: string;
}

export function getThemeColors(theme: ThemeMode): ThemeColors {
  if (theme === 'simple') {
    return {
      name: 'Simples',
      border: 'border-white/20',
      borderStrong: 'border-white/40',
      borderSubtle: 'border-white/10',
      surfaceBg: 'bg-[#151922]',
      panelBg: 'bg-[#0f121a]',
      inputBg: 'bg-[#121620]',
      badgeBg: 'bg-white/10 text-white border-white/20',
      hoverBg: 'hover:bg-white/10',
      accent: 'text-white',
      accentLight: 'text-slate-100',
      accentDim: 'text-slate-400',
      textPrimary: 'text-white',
      textSecondary: 'text-slate-400',
      sendBtn: 'bg-white hover:bg-slate-200 text-[#0d0f16] font-bold shadow-md hover:shadow-lg',
      glow: 'shadow-[0_0_15px_rgba(255,255,255,0.12)]',
      glowStrong: 'shadow-[0_0_20px_rgba(255,255,255,0.25)]',
      dot: 'bg-white shadow-[0_0_8px_#ffffff]',
      logoBox: 'bg-[#181d28] border-white/50 shadow-[0_0_10px_rgba(255,255,255,0.2)]',
      headerBg: 'bg-[#0f131d]/95 border-white/15',
      sidebarBg: 'bg-[#0b0e16]/95 md:bg-[#0b0e16] border-white/15',
    };
  }

  if (theme === 'nebula') {
    return {
      name: 'Nebulosa',
      border: 'border-purple-500/40',
      borderStrong: 'border-purple-400',
      borderSubtle: 'border-purple-500/20',
      surfaceBg: 'bg-[#120629]/90',
      panelBg: 'bg-[#0b0319]',
      inputBg: 'bg-[#0e0420]/95',
      badgeBg: 'bg-purple-950/80 text-purple-200 border-purple-500/40',
      hoverBg: 'hover:bg-purple-950/50',
      accent: 'text-purple-400',
      accentLight: 'text-purple-200',
      accentDim: 'text-purple-400/70',
      textPrimary: 'text-purple-100',
      textSecondary: 'text-purple-300/70',
      sendBtn:
        'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-bold shadow-[0_0_20px_rgba(168,85,247,0.5)]',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]',
      glowStrong: 'shadow-[0_0_30px_rgba(168,85,247,0.55)]',
      dot: 'bg-purple-400 shadow-[0_0_10px_#c084fc]',
      logoBox: 'bg-[#1d073d] border-purple-400/90 shadow-[0_0_18px_rgba(192,132,252,0.5)]',
      headerBg: 'bg-[#0a0218]/90 border-purple-500/25',
      sidebarBg: 'bg-[#080214]/95 md:bg-[#070212] border-purple-500/25',
    };
  }

  // Ultra-Futuristic Cyber Theme
  return {
    name: 'Cyber',
    border: 'border-cyan-400/40',
    borderStrong: 'border-cyan-300',
    borderSubtle: 'border-cyan-500/25',
    surfaceBg: 'bg-[#041328]/90 backdrop-blur-xl',
    panelBg: 'bg-[#020a18]/95 backdrop-blur-xl',
    inputBg: 'bg-[#030f22]/95',
    badgeBg: 'bg-cyan-950/80 text-cyan-200 border-cyan-400/45 shadow-[0_0_10px_rgba(34,211,238,0.18)]',
    hoverBg: 'hover:bg-cyan-900/35',
    accent: 'text-cyan-300',
    accentLight: 'text-cyan-100',
    accentDim: 'text-cyan-400/75',
    textPrimary: 'text-cyan-50',
    textSecondary: 'text-cyan-300/70',
    sendBtn:
      'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-[#020814] font-bold shadow-[0_0_24px_rgba(34,211,238,0.55)]',
    glow: 'shadow-[0_0_22px_rgba(34,211,238,0.28)]',
    glowStrong: 'shadow-[0_0_34px_rgba(34,211,238,0.6)]',
    dot: 'bg-cyan-300 shadow-[0_0_12px_#22d3ee]',
    logoBox:
      'bg-gradient-to-br from-[#061c38] to-[#020b1a] border-cyan-300/90 shadow-[0_0_20px_rgba(34,211,238,0.55)]',
    headerBg: 'bg-[#020814]/88 backdrop-blur-xl border-cyan-400/25 shadow-[0_4px_24px_rgba(6,182,212,0.12)]',
    sidebarBg: 'bg-[#020713]/95 md:bg-[#020713]/95 border-cyan-400/25',
  };
}
