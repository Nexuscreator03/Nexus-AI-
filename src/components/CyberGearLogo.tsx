import React, { useId } from 'react';
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
    metalLight: string;
    metalMid: string;
    metalDark: string;
    rimHighlight: string;
    toothEtch: string;
    chamberBg: string;
    chamberInner: string;
    chamberStroke: string;
    strutColor: string;
    arcColor: string;
    octBg: string;
    octStroke: string;
    octInnerStroke: string;
    coreOuter: string;
    coreMid: string;
    coreDark: string;
    starFill: string;
    starStroke: string;
    aura: string;
  }
> = {
  cyber: {
    metalLight: '#a5f3fc',
    metalMid: '#06b6d4',
    metalDark: '#1d4ed8',
    rimHighlight: '#ecfeff',
    toothEtch: '#083344',
    chamberBg: '#020817',
    chamberInner: '#071b36',
    chamberStroke: '#38bdf8',
    strutColor: '#22d3ee',
    arcColor: '#7dd3fc',
    octBg: '#041024',
    octStroke: '#67e8f9',
    octInnerStroke: '#0ea5e9',
    coreOuter: '#cffafe',
    coreMid: '#0ea5e9',
    coreDark: '#082f49',
    starFill: '#ffffff',
    starStroke: '#a5f3fc',
    aura: 'radial-gradient(circle, rgba(34,211,238,0.34) 0%, rgba(14,165,233,0.12) 48%, rgba(34,211,238,0) 74%)',
  },
  nebula: {
    metalLight: '#f5d0fe',
    metalMid: '#a855f7',
    metalDark: '#5b21b6',
    rimHighlight: '#fdf4ff',
    toothEtch: '#2e1065',
    chamberBg: '#090214',
    chamberInner: '#1e083b',
    chamberStroke: '#c084fc',
    strutColor: '#e879f9',
    arcColor: '#d8b4fe',
    octBg: '#120426',
    octStroke: '#f0abfc',
    octInnerStroke: '#9333ea',
    coreOuter: '#fae8ff',
    coreMid: '#a855f7',
    coreDark: '#2e1065',
    starFill: '#ffffff',
    starStroke: '#f5d0fe',
    aura: 'radial-gradient(circle, rgba(192,132,252,0.34) 0%, rgba(168,85,247,0.12) 48%, rgba(192,132,252,0) 74%)',
  },
  simple: {
    metalLight: '#ffffff',
    metalMid: '#cbd5e1',
    metalDark: '#475569',
    rimHighlight: '#ffffff',
    toothEtch: '#0f172a',
    chamberBg: '#090d16',
    chamberInner: '#161e2e',
    chamberStroke: '#e2e8f0',
    strutColor: '#e2e8f0',
    arcColor: '#f8fafc',
    octBg: '#0f172a',
    octStroke: '#ffffff',
    octInnerStroke: '#94a3b8',
    coreOuter: '#ffffff',
    coreMid: '#94a3b8',
    coreDark: '#1e293b',
    starFill: '#ffffff',
    starStroke: '#f1f5f9',
    aura: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(226,232,240,0.08) 48%, rgba(255,255,255,0) 74%)',
  },
};

