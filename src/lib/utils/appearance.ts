export interface AppearanceSettings {
  theme: string;
  customAccent: string;
  customAccentHex: string;
  customSecondaryHex: string;
  customBgHex: string;
  font: string;
  fontSize: string;
  fontWeightScale: string;
  numberFont: string;
  headerStyle: string;
  density: string;
  compactMode: boolean;
  gridColumns: string;
  buttonStyle: string;
  cardStyle: string;
  cardBlur: string;
  surfaceTint: string;
  borderRadius: string;
  animationLevel: string;
  navStyle: string;
  bgStyle: string;
  accentIntensity: string;
  glowIntensity: string;
  borderThickness: string;
  glassOpacity: string;
  contrastMode: string;
  colorMode: string;
  textShadow: boolean;
}

export interface ThemeOption {
  id: string;
  label: string;
  colors: [string, string, string];
  isLight: boolean;
  category: 'dark' | 'oled' | 'light';
  metaColor: string;
}

export const APPEARANCE_STORAGE_KEY = 'ironforge_appearance_v1';

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  customAccent: 'default',
  customAccentHex: '',
  customSecondaryHex: '',
  customBgHex: '',
  font: 'inter',
  fontSize: 'normal',
  fontWeightScale: 'normal',
  numberFont: 'mono',
  headerStyle: 'gradient',
  density: 'normal',
  compactMode: false,
  gridColumns: '2',
  buttonStyle: 'default',
  cardStyle: 'glass',
  cardBlur: 'normal',
  surfaceTint: 'none',
  borderRadius: 'default',
  animationLevel: 'normal',
  navStyle: 'default',
  bgStyle: 'mesh',
  accentIntensity: 'normal',
  glowIntensity: 'normal',
  borderThickness: 'normal',
  glassOpacity: 'medium',
  contrastMode: 'normal',
  colorMode: 'normal',
  textShadow: false,
};

