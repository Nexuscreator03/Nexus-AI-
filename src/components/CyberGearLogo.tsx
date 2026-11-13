import React from 'react';
import { ThemeMode } from '../types/chat';

interface CyberGearLogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
  spinning?: boolean;
  theme?: ThemeMode;
}

const LOGO_PALETTES: Record<
  ThemeMode,
  {
    gradStart: string;
    gradMid: string;
    gradEnd: string;
    strokeOuter: string;
    ringBg: string;
    ringStroke: string;
    coreStart: string;
    coreMid: string;
    coreEnd: string;
    coreStroke: string;
    eyeFill: string;
    notchStroke: string;
    dropShadow: string;
  }
> = {
  cyber: {
    gradStart: '#22d3ee',
    gradMid: '#06b6d4',
    gradEnd: '#2563eb',
    strokeOuter: '#a5f3fc',
    ringBg: '#020b1a',
    ringStroke: '#22d3ee',
    coreStart: '#67e8f9',
    coreMid: '#0284c7',
    coreEnd: '#09152b',
    coreStroke: '#7dd3fc',
    eyeFill: '#ecfeff',
    notchStroke: '#67e8f9',
    dropShadow: 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.75))',
  },
  nebula: {
    gradStart: '#e879f9',
    gradMid: '#a855f7',
    gradEnd: '#6d28d9',
    strokeOuter: '#f5d0fe',
    ringBg: '#120324',
    ringStroke: '#c084fc',
    coreStart: '#f0abfc',
    coreMid: '#9333ea',
    coreEnd: '#1a0633',
    coreStroke: '#e879f9',
    eyeFill: '#fdf4ff',
    notchStroke: '#f0abfc',
    dropShadow: 'drop-shadow(0 0 10px rgba(192, 132, 252, 0.75))',
  },
  simple: {
    gradStart: '#ffffff',
    gradMid: '#cbd5e1',
    gradEnd: '#64748b',
    strokeOuter: '#f8fafc',
    ringBg: '#0f131d',
    ringStroke: '#e2e8f0',
    coreStart: '#f8fafc',
    coreMid: '#94a3b8',
    coreEnd: '#1e293b',
    coreStroke: '#ffffff',
    eyeFill: '#ffffff',
    notchStroke: '#f1f5f9',
    dropShadow: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.35))',
  },
};

export const CyberGearLogo: React.FC<CyberGearLogoProps> = ({
  className = '',
  size = 28,
  glow = true,
  spinning = false,
  theme = 'cyber',
}) => {
  const pal = LOGO_PALETTES[theme] || LOGO_PALETTES.cyber;
  const gearGradId = `nexusGearGrad-${theme}`;
  const coreGradId = `nexusCoreGrad-${theme}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full ${spinning ? 'animate-[spin_10s_linear_infinite]' : ''}`}
        style={{
          filter: glow ? pal.dropShadow : 'none',
        }}
      >
        <defs>
          <linearGradient id={gearGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={pal.gradStart} />
            <stop offset="50%" stopColor={pal.gradMid} />
            <stop offset="100%" stopColor={pal.gradEnd} />
          </linearGradient>

          <linearGradient id={coreGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={pal.coreStart} />
            <stop offset="55%" stopColor={pal.coreMid} />
            <stop offset="100%" stopColor={pal.coreEnd} />
          </linearGradient>
        </defs>

        {/* Outer futuristic gear wheel path with 8 cyber teeth */}
        <path
          d="
            M 44,8 L 56,8 L 57.5,18 L 65.5,21.5 L 73,14 L 81.5,22.5 L 75,30 L 78.5,38 L 88.5,39.5 L 88.5,51.5 L 78.5,53 L 75,61 L 81.5,68.5 L 73,77 L 65.5,70.5 L 57.5,74 L 56,84 L 44,84 L 42.5,74 L 34.5,70.5 L 27,77 L 18.5,68.5 L 25,61 L 21.5,53 L 11.5,51.5 L 11.5,39.5 L 21.5,38 L 25,30 L 18.5,22.5 L 27,14 L 34.5,21.5 L 42.5,18 Z
          "
          fill={`url(#${gearGradId})`}
          stroke={pal.strokeOuter}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Inner mechanical segmented ring */}
        <circle
          cx="50"
          cy="46"
          r="26"
          fill={pal.ringBg}
          stroke={pal.ringStroke}
          strokeWidth="2.5"
          strokeDasharray="8 3"
        />

        {/* Cyber Core aperture circle */}
        <circle
          cx="50"
          cy="46"
          r="16"
          fill={`url(#${coreGradId})`}
          stroke={pal.coreStroke}
          strokeWidth="1.5"
        />

        {/* Center glowing energy eye / reactor */}
        <circle cx="50" cy="46" r="5.5" fill={pal.eyeFill} />

        {/* 4 Cardinal energy notches */}
        <line x1="50" y1="28" x2="50" y2="34" stroke={pal.notchStroke} strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="58" x2="50" y2="64" stroke={pal.notchStroke} strokeWidth="2" strokeLinecap="round" />
        <line x1="32" y1="46" x2="38" y2="46" stroke={pal.notchStroke} strokeWidth="2" strokeLinecap="round" />
        <line x1="62" y1="46" x2="68" y2="46" stroke={pal.notchStroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};
