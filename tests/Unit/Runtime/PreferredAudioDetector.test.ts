import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StorageStub = {
  getItem: (key: string) => string | null;
  key: (index: number) => string | null;
  length: number;
};

type PreferredAudioDetector = {
  detectPreferredAudioLanguage: () => string | null;
};

type PreferredAudioModule = {
  createPreferredAudioDetector: (options: Record<string, unknown>) => PreferredAudioDetector;
};

const preferredAudioDetectorModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'PreferredAudioDetector.ts'),
).href;
let preferredAudioModule: PreferredAudioModule | null = null;

function createStorageStub(entries: Record<string, string>): StorageStub {
  const keys = Object.keys(entries);
  return {
    getItem: (key: string) => {
      if (!Object.hasOwn(entries, key)) {
        return null;
      }
      const value = entries[key];
      return typeof value === 'string' ? value : null;
    },
    key: (index: number) => keys[index] ?? null,
    get length() {
      return keys.length;
    },
  };
}

function normalizeAudioLocale(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function getDetector(options: Record<string, unknown>): PreferredAudioDetector {
  if (!preferredAudioModule) {
    throw new Error('Preferred audio runtime module was not initialized for test');
  }
  return preferredAudioModule.createPreferredAudioDetector(options);
}

describe('PreferredAudioDetector', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(preferredAudioDetectorModuleUrl)) as {
      createRuntimePreferredAudioRuntime: () => object;
    };
    preferredAudioModule = module.createRuntimePreferredAudioRuntime() as PreferredAudioModule;
  });

  afterEach(() => {
    preferredAudioModule = null;
  });

  it('detects locale from direct storage keys', () => {
    const detector = getDetector({
      normalizeAudioLocale,
      localStorageRef: createStorageStub({
        preferredAudioLanguage: 'ja-JP',
      }),
      globalCandidates: [],
      navigatorRef: {},
      documentRef: {},
    });

    expect(detector.detectPreferredAudioLanguage()).toBe('ja-jp');
  });

  it('detects locale from nested global candidates when storage has no match', () => {
    const detector = getDetector({
      normalizeAudioLocale,
      localStorageRef: createStorageStub({}),
      globalCandidates: [
        {
          app: {
            preferences: {
              preferred_audio_language: 'en-US',
            },
          },
        },
      ],
      navigatorRef: {},
      documentRef: {},
    });

    expect(detector.detectPreferredAudioLanguage()).toBe('en-us');
  });

  it('falls back to browser language signals', () => {
    const detector = getDetector({
      normalizeAudioLocale,
      localStorageRef: createStorageStub({}),
      globalCandidates: [],
      navigatorRef: {
        languages: ['fr-FR', 'en-US'],
        language: 'en-US',
      },
      documentRef: {
        documentElement: {
          lang: 'ja-JP',
        },
      },
    });

    expect(detector.detectPreferredAudioLanguage()).toBe('fr-fr');
  });

  it('returns null when no candidate can be normalized to locale format', () => {
    const detector = getDetector({
      normalizeAudioLocale,
      localStorageRef: createStorageStub({
        preferred_audio_language: 'not-a-locale',
      }),
      globalCandidates: [{ settings: { audio_locale: 'still-invalid' } }],
      navigatorRef: {
        languages: [''],
        language: '',
      },
      documentRef: {
        documentElement: {
          lang: '',
        },
      },
    });

    expect(detector.detectPreferredAudioLanguage()).toBe(null);
  });
});