export const THEME_OPTIONS: ThemeOption[] = [
  // Dark & OLED Themes
  { id: 'dark', label: 'Forge', colors: ['#FF3D5A', '#8B5CF6', '#070710'], isLight: false, category: 'dark', metaColor: '#070710' },
  { id: 'oled', label: 'OLED', colors: ['#FF3D5A', '#10E89A', '#000000'], isLight: false, category: 'oled', metaColor: '#000000' },
  { id: 'ocean', label: 'Ocean', colors: ['#0EA5E9', '#6366F1', '#031028'], isLight: false, category: 'dark', metaColor: '#031028' },
  { id: 'forest', label: 'Forest', colors: ['#10B981', '#D97706', '#0A1E0D'], isLight: false, category: 'dark', metaColor: '#0A1E0D' },
  { id: 'steel', label: 'Steel', colors: ['#8BA1B5', '#EF4444', '#101820'], isLight: false, category: 'dark', metaColor: '#101820' },
  { id: 'sunset', label: 'Sunset', colors: ['#FB923C', '#FBBF24', '#2A140F'], isLight: false, category: 'dark', metaColor: '#2A140F' },
  { id: 'cyberpunk', label: 'Cyber', colors: ['#FF2ADF', '#00FFFF', '#11001C'], isLight: false, category: 'dark', metaColor: '#11001C' },
  { id: 'arctic', label: 'Arctic', colors: ['#7DD3FC', '#2DD4BF', '#0B1522'], isLight: false, category: 'dark', metaColor: '#0B1522' },
  { id: 'magma', label: 'Magma', colors: ['#FF5A1F', '#FFD700', '#140705'], isLight: false, category: 'dark', metaColor: '#140705' },
  { id: 'lavender', label: 'Lavender', colors: ['#C89BFF', '#F9A8D4', '#1A1230'], isLight: false, category: 'dark', metaColor: '#1A1230' },
  { id: 'rose', label: 'Rose', colors: ['#D94F7A', '#D4A574', '#220B14'], isLight: false, category: 'dark', metaColor: '#220B14' },
  { id: 'space', label: 'Space', colors: ['#9A67F1', '#06B6D4', '#0e1438'], isLight: false, category: 'dark', metaColor: '#0e1438' },
  { id: 'vaporwave', label: 'Vapor', colors: ['#FF2583', '#00FFFF', '#220044'], isLight: false, category: 'dark', metaColor: '#220044' },
  { id: 'jade', label: 'Jade', colors: ['#3EC5B6', '#5EEAD4', '#0f4a4a'], isLight: false, category: 'dark', metaColor: '#0f4a4a' },
  { id: 'violet', label: 'Violet', colors: ['#A78BFA', '#60A5FA', '#27244d'], isLight: false, category: 'dark', metaColor: '#27244d' },
  { id: 'noir', label: 'Noir', colors: ['#E5E7EB', '#6B7280', '#070707'], isLight: false, category: 'oled', metaColor: '#070707' },
  { id: 'zen', label: 'Zen', colors: ['#84CC16', '#0EA5E9', '#0a1911'], isLight: false, category: 'dark', metaColor: '#0a1911' },
  { id: 'gold', label: 'Gold', colors: ['#F59E0B', '#FDE68A', '#0f0c05'], isLight: false, category: 'dark', metaColor: '#0f0c05' },
  { id: 'sakura', label: 'Sakura', colors: ['#FB7185', '#F472B6', '#1c0d18'], isLight: false, category: 'dark', metaColor: '#1c0d18' },
  { id: 'nord', label: 'Nord', colors: ['#38BDF8', '#818CF8', '#1E293B'], isLight: false, category: 'dark', metaColor: '#1E293B' },
  { id: 'bloodmoon', label: 'Blood', colors: ['#E5395E', '#FB7185', '#140408'], isLight: false, category: 'dark', metaColor: '#140408' },
  { id: 'cobalt', label: 'Cobalt', colors: ['#3B82F6', '#06B6D4', '#081229'], isLight: false, category: 'dark', metaColor: '#081229' },
  { id: 'emerald_oled', label: 'Matrix', colors: ['#10B981', '#34D399', '#000000'], isLight: false, category: 'oled', metaColor: '#000000' },
  { id: 'mocha', label: 'Espresso', colors: ['#D97706', '#F59E0B', '#16100C'], isLight: false, category: 'dark', metaColor: '#16100C' },
  { id: 'crimson', label: 'Crimson', colors: ['#F43F5E', '#FB923C', '#0D0609'], isLight: false, category: 'dark', metaColor: '#0D0609' },
  { id: 'abyss', label: 'Abyss', colors: ['#22D3EE', '#38BDF8', '#050A14'], isLight: false, category: 'dark', metaColor: '#050A14' },
  { id: 'amethyst', label: 'Amethyst', colors: ['#C084FC', '#F472B6', '#090512'], isLight: false, category: 'oled', metaColor: '#090512' },
  // Light Mode Themes (10 Curated Palettes)
  { id: 'daylight', label: 'Daylight', colors: ['#E11D48', '#4F46E5', '#F8FAFC'], isLight: true, category: 'light', metaColor: '#F8FAFC' },
  { id: 'sand', label: 'Sand', colors: ['#EA580C', '#0D9488', '#FAF6F0'], isLight: true, category: 'light', metaColor: '#FAF6F0' },
  { id: 'snow', label: 'Snow', colors: ['#2563EB', '#0EA5E9', '#FFFFFF'], isLight: true, category: 'light', metaColor: '#FFFFFF' },
  { id: 'mint', label: 'Mint', colors: ['#059669', '#0D9488', '#F2FBF7'], isLight: true, category: 'light', metaColor: '#F2FBF7' },
  { id: 'blossom', label: 'Blossom', colors: ['#DB2777', '#E11D48', '#FFF5F8'], isLight: true, category: 'light', metaColor: '#FFF5F8' },
  { id: 'sky', label: 'Sky', colors: ['#0284C7', '#4F46E5', '#F0F7FF'], isLight: true, category: 'light', metaColor: '#F0F7FF' },
  { id: 'lilac', label: 'Lilac', colors: ['#7C3AED', '#C026D3', '#F7F4FF'], isLight: true, category: 'light', metaColor: '#F7F4FF' },
  { id: 'paper', label: 'Paper', colors: ['#18181B', '#52525B', '#F9F8F4'], isLight: true, category: 'light', metaColor: '#F9F8F4' },
  { id: 'citrus', label: 'Citrus', colors: ['#D97706', '#65A30D', '#FFFBF0'], isLight: true, category: 'light', metaColor: '#FFFBF0' },
  { id: 'matcha', label: 'Matcha', colors: ['#3F6212', '#15803D', '#F4F7F0'], isLight: true, category: 'light', metaColor: '#F4F7F0' },
  { id: 'peach', label: 'Peach', colors: ['#EA580C', '#F43F5E', '#FFF6F0'], isLight: true, category: 'light', metaColor: '#FFF6F0' },
  { id: 'oceanic', label: 'Breeze', colors: ['#0284C7', '#0D9488', '#EFFBFA'], isLight: true, category: 'light', metaColor: '#EFFBFA' },
  { id: 'linen', label: 'Linen', colors: ['#B45309', '#78716C', '#FBF8F3'], isLight: true, category: 'light', metaColor: '#FBF8F3' },
  { id: 'berry', label: 'Berry', colors: ['#9333EA', '#E11D48', '#FAF5FF'], isLight: true, category: 'light', metaColor: '#FAF5FF' },
  { id: 'slate_light', label: 'Glacier', colors: ['#334155', '#2563EB', '#F1F5F9'], isLight: true, category: 'light', metaColor: '#F1F5F9' },
];

