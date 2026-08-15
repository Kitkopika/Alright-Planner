/**
 * Device settings: theme mode, accent color, language and currency.
 * Persisted to localStorage (web); on native this prototype keeps them in
 * memory for the session.
 */

import { create } from 'zustand';
import { setDefaultCurrency } from '../features/finance';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'th';
export type Currency = 'USD' | 'THB';

const STORAGE_KEY = 'alright:settings';

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
  hydrate: () => void;
}

const DEFAULTS = { theme: 'system' as ThemeMode, accent: '#4F46E5', language: 'en' as Language, currency: 'THB' as Currency };

function load(): Partial<SettingsState> {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Partial<SettingsState>;
  } catch {
    // ignore
  }
  return {};
}

function save(s: SettingsState): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ theme: s.theme, accent: s.accent, language: s.language, currency: s.currency }));
  } catch {
    // ignore
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  setTheme: (theme) => {
    set({ theme });
    save(get());
  },
  setAccent: (accent) => {
    set({ accent });
    save(get());
  },
  setLanguage: (language) => {
    set({ language });
    save(get());
  },
  setCurrency: (currency) => {
    set({ currency });
    save(get());
    setDefaultCurrency(currency);
  },
  hydrate: () => {
    const loaded = load();
    const currency = (loaded.currency as Currency) || DEFAULTS.currency;
    set({ ...DEFAULTS, ...loaded, currency, hydrated: true });
    setDefaultCurrency(currency);
  },
}));
