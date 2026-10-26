// Scientific colormaps and color utility functions for 2D engineering visualizations.
// Includes high-contrast color palettes and RGB interpolation for continuous fields.

export type ColormapName = 'viridis' | 'turbo' | 'inferno' | 'coolwarm' | 'grayscale';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

// 8-stop anchor points for scientific colormaps [r, g, b] (0-255)
export const COLORMAP_STOPS: Record<ColormapName, RGB[]> = {
  viridis: [
    { r: 68, g: 1, b: 84 },
    { r: 72, g: 40, b: 120 },
    { r: 62, g: 74, b: 137 },
    { r: 49, g: 104, b: 142 },
    { r: 38, g: 130, b: 142 },
    { r: 31, g: 158, b: 137 },
    { r: 53, g: 183, b: 121 },
    { r: 109, g: 205, b: 89 },
    { r: 180, g: 222, b: 44 },
    { r: 253, g: 231, b: 37 },
  ],
  turbo: [
    { r: 48, g: 18, b: 59 },
    { r: 70, g: 134, b: 251 },
    { r: 27, g: 229, b: 181 },
    { r: 164, g: 252, b: 60 },
    { r: 251, g: 185, b: 56 },
    { r: 227, g: 89, b: 23 },
    { r: 162, g: 18, b: 1 },
    { r: 122, g: 4, b: 3 },
  ],
  inferno: [
    { r: 0, g: 0, b: 4 },
    { r: 40, g: 11, b: 84 },
    { r: 101, g: 21, b: 110 },
    { r: 159, g: 42, b: 99 },
    { r: 212, g: 72, b: 66 },
    { r: 245, g: 125, b: 21 },
    { r: 250, g: 193, b: 39 },
    { r: 252, g: 255, b: 164 },
  ],
  coolwarm: [
    { r: 59, g: 76, b: 192 },
    { r: 104, g: 140, b: 244 },
    { r: 158, g: 191, b: 255 },
    { r: 211, g: 225, b: 242 },
    { r: 242, g: 209, b: 196 },
    { r: 244, g: 154, b: 132 },
    { r: 220, g: 85, b: 67 },
    { r: 180, g: 4, b: 38 },
  ],
  grayscale: [
    { r: 10, g: 10, b: 12 },
    { r: 40, g: 40, b: 45 },
    { r: 80, g: 80, b: 85 },
    { r: 120, g: 120, b: 125 },
    { r: 160, g: 160, b: 165 },
    { r: 200, g: 200, b: 205 },
    { r: 245, g: 245, b: 250 },
  ],
};

export const COLORMAPS = COLORMAP_STOPS;

/**
 * Interpolate a normalized value t in [0, 1] into an RGB color using the given colormap.
 */
export function getColormapRGB(t: number, colormap: ColormapName = 'viridis'): RGB {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const stops = COLORMAP_STOPS[colormap] ?? COLORMAP_STOPS.viridis;
  const n = stops.length - 1;
  const indexFloat = clamped * n;
  const i0 = Math.floor(indexFloat);
  const i1 = Math.min(n, i0 + 1);
  const frac = indexFloat - i0;

  const c0 = stops[i0];
  const c1 = stops[i1];

  return {
    r: Math.round(c0.r + (c1.r - c0.r) * frac),
    g: Math.round(c0.g + (c1.g - c0.g) * frac),
    b: Math.round(c0.b + (c1.b - c0.b) * frac),
  };
}

/**
 * Interpolates a normalized value t in [0, 1] and returns [r, g, b] triplet.
 */
export function interpolateColormap(t: number, colormap: ColormapName = 'viridis'): [number, number, number] {
  const { r, g, b } = getColormapRGB(t, colormap);
  return [r, g, b];
}

/**
 * Return CSS rgb string for a normalized value.
 */
export function getColormapCSS(t: number, colormap: ColormapName = 'viridis'): string {
  const { r, g, b } = getColormapRGB(t, colormap);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Default multi-series color palette tailored for dark engineering UI.
 * High contrast, colorblind-friendly accents.
 */
export const MULTI_SERIES_PALETTE = [
  '#ff603b', // Coral (Primary Brand Accent)
  '#38bdf8', // Sky Blue
  '#22c55e', // Emerald Green
  '#f59e0b', // Amber / Gold
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f43f5e', // Crimson
  '#eab308', // Yellow
  '#6366f1', // Indigo
];

export function getSeriesColor(index: number, customColor?: string): string {
  if (customColor) return customColor;
  return MULTI_SERIES_PALETTE[index % MULTI_SERIES_PALETTE.length];
}