export const LIGHT_THEME_IDS = new Set(
  THEME_OPTIONS.filter((t) => t.isLight).map((t) => t.id)
);

export function isLightTheme(themeId: string | undefined | null): boolean {
  return Boolean(themeId && LIGHT_THEME_IDS.has(themeId));
}

export function getThemeMetaColor(themeId: string | undefined | null): string {
  const found = THEME_OPTIONS.find((t) => t.id === themeId);
  return found?.metaColor || '#070710';
}

export const CUSTOM_ACCENT_OPTIONS = [
  { id: 'default', label: 'Theme', color: '', secondary: '' },
  { id: 'crimson', label: 'Crimson', color: '#FF3D5A', secondary: '#FF8A3D' },
  { id: 'electric', label: 'Electric', color: '#0EA5E9', secondary: '#6366F1' },
  { id: 'emerald', label: 'Emerald', color: '#10E89A', secondary: '#06B6D4' },
  { id: 'violet', label: 'Violet', color: '#A855F7', secondary: '#EC4899' },
  { id: 'amber', label: 'Amber', color: '#F59E0B', secondary: '#EF4444' },
  { id: 'magenta', label: 'Magenta', color: '#EC4899', secondary: '#8B5CF6' },
  { id: 'cyan', label: 'Cyan', color: '#22D3EE', secondary: '#3B82F6' },
  { id: 'lime', label: 'Lime', color: '#84CC16', secondary: '#10B981' },
  { id: 'coral', label: 'Coral', color: '#FB7185', secondary: '#FBBF24' },
];

export const FONT_OPTIONS = [
  { id: 'inter', label: 'Inter', preview: 'Clean & Modern', cssVar: 'var(--font-inter), sans-serif' },
  { id: 'outfit', label: 'Outfit', preview: 'Geometric & Bold', cssVar: 'var(--font-outfit), sans-serif' },
  { id: 'dm-sans', label: 'DM Sans', preview: 'Friendly & Warm', cssVar: 'var(--font-dm-sans), sans-serif' },
  { id: 'nunito', label: 'Nunito', preview: 'Rounded & Soft', cssVar: 'var(--font-nunito), sans-serif' },
  { id: 'sora', label: 'Sora', preview: 'Minimalist & Sleek', cssVar: 'var(--font-sora), sans-serif' },
  { id: 'poppins', label: 'Poppins', preview: 'Versatile & Popular', cssVar: 'var(--font-poppins), sans-serif' },
  { id: 'raleway', label: 'Raleway', preview: 'Elegant & Refined', cssVar: 'var(--font-raleway), sans-serif' },
  { id: 'space-grotesk', label: 'Space Grotesk', preview: 'Athletic & Technical', cssVar: 'var(--font-space-grotesk), sans-serif' },
  { id: 'jetbrains', label: 'JetBrains Mono', preview: 'Tactical Monospace', cssVar: 'var(--font-jetbrains), monospace' },
  { id: 'system', label: 'System UI', preview: 'Native Device Font', cssVar: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
];

const ACCENT_VAR_KEYS = [
  '--accent-red',
  '--accent-orange',
  '--accent-purple',
  '--accent-green',
  '--accent-yellow',
  '--accent-blue',
  '--accent-pink',
  '--accent-cyan',
  '--accent-lime',
];

const CUSTOM_SURFACE_VAR_KEYS = [
  '--bg-void',
  '--bg-primary',
  '--bg-card',
  '--bg-elevated',
  '--bg-sheet',
  '--bg-glass',
  '--bg-input',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--text-dim',
  '--border',
  '--border-subtle',
  '--border-bright',
];

export function isValidHexColor(value: string | undefined | null): boolean {
  return Boolean(value && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim()));
}

