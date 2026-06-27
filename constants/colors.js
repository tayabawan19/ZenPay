export const colors = {
  // Base backgrounds (true dark)
  bg0: '#000000',           // pure black base
  bg1: '#080810',           // primary background
  bg2: '#0E0E1A',           // card base
  bg3: '#141425',           // elevated surface

  // Glass layers
  glass1: 'rgba(255,255,255,0.03)',  // subtle glass
  glass2: 'rgba(255,255,255,0.06)',  // medium glass
  glass3: 'rgba(255,255,255,0.10)',  // strong glass
  glassDark: 'rgba(0,0,0,0.4)',      // dark glass

  // Primary accent — electric violet
  primary: '#7C6FFF',
  primaryBright: '#9D93FF',
  primaryDim: '#4A3FCC',
  primaryGlow: 'rgba(124,111,255,0.25)',
  primaryGlow2: 'rgba(124,111,255,0.08)',

  // Secondary accent — hot pink
  secondary: '#FF6BBA',
  secondaryGlow: 'rgba(255,107,186,0.2)',

  // Tertiary — cyan
  tertiary: '#00D4FF',
  tertiaryGlow: 'rgba(0,212,255,0.15)',

  // Semantic
  success: '#00F5A0',
  successGlow: 'rgba(0,245,160,0.2)',
  danger: '#FF4D6A',
  dangerGlow: 'rgba(255,77,106,0.2)',
  warning: '#FFB020',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.3)',
  textDisabled: 'rgba(255,255,255,0.15)',

  // Borders (glass edges)
  border1: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.12)',
  borderAccent: 'rgba(124,111,255,0.3)',
  borderGlow: 'rgba(124,111,255,0.5)',

  // Compatibility Mappings
  background: '#080810',
  backgroundCard: '#0E0E1A',
  backgroundElevated: '#141425',
  card: '#0E0E1A',
  accent: '#7C6FFF',
  text: '#FFFFFF',
  border: 'rgba(255,255,255,0.08)',
  borderGold: 'rgba(124,111,255,0.3)',
  white: '#FFFFFF',
};

// Dark theme defaults to the same premium dark colors
export const darkColors = { ...colors };

export default colors;