const GEAR_OUTER_PATH =
  'M 52.61,19.95 L 54.68,16.91 L 55.73,6.59 L 58.56,4.25 L 69.44,4.25 L 72.27,6.59 L 73.32,16.91 L 75.39,19.95 L 87.09,24.8 L 90.7,24.11 L 98.74,17.56 L 102.41,17.9 L 110.1,25.59 L 110.44,29.26 L 103.89,37.3 L 103.2,40.91 L 108.05,52.61 L 111.09,54.68 L 121.41,55.73 L 123.75,58.56 L 123.75,69.44 L 121.41,72.27 L 111.09,73.32 L 108.05,75.39 L 103.2,87.09 L 103.89,90.7 L 110.44,98.74 L 110.1,102.41 L 102.41,110.1 L 98.74,110.44 L 90.7,103.89 L 87.09,103.2 L 75.39,108.05 L 73.32,111.09 L 72.27,121.41 L 69.44,123.75 L 58.56,123.75 L 55.73,121.41 L 54.68,111.09 L 52.61,108.05 L 40.91,103.2 L 37.3,103.89 L 29.26,110.44 L 25.59,110.1 L 17.9,102.41 L 17.56,98.74 L 24.11,90.7 L 24.8,87.09 L 19.95,75.39 L 16.91,73.32 L 6.59,72.27 L 4.25,69.44 L 4.25,58.56 L 6.59,55.73 L 16.91,54.68 L 19.95,52.61 L 24.8,40.91 L 24.11,37.3 L 17.56,29.26 L 17.9,25.59 L 25.59,17.9 L 29.26,17.56 L 37.3,24.11 L 40.91,24.8 Z';

const TEETH_SLOTS_PATH =
  'M 64,15.5 L 64,9.5 M 98.29,29.71 L 102.54,25.46 M 112.5,64 L 118.5,64 M 98.29,98.29 L 102.54,102.54 M 64,112.5 L 64,118.5 M 29.71,98.29 L 25.46,102.54 M 15.5,64 L 9.5,64 M 29.71,29.71 L 25.46,25.46';

const ORBITAL_ARCS_PATH =
  'M 51.59,36.14 A 30.5,30.5 0 0,1 76.41,36.14 M 91.86,51.59 A 30.5,30.5 0 0,1 91.86,76.41 M 76.41,91.86 A 30.5,30.5 0 0,1 51.59,91.86 M 36.14,76.41 A 30.5,30.5 0 0,1 36.14,51.59';

const DIAGONAL_STRUTS_PATH =
  'M 79.2,48.8 L 89.81,38.19 M 79.2,79.2 L 89.81,89.81 M 48.8,79.2 L 38.19,89.81 M 48.8,48.8 L 38.19,38.19';

const CARDINAL_TICKS_PATH =
  'M 64,38.5 L 64,29.5 M 89.5,64 L 98.5,64 M 64,89.5 L 64,98.5 M 38.5,64 L 29.5,64';

const OCTAGON_OUTER_PATH =
  'M 72.8,42.75 L 85.25,55.2 L 85.25,72.8 L 72.8,85.25 L 55.2,85.25 L 42.75,72.8 L 42.75,55.2 L 55.2,42.75 Z';

const OCTAGON_INNER_PATH =
  'M 71.08,46.91 L 81.09,56.92 L 81.09,71.08 L 71.08,81.09 L 56.92,81.09 L 46.91,71.08 L 46.91,56.92 L 56.92,46.91 Z';

const NEXUS_STAR_PATH =
  'M 64,54.5 L 66.26,61.74 L 73.5,64 L 66.26,66.26 L 64,73.5 L 61.74,66.26 L 54.5,64 L 61.74,61.74 Z';

