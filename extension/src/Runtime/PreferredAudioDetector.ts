type BoundaryValue = CwBoundaryValue;
type BoundaryList = BoundaryValue[];
type BoundaryRecord = Record<string, BoundaryValue>;
type UnknownFn = (...args: BoundaryList) => BoundaryValue;

type ParseJsonFn = (value: string, fallback: BoundaryValue) => BoundaryValue;
type NormalizeAudioLocaleFn = (value: BoundaryValue) => string | null;

type StorageLike = {
  getItem: (key: string) => string | null;
  key: (index: number) => string | null;
  length: number;
};

type NavigatorLike = {
  language?: BoundaryValue;
  languages?: BoundaryValue;
};

type DocumentLike = {
  documentElement?: {
    lang?: BoundaryValue;
  } | null;
};

type PreferredAudioDetectorContext = {
  normalizeAudioLocale: NormalizeAudioLocaleFn;
  parseJson: ParseJsonFn;
  storageRef: StorageLike | null;
  navigatorRef: NavigatorLike | null;
  documentRef: DocumentLike | null;
  globalCandidates: BoundaryList;
  storageScanLimit: number;
  valueScanLimit: number;
};

type PreferredAudioDetectorOptions = {
  normalizeAudioLocale?: BoundaryValue;
  parseJson?: BoundaryValue;
  localStorageRef?: BoundaryValue;
  navigatorRef?: BoundaryValue;
  documentRef?: BoundaryValue;
  globalCandidates?: BoundaryValue;
  storageScanLimit?: BoundaryValue;
  valueScanLimit?: BoundaryValue;
};

type PreferredAudioDetector = {
  detectPreferredAudioLanguage: () => string | null;
};

const AUDIO_LOCALE_FIELD_CANDIDATES = new Set([
  'preferred_audio_language',
  'preferredaudiolanguage',
  'preferred_audio_locale',
  'preferredaudiolocale',
  'default_audio_language',
  'defaultaudiolanguage',
  'default_audio_locale',
  'defaultaudiolocale',
  'audio_language',
  'audiolanguage',
  'audio_locale',
  'audiolocale',
]);

const AUDIO_LOCALE_FIELD_PATTERN = /(preferred[_-]?audio|default[_-]?audio|audio[_-]?(?:language|locale))/i;
const AUDIO_LOCALE_CONTAINER_PATTERN =
  /(settings?|prefs?|preferences?|profile|account|user|player|state|props|data|app)/i;
const INLINE_AUDIO_LOCALE_PATTERN =
  /"(?:preferred[_-]?audio(?:[_-]?(?:language|locale))|default[_-]?audio(?:[_-]?(?:language|locale))|audio[_-]?(?:language|locale))"\s*:\s*"([^"]+)"/i;

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
const rootRecord = Object(root) as BoundaryRecord;

