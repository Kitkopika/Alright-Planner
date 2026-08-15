/**
 * Local-first persistence: the entire app lives in one portable JSON file
 * (`personal-data.json`) in the app's document directory. The same file is
 * what gets exported/imported — "the file is the source of truth".
 *
 * A rotating backup (`personal-data.backup.json`) is kept before every write
 * so a corrupt write never destroys data.
 *
 * On web (which has no real filesystem) the same document is stored in
 * localStorage so the identical code path runs everywhere.
 */

import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

export interface DocumentStore {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
  readBackup(): Promise<string | null>;
  remove(): Promise<void>;
}

const MAIN_KEY = 'life-os:personal-data.json';
const BACKUP_KEY = 'life-os:personal-data.backup.json';

class WebStore implements DocumentStore {
  async read(): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(MAIN_KEY) ?? null;
    } catch {
      return null;
    }
  }
  async write(text: string): Promise<void> {
    try {
      const prev = globalThis.localStorage?.getItem(MAIN_KEY);
      if (prev != null) globalThis.localStorage.setItem(BACKUP_KEY, prev);
      globalThis.localStorage.setItem(MAIN_KEY, text);
    } catch (e) {
      console.warn('LifeOS: failed to write to localStorage', e);
    }
  }
  async readBackup(): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(BACKUP_KEY) ?? null;
    } catch {
      return null;
    }
  }
  async remove(): Promise<void> {
    try {
      globalThis.localStorage?.removeItem(MAIN_KEY);
      globalThis.localStorage?.removeItem(BACKUP_KEY);
    } catch {
      // ignore
    }
  }
}

class NativeStore implements DocumentStore {
  private main: File;
  private backup: File;

  constructor() {
    this.main = new File(Paths.document, 'personal-data.json');
    this.backup = new File(Paths.document, 'personal-data.backup.json');
  }

  async read(): Promise<string | null> {
    try {
      if (!this.main.exists) return null;
      return await this.main.text();
    } catch (e) {
      console.warn('LifeOS: failed to read data file', e);
      return null;
    }
  }

  async write(text: string): Promise<void> {
    try {
      // Rotate: whatever is currently in main becomes the backup.
      if (this.main.exists) {
        const current = await this.main.text();
        this.backup.write(current);
      }
      this.main.write(text);
    } catch (e) {
      console.warn('LifeOS: failed to write data file', e);
    }
  }

  async readBackup(): Promise<string | null> {
    try {
      if (!this.backup.exists) return null;
      return await this.backup.text();
    } catch {
      return null;
    }
  }

  async remove(): Promise<void> {
    try {
      if (this.main.exists) this.main.delete();
      if (this.backup.exists) this.backup.delete();
    } catch {
      // ignore
    }
  }
}

let instance: DocumentStore | null = null;

/** Singleton store for the current platform. */
export function getDocumentStore(): DocumentStore {
  if (!instance) {
    instance = Platform.OS === 'web' ? new WebStore() : new NativeStore();
  }
  return instance;
}

// ---------------------------------------------------------------------------
// Settings file — device preferences (theme, accent, language, currency).
// Kept in its own small JSON file (settings.json on native, localStorage on
// web) so exporting/importing personal data never touches device settings.
// ---------------------------------------------------------------------------

export interface SettingsStore {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

const SETTINGS_KEY = 'alright:settings';

class WebSettingsStore implements SettingsStore {
  async read(): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(SETTINGS_KEY) ?? null;
    } catch {
      return null;
    }
  }
  async write(text: string): Promise<void> {
    try {
      globalThis.localStorage?.setItem(SETTINGS_KEY, text);
    } catch (e) {
      console.warn('LifeOS: failed to write settings', e);
    }
  }
}

class NativeSettingsStore implements SettingsStore {
  private file: File;

  constructor() {
    this.file = new File(Paths.document, 'settings.json');
  }

  async read(): Promise<string | null> {
    try {
      if (!this.file.exists) return null;
      return await this.file.text();
    } catch (e) {
      console.warn('LifeOS: failed to read settings file', e);
      return null;
    }
  }

  async write(text: string): Promise<void> {
    try {
      this.file.write(text);
    } catch (e) {
      console.warn('LifeOS: failed to write settings file', e);
    }
  }
}

let settingsInstance: SettingsStore | null = null;

/** Singleton settings store for the current platform. */
export function getSettingsStore(): SettingsStore {
  if (!settingsInstance) {
    settingsInstance = Platform.OS === 'web' ? new WebSettingsStore() : new NativeSettingsStore();
  }
  return settingsInstance;
}
