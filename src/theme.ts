export const theme = {
  colors: {
    // Backgrounds
    bg: {
      base: '#080e1a',
      surface: '#0f1a2e',
      elevated: '#162035',
      glass: 'rgba(15, 26, 46, 0.75)',
    },
    // Brand — aurora teal
    accent: {
      DEFAULT: '#00d4aa',
      dim: 'rgba(0, 212, 170, 0.15)',
      glow: 'rgba(0, 212, 170, 0.08)',
    },
    // Power flow node colors
    solar: {
      DEFAULT: '#fbbf24',
      dim: 'rgba(251, 191, 36, 0.15)',
    },
    battery: {
      DEFAULT: '#34d399',
      dim: 'rgba(52, 211, 153, 0.15)',
    },
    grid: {
      DEFAULT: '#818cf8',
      dim: 'rgba(129, 140, 248, 0.15)',
    },
    home: {
      DEFAULT: '#f1f5f9',
      dim: 'rgba(241, 245, 249, 0.10)',
    },
    ev: {
      DEFAULT: '#60a5fa',
      dim: 'rgba(96, 165, 250, 0.15)',
    },
    heat: {
      DEFAULT: '#fb923c',
      dim: 'rgba(251, 146, 60, 0.15)',
    },
    // Status
    positive: '#34d399',
    warning: '#f59e0b',
    danger: '#f87171',
    // Text
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
      muted: '#64748b',
    },
    // Borders
    border: {
      DEFAULT: 'rgba(0, 212, 170, 0.12)',
      subtle: 'rgba(241, 245, 249, 0.06)',
    },
  },
  // Gradient backgrounds
  gradients: {
    hero: `radial-gradient(ellipse 90% 60% at 50% -10%, rgba(0, 212, 170, 0.12) 0%, transparent 65%), linear-gradient(160deg, #080e1a 0%, #0c1525 100%)`,
    card: `linear-gradient(135deg, rgba(15, 26, 46, 0.9) 0%, rgba(10, 18, 35, 0.95) 100%)`,
    solar: `radial-gradient(ellipse at top, rgba(251, 191, 36, 0.08) 0%, transparent 60%)`,
  },
} as const
