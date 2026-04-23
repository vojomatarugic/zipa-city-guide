/**
 * Centralized color configuration for Zipa City Guide
 * All hardcoded colors should be imported from this file
 */

// ============================================
// PRIMARY BRAND COLORS
// ============================================
export const BRAND = {
  primary: '#0E3DC5',
  primaryHover: '#3A6FE8',
} as const;

// ============================================
// SECTION GRADIENT COLORS (for h2 titles and navigation)
// ============================================
export const GRADIENTS = {
  home: 'linear-gradient(135deg, #0E3DC5, #3A6FE8)',
  foodAndDrink: 'linear-gradient(135deg, #D4A574, #8B6F47)',
  events: 'linear-gradient(135deg, #FB8C00, #FF9800)',
  theatre: 'linear-gradient(135deg, #8E24AA, #AB47BC)',
  cinema: 'linear-gradient(135deg, #00897B, #26A69A)',
  clubs: 'linear-gradient(135deg, #D81B60, #F06292)',
  concerts: 'linear-gradient(135deg, #C0CA33, #D4E157)',
  footerHeading: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
} as const;

// ============================================
// CATEGORY BADGE TEXT COLORS (solid colors matching gradients)
// ============================================
export const CATEGORY_COLORS = {
  foodAndDrink: '#8B6F47',
  events: '#FB8C00',
  theatre: '#8E24AA',
  cinema: '#00897B',
  clubs: '#D81B60',
  concerts: '#C0CA33',
} as const;

// ============================================
// BACKGROUND COLORS
// ============================================
export const BACKGROUNDS = {
  white: '#FFFFFF',
  lightBlue: '#F0F4FF',
  lightGray: '#F3F4F6',
  gray: '#E5E7EB',
  lightYellow: '#FFF8E1',
} as const;

// ============================================
// TEXT COLORS
// ============================================
export const TEXT = {
  primary: '#1F2937',
  secondary: '#4B5563',
  tertiary: '#6B7280',
  muted: '#9CA3AF',
} as const;

// ============================================
// BORDER COLORS
// ============================================
export const BORDERS = {
  light: '#E5E9F0',
  medium: '#CBD5E1',
} as const;

// ============================================
// UTILITY COLORS
// ============================================
export const UTILITY = {
  yellow: '#F9A825',
  orange: '#FB8C00',
  socialProof: '#FB8C00', // Social Proof Gallery background
} as const;

// ============================================
// SHADOWS
// ============================================
export const SHADOWS = {
  textGradient: '0 2px 4px rgba(0, 0, 0, 0.1)',
  card: '0 2px 12px rgba(0,0,0,0.06)',
} as const;

// ============================================
// HELPER FUNCTION: Get gradient style for text
// ============================================
export function getGradientTextStyle(gradient: string) {
  return {
    background: gradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    textShadow: SHADOWS.textGradient,
  };
}