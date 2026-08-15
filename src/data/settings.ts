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

export interface SettingsState {
  theme: ThemeMode;
  accent: string;
  language: Language;
  currency: Currency;
  hydrated: boolean;
  setTheme: (t: ThemeMode) => void;
  setAccent: (c: string) => void;
  setLanguage: (l: Language) => void;
  setCurrency: (c: Currency) => void;
  hydrate: () => Promise<void>;
}

const DEFAULTS = { theme: 'system' as ThemeMode, accent: '#4F46E5', language: 'en' as Language, currency: 'THB' as Currency };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** True when value is a 6-digit hex color like "#FF8800". */
function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
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
    await getSettingsStore().write(JSON.stringify({ theme: s.theme, accent: s.accent, language: s.language, currency: s.currency }));
  } catch {
    // ignore
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
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
  hydrate: async () => {
    const loaded = await load();
    const currency = (loaded.currency as Currency) || DEFAULTS.currency;
    const language = (loaded.language as Language) || DEFAULTS.language;
    const accent = isHexColor(loaded.accent) ? loaded.accent : DEFAULTS.accent;
    set({ ...DEFAULTS, ...loaded, accent, currency, language, hydrated: true });
    setDefaultCurrency(currency);
    setDisplayLanguage(language);
  },
}));
