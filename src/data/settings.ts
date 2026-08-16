/**
 * Device settings: theme mode, accent color, language and currency.
 * Persisted to a small JSON file (`settings.json` on native, localStorage on
 * web) so choices survive restarts.
 */

import { create } from 'zustand';
import { getSettingsStore } from './persistence';
import { setDefaultCurrency, setDisplayLanguage } from '../features/finance';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'th';
export type Currency = 'USD' | 'THB';

/** Sections shown on the Today (home) screen, in display order. */
export type HomeSectionId =
  | 'progress'
  | 'stats'
  | 'schedule'
  | 'tasks'
  | 'habits'
  | 'routines'
  | 'reminders'
  | 'money'
  | 'goals'
  | 'quicknote'
  // Optional widgets the user can add via the "+" menu (charts etc).
  | 'chartMoney'
  | 'chartHabits'
  | 'chartFocus'
  | 'chartTasks'
  | 'moneyBalance'
  | 'spendCat';
export type HomeSectionSize = 'small' | 'medium' | 'large';
export interface HomeSectionConfig {
  id: HomeSectionId;
  enabled: boolean;
  size: HomeSectionSize;
}

/** Every known section id (used to validate persisted configs). */
export const HOME_SECTION_IDS: HomeSectionId[] = [
  'progress',
  'stats',
  'schedule',
  'tasks',
  'habits',
  'routines',
  'reminders',
  'money',
  'goals',
  'quicknote',
  'chartMoney',
  'chartHabits',
  'chartFocus',
  'chartTasks',
  'moneyBalance',
  'spendCat',
];

/** Sections enabled by default; chart widgets are opt-in additions. */
export const DEFAULT_HOME_LAYOUT: HomeSectionId[] = [
  'progress',
  'stats',
  'schedule',
  'tasks',
  'habits',
  'routines',
  'reminders',
  'money',
  'goals',
  'quicknote',
];

/** Granular beta visual-effects toggles. */
export interface VisualFxSettings {
  animations: boolean;
  background: boolean;
  lighting: boolean;
  glass: boolean;
  gradients: boolean;
}

export const DEFAULT_VISUAL_FX: VisualFxSettings = {
  animations: true,
  background: true,
  lighting: true,
  glass: true,
  gradients: true,
};

/** Coerce a persisted (possibly old boolean) value into the current shape. */
export function normalizeVisualFx(raw: unknown): VisualFxSettings {
  const d = DEFAULT_VISUAL_FX;
  if (!raw || typeof raw !== 'object') return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    animations: typeof r.animations === 'boolean' ? r.animations : d.animations,
    background: typeof r.background === 'boolean' ? r.background : d.background,
    lighting: typeof r.lighting === 'boolean' ? r.lighting : d.lighting,
    glass: typeof r.glass === 'boolean' ? r.glass : d.glass,
    gradients: typeof r.gradients === 'boolean' ? r.gradients : d.gradients,
  };
}

export interface SettingsState {
  theme: ThemeMode;
  accent: string;
  language: Language;
  currency: Currency;
  /** Beta visual effects, broken out by category. */
  visualFx: VisualFxSettings;
  homeLayout: HomeSectionConfig[];
  hydrated: boolean;
  setTheme: (t: ThemeMode) => void;
  setAccent: (c: string) => void;
  setLanguage: (l: Language) => void;
  setCurrency: (c: Currency) => void;
  setVisualFx: (patch: Partial<VisualFxSettings>) => void;
  setHomeLayout: (l: HomeSectionConfig[]) => void;
  hydrate: () => Promise<void>;
}

const DEFAULTS = { theme: 'system' as ThemeMode, accent: '#4F46E5', language: 'en' as Language, currency: 'THB' as Currency, visualFx: DEFAULT_VISUAL_FX };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** True when value is a 6-digit hex color like "#FF8800". */
function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

/**
 * Sanitize a persisted homeLayout: keeps the stored display order, drops
 * unknown/duplicate ids, and validates each entry. Deliberately does NOT
 * re-append removed sections (removal is a real action). Falls back to the
 * full defaults only when there is no saved config at all (first run) or the
 * saved config is empty/corrupt.
 */
export function normalizeHomeLayout(raw: unknown): HomeSectionConfig[] {
  const defaults = () => DEFAULT_HOME_LAYOUT.map((id) => ({ id, enabled: true, size: 'large' as const }));
  if (!Array.isArray(raw) || raw.length === 0) return defaults();
  const seen = new Set<HomeSectionId>();
  const out: HomeSectionConfig[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = e.id as HomeSectionId;
    if (!HOME_SECTION_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      enabled: typeof e.enabled === 'boolean' ? e.enabled : true,
      size: e.size === 'small' || e.size === 'medium' ? e.size : 'large',
    });
  }
  return out.length > 0 ? out : defaults();
}

async function load(): Promise<Partial<SettingsState>> {
  try {
    const raw = await getSettingsStore().read();
    if (raw) return JSON.parse(raw) as Partial<SettingsState>;
  } catch {
    // ignore
  }
  return {};
}

async function save(s: SettingsState): Promise<void> {
  try {
    await getSettingsStore().write(
      JSON.stringify({ theme: s.theme, accent: s.accent, language: s.language, currency: s.currency, visualFx: s.visualFx, homeLayout: s.homeLayout })
    );
  } catch {
    // ignore
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  homeLayout: normalizeHomeLayout(undefined),
  hydrated: false,

  setTheme: (theme) => {
    set({ theme });
    void save(get());
  },
  setAccent: (accent) => {
    if (!isHexColor(accent)) return; // never accept an invalid color
    set({ accent });
    void save(get());
  },
  setLanguage: (language) => {
    set({ language });
    void save(get());
    setDisplayLanguage(language);
  },
  setCurrency: (currency) => {
    set({ currency });
    void save(get());
    setDefaultCurrency(currency);
  },
  setVisualFx: (patch) => {
    set((s) => ({ visualFx: { ...s.visualFx, ...patch } }));
    void save(get());
  },
  setHomeLayout: (layout) => {
    set({ homeLayout: normalizeHomeLayout(layout) });
    void save(get());
  },
  hydrate: async () => {
    const loaded = await load();
    const currency = (loaded.currency as Currency) || DEFAULTS.currency;
    const language = (loaded.language as Language) || DEFAULTS.language;
    const accent = isHexColor(loaded.accent) ? loaded.accent : DEFAULTS.accent;
    const homeLayout = normalizeHomeLayout(loaded.homeLayout);
    const visualFx = normalizeVisualFx(loaded.visualFx);
    set({ ...DEFAULTS, ...loaded, accent, currency, language, homeLayout, visualFx, hydrated: true });
    setDefaultCurrency(currency);
    setDisplayLanguage(language);
  },
}));