function requireFunction<T extends UnknownFn>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing preferred-audio dependency: ${name}`);
  }
  return value as T;
}

function parseJsonFallback(value: string, fallback: BoundaryValue): BoundaryValue {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function normalizeFieldName(value: BoundaryValue): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeLikelyLocale(context: PreferredAudioDetectorContext, value: BoundaryValue): string | null {
  const normalized = context.normalizeAudioLocale(value);
  if (!normalized) {
    return null;
  }

  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){1,3}$/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function isAudioLocaleFieldName(fieldName: BoundaryValue): boolean {
  const normalized = normalizeFieldName(fieldName);
  if (!normalized) {
    return false;
  }

  if (AUDIO_LOCALE_FIELD_CANDIDATES.has(normalized)) {
    return true;
  }

  return AUDIO_LOCALE_FIELD_PATTERN.test(normalized);
}

function shouldTraverseAudioLocaleContainer(fieldName: BoundaryValue): boolean {
  return AUDIO_LOCALE_CONTAINER_PATTERN.test(normalizeFieldName(fieldName));
}

function parsePotentialJsonValue(context: PreferredAudioDetectorContext, value: BoundaryValue): BoundaryValue | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return null;
  }

  if (trimmed.length > 500000) {
    return null;
  }

  return context.parseJson(trimmed, null);
}

function extractInlineLocaleFromText(context: PreferredAudioDetectorContext, text: string): string | null {
  const inlineLocaleMatch = text.match(INLINE_AUDIO_LOCALE_PATTERN);
  if (!inlineLocaleMatch) {
    return null;
  }
  return normalizeLikelyLocale(context, inlineLocaleMatch[1]);
}

function extractAudioLocaleFromString(
  context: PreferredAudioDetectorContext,
  currentValue: string,
  queue: BoundaryList,
): string | null {
  const trimmed = currentValue.trim();
  if (!trimmed) {
    return null;
  }

  const directLocale = normalizeLikelyLocale(context, trimmed);
  if (directLocale) {
    return directLocale;
  }

  const inlineLocale = extractInlineLocaleFromText(context, trimmed);
  if (inlineLocale) {
    return inlineLocale;
  }

  const parsedJsonValue = parsePotentialJsonValue(context, trimmed);
  if (parsedJsonValue != null) {
    queue.push(parsedJsonValue);
  }

  return null;
}

function extractAudioLocaleFromObject(
  context: PreferredAudioDetectorContext,
  currentValue: object,
  queue: BoundaryList,
  visitedObjects: WeakSet<object>,
): string | null {
  if (visitedObjects.has(currentValue)) {
    return null;
  }
  visitedObjects.add(currentValue);

  if (Array.isArray(currentValue)) {
    for (const item of currentValue) {
      queue.push(item);
    }
    return null;
  }

  const entries = Object.entries(currentValue as BoundaryRecord);
  for (const [fieldName, fieldValue] of entries) {
    if (fieldValue == null) {
      continue;
    }

    if (isAudioLocaleFieldName(fieldName)) {
      if (typeof fieldValue === 'string') {
        const directFieldLocale = normalizeLikelyLocale(context, fieldValue);
        if (directFieldLocale) {
          return directFieldLocale;
        }

        const parsedFieldJson = parsePotentialJsonValue(context, fieldValue);
        if (parsedFieldJson != null) {
          queue.unshift(parsedFieldJson);
        }
      } else {
        queue.unshift(fieldValue);
      }
      continue;
    }

    if (typeof fieldValue === 'object' && shouldTraverseAudioLocaleContainer(fieldName)) {
      queue.push(fieldValue);
    }
  }

  return null;
}

function extractAudioLocaleFromUnknownInternal(
  context: PreferredAudioDetectorContext,
  sourceValue: BoundaryValue,
): string | null {
  const queue: BoundaryList = [sourceValue];
  const visitedObjects = new WeakSet<object>();
  let scannedNodes = 0;

  while (queue.length && scannedNodes < context.valueScanLimit) {
    scannedNodes += 1;
    const currentValue = queue.shift();

    if (currentValue == null) {
      continue;
    }

    if (typeof currentValue === 'string') {
      const fromString = extractAudioLocaleFromString(context, currentValue, queue);
      if (fromString) {
        return fromString;
      }
      continue;
    }

    if (typeof currentValue !== 'object') {
      continue;
    }

    const fromObject = extractAudioLocaleFromObject(context, currentValue as object, queue, visitedObjects);
    if (fromObject) {
      return fromObject;
    }
  }

  return null;
}

function detectPreferredAudioLanguageFromStorageInternal(context: PreferredAudioDetectorContext): string | null {
  const storageRef = context.storageRef;
  if (!storageRef) {
    return null;
  }

  try {
    const directStorageKeys = [
      'preferred_audio_language',
      'preferredAudioLanguage',
      'preferred_audio_locale',
      'preferredAudioLocale',
      'audio_locale',
      'audioLocale',
      'audio_language',
      'audioLanguage',
    ];

    for (const key of directStorageKeys) {
      const rawValue = storageRef.getItem(key);
      if (!rawValue) {
        continue;
      }

      const matchedLocale = extractAudioLocaleFromUnknownInternal(context, rawValue);
      if (matchedLocale) {
        return matchedLocale;
      }
    }

    const scanLimit = Math.min(context.storageScanLimit, Math.max(0, Number(storageRef.length) || 0));
    for (let index = 0; index < scanLimit; index += 1) {
      const key = storageRef.key(index);
      if (!key) {
        continue;
      }

      const normalizedKey = normalizeFieldName(key);
      if (!isAudioLocaleFieldName(normalizedKey) && !shouldTraverseAudioLocaleContainer(normalizedKey)) {
        continue;
      }

      const rawValue = storageRef.getItem(key);
      if (!rawValue) {
        continue;
      }

      const matchedLocale = extractAudioLocaleFromUnknownInternal(context, rawValue);
      if (matchedLocale) {
        return matchedLocale;
      }
    }
  } catch (_) {
    return null;
  }

  return null;
}

function detectPreferredAudioLanguageFromGlobalsInternal(context: PreferredAudioDetectorContext): string | null {
  for (const candidate of context.globalCandidates) {
    const matchedLocale = extractAudioLocaleFromUnknownInternal(context, candidate);
    if (matchedLocale) {
      return matchedLocale;
    }
  }
  return null;
}

function detectPreferredAudioLanguageFromBrowserInternal(context: PreferredAudioDetectorContext): string | null {
  const navigatorRef = context.navigatorRef;
  const documentRef = context.documentRef;
  const candidates: BoundaryList = [
    ...(Array.isArray(navigatorRef?.languages) ? (navigatorRef?.languages as BoundaryList) : []),
    navigatorRef?.language,
    documentRef?.documentElement?.lang,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeLikelyLocale(context, candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function toNumberWithMin(value: BoundaryValue, fallback: number, min: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(min, Math.floor(numberValue));
}

function toStorageRef(value: BoundaryValue): StorageLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<StorageLike>;
  if (
    typeof candidate.getItem !== 'function' ||
    typeof candidate.key !== 'function' ||
    typeof candidate.length !== 'number'
  ) {
    return null;
  }

  return candidate as StorageLike;
}

function toNavigatorRef(value: BoundaryValue): NavigatorLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as NavigatorLike;
}

function toDocumentRef(value: BoundaryValue): DocumentLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as DocumentLike;
}

function resolveGlobalCandidates(value: BoundaryValue): BoundaryList {
  if (Array.isArray(value)) {
    return [...value];
  }

  return [
    rootRecord.__INITIAL_STATE__,
    rootRecord.__NEXT_DATA__,
    rootRecord.__NUXT__,
    rootRecord.__APOLLO_STATE__,
    rootRecord.__APP_STATE__,
    rootRecord.__STATE__,
  ];
}

function createPreferredAudioDetectorContext(
  options: PreferredAudioDetectorOptions = {},
): PreferredAudioDetectorContext {
  const parseJson = typeof options.parseJson === 'function' ? (options.parseJson as ParseJsonFn) : parseJsonFallback;

  return {
    normalizeAudioLocale: requireFunction(
      'normalizeAudioLocale',
      options.normalizeAudioLocale,
    ) as NormalizeAudioLocaleFn,
    parseJson,
    storageRef: toStorageRef(options.localStorageRef) || toStorageRef(rootRecord.localStorage),
    navigatorRef: toNavigatorRef(options.navigatorRef) || toNavigatorRef(rootRecord.navigator),
    documentRef: toDocumentRef(options.documentRef) || toDocumentRef(rootRecord.document),
    globalCandidates: resolveGlobalCandidates(options.globalCandidates),
    storageScanLimit: toNumberWithMin(options.storageScanLimit, 120, 1),
    valueScanLimit: toNumberWithMin(options.valueScanLimit, 1200, 1),
  };
}

function detectPreferredAudioLanguageInternal(context: PreferredAudioDetectorContext): string | null {
  return (
    detectPreferredAudioLanguageFromStorageInternal(context) ||
    detectPreferredAudioLanguageFromGlobalsInternal(context) ||
    detectPreferredAudioLanguageFromBrowserInternal(context) ||
    null
  );
}

function createPreferredAudioDetector(options: PreferredAudioDetectorOptions = {}): PreferredAudioDetector {
  const context = createPreferredAudioDetectorContext(options);
  return {
    detectPreferredAudioLanguage: () => detectPreferredAudioLanguageInternal(context),
  };
}

const runtimePreferredAudioModule = {
  createPreferredAudioDetector,
};

export function createRuntimePreferredAudioRuntime(): object {
  return runtimePreferredAudioModule;
}
