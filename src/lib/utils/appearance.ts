export interface AppearanceSettings {
  theme: string;
  customAccent: string;
  font: string;
  fontSize: string;
  numberFont: string;
  headerStyle: string;
  density: string;
  compactMode: boolean;
  gridColumns: string;
  buttonStyle: string;
  cardStyle: string;
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

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  customAccent: 'default',
  font: 'inter',
  fontSize: 'normal',
  numberFont: 'mono',
  headerStyle: 'gradient',
  density: 'normal',
  compactMode: false,
  gridColumns: '2',
  buttonStyle: 'default',
  cardStyle: 'glass',
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

export const THEME_OPTIONS = [
  { id: 'dark', label: 'Forge', colors: ['#FF3D5A', '#8B5CF6', '#070710'] },
  { id: 'oled', label: 'OLED', colors: ['#FF3D5A', '#10E89A', '#000000'] },
  { id: 'ocean', label: 'Ocean', colors: ['#0EA5E9', '#6366F1', '#031028'] },
  { id: 'forest', label: 'Forest', colors: ['#10B981', '#D97706', '#0A1E0D'] },
  { id: 'steel', label: 'Steel', colors: ['#EF4444', '#9CA3AF', '#101820'] },
  { id: 'sunset', label: 'Sunset', colors: ['#FB923C', '#FBBF24', '#2A140F'] },
  { id: 'cyberpunk', label: 'Cyber', colors: ['#FF00FF', '#00FFFF', '#11001C'] },
  { id: 'arctic', label: 'Arctic', colors: ['#7DD3FC', '#2DD4BF', '#0B1522'] },
  { id: 'magma', label: 'Magma', colors: ['#FF4500', '#FFD700', '#140705'] },
  { id: 'lavender', label: 'Lavender', colors: ['#C084FC', '#F9A8D4', '#1A1230'] },
  { id: 'rose', label: 'Rose', colors: ['#D43A6A', '#D4A574', '#220B14'] },
  { id: 'space', label: 'Space', colors: ['#7C3AED', '#06B6D4', '#0e1438'] },
  { id: 'vaporwave', label: 'Vapor', colors: ['#FF006E', '#8338EC', '#220044'] },
  { id: 'jade', label: 'Jade', colors: ['#14B8A6', '#5EEAD4', '#0f4a4a'] },
  { id: 'violet', label: 'Violet', colors: ['#A78BFA', '#60A5FA', '#27244d'] },
  { id: 'noir', label: 'Noir', colors: ['#E5E7EB', '#6B7280', '#070707'] },
  { id: 'zen', label: 'Zen', colors: ['#84CC16', '#0EA5E9', '#0a1911'] },
  { id: 'gold', label: 'Gold', colors: ['#F59E0B', '#FDE68A', '#0f0c05'] },
  { id: 'sakura', label: 'Sakura', colors: ['#FB7185', '#F472B6', '#1c0d18'] },
  { id: 'nord', label: 'Nord', colors: ['#38BDF8', '#818CF8', '#1E293B'] },
  { id: 'bloodmoon', label: 'Blood', colors: ['#E11D48', '#FB7185', '#140408'] },
  { id: 'cobalt', label: 'Cobalt', colors: ['#3B82F6', '#06B6D4', '#081229'] },
  { id: 'daylight', label: 'Daylight', colors: ['#E11D48', '#4F46E5', '#F8FAFC'] },
  { id: 'sand', label: 'Sand', colors: ['#EA580C', '#0D9488', '#FAF6F0'] },
];

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

/**
 * Applies all appearance settings to `document.documentElement` immediately and consistently.
 */
export function applyAppearanceToDOM(raw: Partial<AppearanceSettings>) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const s: AppearanceSettings = { ...DEFAULT_APPEARANCE, ...raw };

  // If legacy compactMode is true and density wasn't explicitly set, map to 'compact'
  const effectiveDensity = s.density && s.density !== 'normal'
    ? s.density
    : s.compactMode
      ? 'compact'
      : 'normal';

  // 1. Clear inline accent overrides first so theme CSS variables can be read cleanly
  ACCENT_VAR_KEYS.forEach((key) => root.style.removeProperty(key));
  root.style.removeProperty('--glow-red');
  root.style.removeProperty('--gradient-fire');
  root.style.removeProperty('--gradient-hero');
  root.style.removeProperty('--border-active');

  // 2. Apply data-* attributes
  setOrRemoveAttr(root, 'data-theme', s.theme, 'dark');
  setOrRemoveAttr(root, 'data-font', s.font, 'inter');
  setOrRemoveAttr(root, 'data-fontsize', s.fontSize, 'normal');
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

  // 3. Apply custom primary accent color if selected
  if (s.customAccent && s.customAccent !== 'default') {
    const found = CUSTOM_ACCENT_OPTIONS.find((a) => a.id === s.customAccent);
    if (found && found.color) {
      root.style.setProperty('--accent-red', found.color);
      root.style.setProperty('--accent-orange', found.secondary);
      const rgb = parseCssColor(found.color);
      if (rgb) {
        root.style.setProperty('--glow-red', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.4)`);
        root.style.setProperty('--border-active', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.35)`);
      }
      root.style.setProperty('--gradient-fire', `linear-gradient(135deg, ${found.color} 0%, ${found.secondary} 100%)`);
      root.style.setProperty('--gradient-hero', `linear-gradient(135deg, ${found.color} 0%, ${found.secondary} 60%, var(--accent-yellow) 100%)`);
    }
  }

  // 4. Apply accent intensity adjustment on top of active theme + custom accent
  if (s.accentIntensity && s.accentIntensity !== 'normal' && typeof window !== 'undefined') {
    const styles = window.getComputedStyle(root);
    const subtleTarget: [number, number, number] = [124, 126, 146];
    for (const key of ACCENT_VAR_KEYS) {
      const parsed = parseCssColor(styles.getPropertyValue(key));
      if (!parsed) continue;
      const adjusted = s.accentIntensity === 'subtle'
        ? blendColor(parsed, subtleTarget, 0.35)
        : boostColor(parsed, 1.35);
      root.style.setProperty(key, toHex(adjusted));
    }
  }
}