export const CyberGearLogo: React.FC<CyberGearLogoProps> = ({
  className = '',
  size = 28,
  glow = true,
  spinning = false,
  theme = 'cyber',
}) => {
  const uid = useId().replace(/:/g, '');
  const pal = LOGO_PALETTES[theme] || LOGO_PALETTES.cyber;

  const gearGradId = `ng-${uid}`;
  const rimGradId = `nr-${uid}`;
  const chamberGradId = `nc-${uid}`;
  const coreGradId = `nk-${uid}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Ambient aura sits behind the vector icon so SVG edges stay 100% razor-sharp */}
      {glow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 rounded-full"
          style={{ background: pal.aura }}
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
        className="relative block w-full h-full"
      >
        <defs>
          <linearGradient id={gearGradId} x1="12%" y1="8%" x2="88%" y2="92%">
            <stop offset="0%" stopColor={pal.metalLight} />
            <stop offset="48%" stopColor={pal.metalMid} />
            <stop offset="100%" stopColor={pal.metalDark} />
          </linearGradient>

          <linearGradient id={rimGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={pal.rimHighlight} stopOpacity="0.95" />
            <stop offset="50%" stopColor={pal.metalLight} stopOpacity="0.55" />
            <stop offset="100%" stopColor={pal.chamberStroke} stopOpacity="0.85" />
          </linearGradient>

          <radialGradient id={chamberGradId} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={pal.chamberInner} />
            <stop offset="75%" stopColor={pal.chamberBg} />
            <stop offset="100%" stopColor="#01040c" />
          </radialGradient>

          <radialGradient id={coreGradId} cx="42%" cy="38%" r="60%">
            <stop offset="0%" stopColor={pal.coreOuter} />
            <stop offset="48%" stopColor={pal.coreMid} />
            <stop offset="100%" stopColor={pal.coreDark} />
          </radialGradient>
        </defs>

        {/* Outer CNC Gear + Deep Chamber + Diagonal Struts — clockwise rotation strictly on (64, 64) */}
        <g
          className={spinning ? 'nexus-gear-spin-cw' : undefined}
          style={spinning ? { transformBox: 'view-box', transformOrigin: '64px 64px' } : undefined}
        >
          {/* 1. Outer CNC-chamfered 8-tooth futuristic gear wheel */}
          <path
            d={GEAR_OUTER_PATH}
            fill={`url(#${gearGradId})`}
            stroke={`url(#${rimGradId})`}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />

          {/* 2. Machined radial grooves etched into each tooth */}
          <path
            d={TEETH_SLOTS_PATH}
            stroke={pal.toothEtch}
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0.72"
          />

          {/* 3. Concentric machined bevel collar */}
          <circle
            cx="64"
            cy="64"
            r="41.5"
            stroke={pal.rimHighlight}
            strokeWidth="1.25"
            strokeOpacity="0.45"
          />

          {/* 4. Deep obsidian turbine chamber for crisp foreground contrast */}
          <circle
            cx="64"
            cy="64"
            r="35.5"
            fill={`url(#${chamberGradId})`}
            stroke={pal.chamberStroke}
            strokeWidth="2"
          />

          {/* 5. Four precision diagonal turbine struts */}
          <path
            d={DIAGONAL_STRUTS_PATH}
            stroke={pal.strutColor}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </g>

        {/* Inner Orbital Gyro Ring + Cardinal Ticks — smooth counter-clockwise rotation strictly on (64, 64) */}
        <g
          className={spinning ? 'nexus-gear-spin-ccw' : undefined}
          style={spinning ? { transformBox: 'view-box', transformOrigin: '64px 64px' } : undefined}
        >
          {/* 6. Segmented orbital gyro tracks */}
          <path
            d={ORBITAL_ARCS_PATH}
            stroke={pal.arcColor}
            strokeWidth="2.1"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* 7. Four cardinal optical calibration ticks */}
          <path
            d={CARDINAL_TICKS_PATH}
            stroke={pal.rimHighlight}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>

        {/* Central Anchor Core: Octagonal Housing + Energy Aperture + 4-Point Nexus Star */}
        {/* 8. Chamfered octagonal cyber housing */}
        <path
          d={OCTAGON_OUTER_PATH}
          fill={pal.octBg}
          stroke={pal.octStroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={OCTAGON_INNER_PATH}
          stroke={pal.octInnerStroke}
          strokeWidth="1.15"
          strokeOpacity="0.65"
          strokeLinejoin="round"
        />

        {/* 9. Luminous central energy aperture */}
        <circle
          cx="64"
          cy="64"
          r="12.5"
          fill={`url(#${coreGradId})`}
          stroke={pal.octStroke}
          strokeWidth="1.5"
        />

        {/* 10. Razor-sharp 4-point Nexus core spark & center lens */}
        <path
          d={NEXUS_STAR_PATH}
          fill={pal.starFill}
          stroke={pal.starStroke}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <circle cx="64" cy="64" r="3.1" fill="#ffffff" />
      </svg>
    </div>
  );
};
