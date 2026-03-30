export const BACKEND_URL = 'https://clipartgenerator.vercel.app';

export const COLORS = {
  bg: '#0A0A0A',
  surface: '#111111',
  surfaceDeep: '#0F0F0F',
  border: '#1E1E1E',
  borderLight: '#242424',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#4B5563',
  textDisabled: '#374151',
  accent: '#7C3AED',
  accentDim: '#2D0A56',
  accentBorder: '#7C3AED55',
  success: '#22C55E',
  successDim: '#16A34A22',
} as const;

export const STYLE_IMAGES = {
  cartoon: require('../assets/styles/cartoon.png'),
  flat: require('../assets/styles/flat.png'),
  anime: require('../assets/styles/anime.png'),
  pixel: require('../assets/styles/pixel.png'),
  sketch: require('../assets/styles/sketch.png'),
};

export const STYLES = [
  {
    id: 'cartoon' as const,
    name: 'Cartoon',
    description: 'Pixar-style',
    emoji: '🎨',
    color: '#FF6B6B',
  },
  {
    id: 'flat' as const,
    name: 'Flat Art',
    description: 'Vector illustration',
    emoji: '🎭',
    color: '#4ECDC4',
  },
  {
    id: 'anime' as const,
    name: 'Anime',
    description: 'Manga-inspired',
    emoji: '⭐',
    color: '#A78BFA',
  },
  {
    id: 'pixel' as const,
    name: 'Pixel Art',
    description: 'Early Minecraft',
    emoji: '🕹️',
    color: '#F59E0B',
  },
  {
    id: 'sketch' as const,
    name: 'Sketch',
    description: 'Grayscale portrait',  // changed from 'Pencil outline drawing'
    emoji: '✏️',
    color: '#9CA3AF',
  },
] as const;

export type StyleId = (typeof STYLES)[number]['id'];
export type StyleConfig = (typeof STYLES)[number];