function parseCssColor(value: string): [number, number, number] | null {
  const color = (value || '').trim();
  if (!color) return null;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
    return null;
  }

  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgbMatch) return null;
  return [
    parseInt(rgbMatch[1], 10),
    parseInt(rgbMatch[2], 10),
    parseInt(rgbMatch[3], 10),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function getRelativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Returns crisp dark (#090A0F) or white (#FFFFFF) foreground text based on WCAG relative luminance.
 */
export function getContrastTextColor(cssColor: string, fallback = '#FFFFFF'): string {
  const rgb = parseCssColor(cssColor);
  if (!rgb) return fallback;
  const lum = getRelativeLuminance(rgb);
  return lum > 0.34 ? '#090A0F' : '#FFFFFF';
}

function blendColor(
  source: [number, number, number],
  target: [number, number, number],
  ratio: number
): [number, number, number] {
  return [
    source[0] * (1 - ratio) + target[0] * ratio,
    source[1] * (1 - ratio) + target[1] * ratio,
    source[2] * (1 - ratio) + target[2] * ratio,
  ];
}

function boostColor(source: [number, number, number], amount: number): [number, number, number] {
  const avg = (source[0] + source[1] + source[2]) / 3;
  return [
    avg + (source[0] - avg) * amount,
    avg + (source[1] - avg) * amount,
    avg + (source[2] - avg) * amount,
  ];
}

function setOrRemoveAttr(el: HTMLElement, attr: string, value: string | undefined | null, defaultValue: string) {
  if (!value || value === defaultValue) {
    el.removeAttribute(attr);
  } else {
    el.setAttribute(attr, value);
  }
}

export function serializeAppearancePreset(settings: Partial<AppearanceSettings>): string {
  const clean: AppearanceSettings = { ...DEFAULT_APPEARANCE, ...settings };
  return JSON.stringify(clean, null, 2);
}

export function parseAppearancePreset(rawJson: string): Partial<AppearanceSettings> | null {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: Partial<AppearanceSettings> = {};
    const keys = Object.keys(DEFAULT_APPEARANCE) as (keyof AppearanceSettings)[];
    for (const k of keys) {
      if (parsed[k] !== undefined) {
        if (typeof DEFAULT_APPEARANCE[k] === 'boolean') {
          (out as Record<string, unknown>)[k] = Boolean(parsed[k]);
        } else if (typeof parsed[k] === 'string') {
          (out as Record<string, unknown>)[k] = parsed[k].slice(0, 64);
        }
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Applies all appearance settings to `document.documentElement` immediately and caches
 * them in `localStorage` for zero-FOUC synchronous restoration on reload.
 */
export function applyAppearanceToDOM(raw: Partial<AppearanceSettings>) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const s: AppearanceSettings = { ...DEFAULT_APPEARANCE, ...raw };

  const validTheme = THEME_OPTIONS.some((t) => t.id === s.theme) ? s.theme : 'dark';
  s.theme = validTheme;

  const hasCustomBg = isValidHexColor(s.customBgHex);
  const customBgRgb = hasCustomBg ? parseCssColor(s.customBgHex) : null;
  const isLight = customBgRgb ? getRelativeLuminance(customBgRgb) > 0.42 : isLightTheme(s.theme);
  const metaColor = customBgRgb ? toHex(customBgRgb) : getThemeMetaColor(s.theme);

  const effectiveDensity = s.density && s.density !== 'normal'
    ? s.density
    : s.compactMode
      ? 'compact'
      : 'normal';

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({ ...s, density: effectiveDensity, compactMode: effectiveDensity === 'compact' })
      );
    }
  } catch {}

  // 1. Clear inline accent, surface & contrast overrides first so theme CSS variables can be read cleanly
  ACCENT_VAR_KEYS.forEach((key) => root.style.removeProperty(key));
  CUSTOM_SURFACE_VAR_KEYS.forEach((key) => root.style.removeProperty(key));
  root.style.removeProperty('--glow-red');
  root.style.removeProperty('--glow-purple');
  root.style.removeProperty('--gradient-fire');
  root.style.removeProperty('--gradient-hero');
  root.style.removeProperty('--gradient-ocean');
  root.style.removeProperty('--border-active');
  root.style.removeProperty('--text-on-accent');
  root.style.removeProperty('--text-on-mint');
  root.style.removeProperty('--text-on-ocean');

  // 2. Apply data-* attributes & theme mode
  setOrRemoveAttr(root, 'data-theme', s.theme, 'dark');
  root.setAttribute('data-theme-mode', isLight ? 'light' : 'dark');
  root.style.colorScheme = isLight ? 'light' : 'dark';

  setOrRemoveAttr(root, 'data-font', s.font, 'inter');
  setOrRemoveAttr(root, 'data-fontsize', s.fontSize, 'normal');
  setOrRemoveAttr(root, 'data-font-weight', s.fontWeightScale, 'normal');
  setOrRemoveAttr(root, 'data-num-font', s.numberFont, 'mono');
  setOrRemoveAttr(root, 'data-header-style', s.headerStyle, 'gradient');
  setOrRemoveAttr(root, 'data-density', effectiveDensity, 'normal');
  if (effectiveDensity === 'compact') {
    root.setAttribute('data-compact', 'true');
  } else {
    root.removeAttribute('data-compact');
  }
  setOrRemoveAttr(root, 'data-grid-cols', s.gridColumns, '2');
  setOrRemoveAttr(root, 'data-buttons', s.buttonStyle, 'default');
  setOrRemoveAttr(root, 'data-cards', s.cardStyle, 'glass');
  setOrRemoveAttr(root, 'data-card-blur', s.cardBlur, 'normal');
  setOrRemoveAttr(root, 'data-surface-tint', s.surfaceTint, 'none');
  setOrRemoveAttr(root, 'data-radius', s.borderRadius, 'default');
  setOrRemoveAttr(root, 'data-anim', s.animationLevel, 'normal');
  setOrRemoveAttr(root, 'data-nav', s.navStyle, 'default');
  setOrRemoveAttr(root, 'data-bg-style', s.bgStyle, 'mesh');
  setOrRemoveAttr(root, 'data-accent-intensity', s.accentIntensity, 'normal');
  setOrRemoveAttr(root, 'data-glow', s.glowIntensity, 'normal');
  setOrRemoveAttr(root, 'data-border-width', s.borderThickness, 'normal');
  setOrRemoveAttr(root, 'data-glass-opacity', s.glassOpacity, 'medium');
  setOrRemoveAttr(root, 'data-contrast', s.contrastMode, 'normal');
  setOrRemoveAttr(root, 'data-color-mode', s.colorMode, 'normal');
  if (s.textShadow) {
    root.setAttribute('data-text-shadow', 'true');
  } else {
    root.removeAttribute('data-text-shadow');
  }

  // 3. Apply custom background color & automatically derive harmonious light/dark surfaces + readable text
  if (customBgRgb) {
    const bgHex = toHex(customBgRgb);
    if (isLight) {
      const voidHex = toHex(blendColor(customBgRgb, [0, 0, 0], 0.08));
      const cardRgb = blendColor(customBgRgb, [255, 255, 255], 0.68);
      const elevHex = toHex(blendColor(customBgRgb, [255, 255, 255], 0.85));
      const inputHex = toHex(blendColor(customBgRgb, [0, 0, 0], 0.05));
      root.style.setProperty('--bg-void', voidHex);
      root.style.setProperty('--bg-primary', bgHex);
      root.style.setProperty('--bg-card', `rgba(${Math.round(cardRgb[0])}, ${Math.round(cardRgb[1])}, ${Math.round(cardRgb[2])}, 0.9)`);
      root.style.setProperty('--bg-elevated', elevHex);
      root.style.setProperty('--bg-sheet', elevHex);
      root.style.setProperty('--bg-glass', `rgba(${Math.round(cardRgb[0])}, ${Math.round(cardRgb[1])}, ${Math.round(cardRgb[2])}, 0.82)`);
      root.style.setProperty('--bg-input', inputHex);
      root.style.setProperty('--text-primary', '#0F172A');
      root.style.setProperty('--text-secondary', '#334155');
      root.style.setProperty('--text-muted', '#52627A');
      root.style.setProperty('--text-dim', '#64748B');
      root.style.setProperty('--border', 'rgba(15, 23, 42, 0.08)');
      root.style.setProperty('--border-subtle', 'rgba(15, 23, 42, 0.13)');
      root.style.setProperty('--border-bright', 'rgba(15, 23, 42, 0.24)');
    } else {
      const voidHex = toHex(blendColor(customBgRgb, [0, 0, 0], 0.35));
      const cardRgb = blendColor(customBgRgb, [255, 255, 255], 0.06);
      const elevRgb = blendColor(customBgRgb, [255, 255, 255], 0.11);
      const sheetHex = toHex(blendColor(customBgRgb, [255, 255, 255], 0.05));
      const inputRgb = blendColor(customBgRgb, [255, 255, 255], 0.08);
      root.style.setProperty('--bg-void', voidHex);
      root.style.setProperty('--bg-primary', bgHex);
      root.style.setProperty('--bg-card', `rgba(${Math.round(cardRgb[0])}, ${Math.round(cardRgb[1])}, ${Math.round(cardRgb[2])}, 0.72)`);
      root.style.setProperty('--bg-elevated', `rgba(${Math.round(elevRgb[0])}, ${Math.round(elevRgb[1])}, ${Math.round(elevRgb[2])}, 0.84)`);
      root.style.setProperty('--bg-sheet', sheetHex);
      root.style.setProperty('--bg-glass', `rgba(${Math.round(cardRgb[0])}, ${Math.round(cardRgb[1])}, ${Math.round(cardRgb[2])}, 0.56)`);
      root.style.setProperty('--bg-input', `rgba(${Math.round(inputRgb[0])}, ${Math.round(inputRgb[1])}, ${Math.round(inputRgb[2])}, 0.7)`);
      root.style.setProperty('--text-primary', '#F5F5FA');
      root.style.setProperty('--text-secondary', '#A2A6BC');
      root.style.setProperty('--text-muted', '#82879D');
      root.style.setProperty('--text-dim', '#727689');
      root.style.setProperty('--border', 'rgba(255, 255, 255, 0.06)');
      root.style.setProperty('--border-subtle', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--border-bright', 'rgba(255, 255, 255, 0.18)');
    }
  }

  // 4. Apply custom primary / secondary accent colors (either preset or custom hex studio)
  const hasCustomHex = isValidHexColor(s.customAccentHex);
  const hasCustomSecHex = isValidHexColor(s.customSecondaryHex);
  let resolvedPrimary = '';
  let resolvedSecondary = '';

  if (hasCustomHex) {
    resolvedPrimary = s.customAccentHex.trim();
    if (hasCustomSecHex) {
      resolvedSecondary = s.customSecondaryHex.trim();
    } else {
      const pRgb = parseCssColor(resolvedPrimary);
      resolvedSecondary = pRgb ? toHex(blendColor(pRgb, isLight ? [15, 23, 42] : [255, 255, 255], 0.22)) : resolvedPrimary;
    }
  } else if (s.customAccent && s.customAccent !== 'default') {
    const found = CUSTOM_ACCENT_OPTIONS.find((a) => a.id === s.customAccent);
    if (found && found.color) {
      resolvedPrimary = found.color;
      resolvedSecondary = hasCustomSecHex ? s.customSecondaryHex.trim() : found.secondary;
    }
  } else if (hasCustomSecHex) {
    resolvedSecondary = s.customSecondaryHex.trim();
  }

  if (resolvedPrimary) {
    root.style.setProperty('--accent-red', resolvedPrimary);
    const rgb = parseCssColor(resolvedPrimary);
    if (rgb) {
      root.style.setProperty('--glow-red', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${isLight ? 0.24 : 0.42})`);
      root.style.setProperty('--border-active', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.4)`);
    }
  }
  if (resolvedSecondary) {
    root.style.setProperty('--accent-orange', resolvedSecondary);
    root.style.setProperty('--accent-purple', resolvedSecondary);
    const rgb2 = parseCssColor(resolvedSecondary);
    if (rgb2) {
      root.style.setProperty('--glow-purple', `rgba(${rgb2[0]}, ${rgb2[1]}, ${rgb2[2]}, ${isLight ? 0.2 : 0.32})`);
    }
  }
  if (resolvedPrimary && resolvedSecondary) {
    root.style.setProperty('--gradient-fire', `linear-gradient(135deg, ${resolvedPrimary} 0%, ${resolvedSecondary} 100%)`);
    root.style.setProperty('--gradient-hero', `linear-gradient(135deg, ${resolvedPrimary} 0%, ${resolvedSecondary} 60%, var(--accent-cyan) 100%)`);
    root.style.setProperty('--gradient-ocean', `linear-gradient(135deg, ${resolvedSecondary} 0%, var(--accent-blue) 100%)`);
  }

  // 5. Apply accent intensity adjustment on top of active theme + custom accent
  if (s.accentIntensity && s.accentIntensity !== 'normal' && typeof window !== 'undefined') {
    const styles = window.getComputedStyle(root);
    const subtleTarget: [number, number, number] = isLight ? [138, 146, 162] : [124, 126, 146];
    for (const key of ACCENT_VAR_KEYS) {
      const parsed = parseCssColor(styles.getPropertyValue(key));
      if (!parsed) continue;
      const adjusted = s.accentIntensity === 'subtle'
        ? blendColor(parsed, subtleTarget, 0.32)
        : boostColor(parsed, 1.32);
      root.style.setProperty(key, toHex(adjusted));
    }
  }

  // 6. Dynamically compute WCAG-safe foreground text colors on accent/mint/ocean buttons
  if (typeof window !== 'undefined') {
    const computed = window.getComputedStyle(root);
    const primaryAccent = computed.getPropertyValue('--accent-red').trim();
    const secondaryAccent = computed.getPropertyValue('--accent-orange').trim();
    const mintAccent = computed.getPropertyValue('--accent-green').trim();
    const oceanAccent = computed.getPropertyValue('--accent-purple').trim();

    const rgb1 = parseCssColor(primaryAccent);
    const rgb2 = parseCssColor(secondaryAccent);
    if (rgb1 && rgb2) {
      const avgLum = (getRelativeLuminance(rgb1) + getRelativeLuminance(rgb2)) / 2;
      root.style.setProperty('--text-on-accent', avgLum > 0.34 ? '#090A0F' : '#FFFFFF');
    } else {
      root.style.setProperty('--text-on-accent', getContrastTextColor(primaryAccent, '#FFFFFF'));
    }
    root.style.setProperty('--text-on-mint', getContrastTextColor(mintAccent, '#090A0F'));
    root.style.setProperty('--text-on-ocean', getContrastTextColor(oceanAccent, '#FFFFFF'));
  }

  // 7. Sync browser meta theme-color & Android native system bars (status bar + nav bar)
  try {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = metaColor;
  } catch {}

  try {
    const w = window as unknown as {
      IronForgeNative?: { setSystemBarTheme?: (bgHex: string, isLightBars: boolean) => void };
    };
    w.IronForgeNative?.setSystemBarTheme?.(metaColor, isLight);
  } catch {}
}
