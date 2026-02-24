;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type ParseJsonFn = (value: string, fallback: unknown) => unknown
  type NormalizeAudioLocaleFn = (value: unknown) => string | null

  type StorageLike = {
    getItem: (key: string) => string | null
    key: (index: number) => string | null
    length: number
  }

  type NavigatorLike = {
    language?: unknown
    languages?: unknown
  }

  type DocumentLike = {
    documentElement?: {
      lang?: unknown
    } | null
  }

  type PreferredAudioDetectorContext = {
    normalizeAudioLocale: NormalizeAudioLocaleFn
    parseJson: ParseJsonFn
    storageRef: StorageLike | null
    navigatorRef: NavigatorLike | null
    documentRef: DocumentLike | null
    globalCandidates: unknown[]
    storageScanLimit: number
    valueScanLimit: number
  }

  type PreferredAudioDetectorOptions = {
    normalizeAudioLocale?: unknown
    parseJson?: unknown
    localStorageRef?: unknown
    navigatorRef?: unknown
    documentRef?: unknown
    globalCandidates?: unknown
    storageScanLimit?: unknown
    valueScanLimit?: unknown
  }

  type PreferredAudioDetector = {
    detectPreferredAudioLanguage: () => string | null
  }

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
  ])

  const AUDIO_LOCALE_FIELD_PATTERN = /(preferred[_-]?audio|default[_-]?audio|audio[_-]?(?:language|locale))/i
  const AUDIO_LOCALE_CONTAINER_PATTERN =
    /(settings?|prefs?|preferences?|profile|account|user|player|state|props|data|app)/i
  const INLINE_AUDIO_LOCALE_PATTERN =
    /"(?:preferred[_-]?audio(?:[_-]?(?:language|locale))|default[_-]?audio(?:[_-]?(?:language|locale))|audio[_-]?(?:language|locale))"\s*:\s*"([^"]+)"/i

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing preferred-audio dependency: ${name}`)
    }
    return value as T
  }

  function parseJsonFallback(value: string, fallback: unknown): unknown {
    try {
      return JSON.parse(value)
    } catch (_) {
      return fallback
    }
  }

  function normalizeFieldName(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
  }

  function normalizeLikelyLocale(context: PreferredAudioDetectorContext, value: unknown): string | null {
    const normalized = context.normalizeAudioLocale(value)
    if (!normalized) {
      return null
    }

    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){1,3}$/i.test(normalized)) {
      return null
    }

    return normalized
  }

  function isAudioLocaleFieldName(fieldName: unknown): boolean {
    const normalized = normalizeFieldName(fieldName)
    if (!normalized) {
      return false
    }

    if (AUDIO_LOCALE_FIELD_CANDIDATES.has(normalized)) {
      return true
    }

    return AUDIO_LOCALE_FIELD_PATTERN.test(normalized)
  }

  function shouldTraverseAudioLocaleContainer(fieldName: unknown): boolean {
    return AUDIO_LOCALE_CONTAINER_PATTERN.test(normalizeFieldName(fieldName))
  }

  function parsePotentialJsonValue(context: PreferredAudioDetectorContext, value: unknown): unknown | null {
    if (typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
      return null
    }

    if (trimmed.length > 500000) {
      return null
    }

    return context.parseJson(trimmed, null)
  }

  function extractInlineLocaleFromText(context: PreferredAudioDetectorContext, text: string): string | null {
    const inlineLocaleMatch = text.match(INLINE_AUDIO_LOCALE_PATTERN)
    if (!inlineLocaleMatch) {
      return null
    }
    return normalizeLikelyLocale(context, inlineLocaleMatch[1])
  }

  function extractAudioLocaleFromString(
    context: PreferredAudioDetectorContext,
    currentValue: string,
    queue: unknown[],
  ): string | null {
    const trimmed = currentValue.trim()
    if (!trimmed) {
      return null
    }

    const directLocale = normalizeLikelyLocale(context, trimmed)
    if (directLocale) {
      return directLocale
    }

    const inlineLocale = extractInlineLocaleFromText(context, trimmed)
    if (inlineLocale) {
      return inlineLocale
    }

    const parsedJsonValue = parsePotentialJsonValue(context, trimmed)
    if (parsedJsonValue != null) {
      queue.push(parsedJsonValue)
    }

    return null
  }

  function extractAudioLocaleFromObject(
    context: PreferredAudioDetectorContext,
    currentValue: object,
    queue: unknown[],
    visitedObjects: WeakSet<object>,
  ): string | null {
    if (visitedObjects.has(currentValue)) {
      return null
    }
    visitedObjects.add(currentValue)

    if (Array.isArray(currentValue)) {
      for (const item of currentValue) {
        queue.push(item)
      }
      return null
    }

    const entries = Object.entries(currentValue as Record<string, unknown>)
    for (const [fieldName, fieldValue] of entries) {
      if (fieldValue == null) {
        continue
      }

      if (isAudioLocaleFieldName(fieldName)) {
        if (typeof fieldValue === 'string') {
          const directFieldLocale = normalizeLikelyLocale(context, fieldValue)
          if (directFieldLocale) {
            return directFieldLocale
          }

          const parsedFieldJson = parsePotentialJsonValue(context, fieldValue)
          if (parsedFieldJson != null) {
            queue.unshift(parsedFieldJson)
          }
        } else {
          queue.unshift(fieldValue)
        }
        continue
      }

      if (typeof fieldValue === 'object' && shouldTraverseAudioLocaleContainer(fieldName)) {
        queue.push(fieldValue)
      }
    }

    return null
  }

  function extractAudioLocaleFromUnknownInternal(
    context: PreferredAudioDetectorContext,
    sourceValue: unknown,
  ): string | null {
    const queue: unknown[] = [sourceValue]
    const visitedObjects = new WeakSet<object>()
    let scannedNodes = 0

    while (queue.length && scannedNodes < context.valueScanLimit) {
      scannedNodes += 1
      const currentValue = queue.shift()

      if (currentValue == null) {
        continue
      }

      if (typeof currentValue === 'string') {
        const fromString = extractAudioLocaleFromString(context, currentValue, queue)
        if (fromString) {
          return fromString
        }
        continue
      }

      if (typeof currentValue !== 'object') {
        continue
      }

      const fromObject = extractAudioLocaleFromObject(context, currentValue as object, queue, visitedObjects)
      if (fromObject) {
        return fromObject
      }
    }

    return null
  }

  function detectPreferredAudioLanguageFromStorageInternal(context: PreferredAudioDetectorContext): string | null {
    const storageRef = context.storageRef
    if (!storageRef) {
      return null
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
      ]

      for (const key of directStorageKeys) {
        const rawValue = storageRef.getItem(key)
        if (!rawValue) {
          continue
        }

        const matchedLocale = extractAudioLocaleFromUnknownInternal(context, rawValue)
        if (matchedLocale) {
          return matchedLocale
        }
      }

      const scanLimit = Math.min(context.storageScanLimit, Math.max(0, Number(storageRef.length) || 0))
      for (let index = 0; index < scanLimit; index += 1) {
        const key = storageRef.key(index)
        if (!key) {
          continue
        }

        const normalizedKey = normalizeFieldName(key)
        if (!isAudioLocaleFieldName(normalizedKey) && !shouldTraverseAudioLocaleContainer(normalizedKey)) {
          continue
        }

        const rawValue = storageRef.getItem(key)
        if (!rawValue) {
          continue
        }

        const matchedLocale = extractAudioLocaleFromUnknownInternal(context, rawValue)
        if (matchedLocale) {
          return matchedLocale
        }
      }
    } catch (_) {
      return null
    }

    return null
  }

  function detectPreferredAudioLanguageFromGlobalsInternal(context: PreferredAudioDetectorContext): string | null {
    for (const candidate of context.globalCandidates) {
      const matchedLocale = extractAudioLocaleFromUnknownInternal(context, candidate)
      if (matchedLocale) {
        return matchedLocale
      }
    }
    return null
  }

  function detectPreferredAudioLanguageFromBrowserInternal(context: PreferredAudioDetectorContext): string | null {
    const navigatorRef = context.navigatorRef
    const documentRef = context.documentRef
    const candidates: unknown[] = [
      ...(Array.isArray(navigatorRef?.languages) ? (navigatorRef?.languages as unknown[]) : []),
      navigatorRef?.language,
      documentRef?.documentElement?.lang,
    ]

    for (const candidate of candidates) {
      const normalized = normalizeLikelyLocale(context, candidate)
      if (normalized) {
        return normalized
      }
    }

    return null
  }

  function toNumberWithMin(value: unknown, fallback: number, min: number): number {
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) {
      return fallback
    }

    return Math.max(min, Math.floor(numberValue))
  }

  function toStorageRef(value: unknown): StorageLike | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const candidate = value as Partial<StorageLike>
    if (
      typeof candidate.getItem !== 'function' ||
      typeof candidate.key !== 'function' ||
      typeof candidate.length !== 'number'
    ) {
      return null
    }

    return candidate as StorageLike
  }

  function toNavigatorRef(value: unknown): NavigatorLike | null {
    if (!value || typeof value !== 'object') {
      return null
    }
    return value as NavigatorLike
  }

  function toDocumentRef(value: unknown): DocumentLike | null {
    if (!value || typeof value !== 'object') {
      return null
    }
    return value as DocumentLike
  }

  function resolveGlobalCandidates(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return [...value]
    }

    const rootRecord = root as unknown as Record<string, unknown>
    return [
      rootRecord.__INITIAL_STATE__,
      rootRecord.__NEXT_DATA__,
      rootRecord.__NUXT__,
      rootRecord.__APOLLO_STATE__,
      rootRecord.__APP_STATE__,
      rootRecord.__STATE__,
    ]
  }

  function createPreferredAudioDetectorContext(
    options: PreferredAudioDetectorOptions = {},
  ): PreferredAudioDetectorContext {
    const parseJson = typeof options.parseJson === 'function' ? (options.parseJson as ParseJsonFn) : parseJsonFallback

    return {
      normalizeAudioLocale: requireFunction(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ) as NormalizeAudioLocaleFn,
      parseJson,
      storageRef:
        toStorageRef(options.localStorageRef) ||
        toStorageRef((root as unknown as Record<string, unknown>).localStorage),
      navigatorRef:
        toNavigatorRef(options.navigatorRef) || toNavigatorRef((root as unknown as Record<string, unknown>).navigator),
      documentRef:
        toDocumentRef(options.documentRef) || toDocumentRef((root as unknown as Record<string, unknown>).document),
      globalCandidates: resolveGlobalCandidates(options.globalCandidates),
      storageScanLimit: toNumberWithMin(options.storageScanLimit, 120, 1),
      valueScanLimit: toNumberWithMin(options.valueScanLimit, 1200, 1),
    }
  }

  function detectPreferredAudioLanguageInternal(context: PreferredAudioDetectorContext): string | null {
    return (
      detectPreferredAudioLanguageFromStorageInternal(context) ||
      detectPreferredAudioLanguageFromGlobalsInternal(context) ||
      detectPreferredAudioLanguageFromBrowserInternal(context) ||
      null
    )
  }

  function createPreferredAudioDetector(options: PreferredAudioDetectorOptions = {}): PreferredAudioDetector {
    const context = createPreferredAudioDetectorContext(options)
    return {
      detectPreferredAudioLanguage: () => detectPreferredAudioLanguageInternal(context),
    }
  }

  moduleRegistry.runtimePreferredAudio = {
    createPreferredAudioDetector,
  }
})()
