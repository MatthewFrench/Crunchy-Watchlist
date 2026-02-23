(() => {
  const getExtensionVersion = () => {
    try {
      if (typeof browser !== "undefined" && browser.runtime && typeof browser.runtime.getManifest === "function") {
        return browser.runtime.getManifest().version || "0";
      }
      if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getManifest === "function") {
        return chrome.runtime.getManifest().version || "0";
      }
    } catch (_) {
      return "0";
    }
    return "0";
  };

  const extensionVersion = getExtensionVersion();
  const previousLoad = window.__CW_WATCHLIST_CURATOR_LOADED__;

  if (previousLoad && typeof previousLoad === "object" && previousLoad.version === extensionVersion) {
    return;
  }
  window.__CW_WATCHLIST_CURATOR_LOADED__ = {
    version: extensionVersion
  };

  if (window.top !== window) {
    return;
  }

  const SETTINGS_KEY = "cw_settings_v1";
  const RATING_CACHE_KEY = "cw_rating_cache_v2";
  const WATCH_HISTORY_CACHE_KEY = "cw_watch_history_cache_v1";
  const WATCHLIST_CACHE_KEY = "cw_watchlist_cache_v1";
  const WATCH_HISTORY_CACHE_VERSION = 3;
  const RATING_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  const WATCH_HISTORY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  const WATCHLIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const PROCESS_DEBOUNCE_MS = 180;
  const WATCHLIST_PAGE_SIZE = 100;
  const WATCHLIST_MAX_PAGES = 30;
  const WATCHLIST_REVALIDATE_COOLDOWN_MS = 90 * 1000;
  const WATCH_HISTORY_PAGE_SIZE = 100;
  const WATCH_HISTORY_MAX_PAGES = 40;
  const WATCH_HISTORY_NO_MATCH_PAGE_LIMIT = 5;
  const RATING_BATCH_SIZE = 50;
  const FETCH_TIMEOUT_MS = 12000;
  const FETCH_MAX_ATTEMPTS = 3;
  const FETCH_BACKOFF_BASE_MS = 400;
  const FETCH_BACKOFF_JITTER_MS = 220;
  const AUTH_CLIENT_BASIC = "Basic bm9haWhkZXZtXzZpeWcwYThsMHE6";
  const AUTH_DEVICE_KEY = "cw_auth_device_id_v1";
  const AUTH_TOKEN_SKEW_MS = 60 * 1000;
  const PREVIEW_HOVER_DELAY_MS = 220;
  const PREFERRED_AUDIO_CACHE_TTL_MS = 2 * 60 * 1000;
  const PREFERRED_AUDIO_STORAGE_SCAN_LIMIT = 120;
  const PREFERRED_AUDIO_VALUE_SCAN_LIMIT = 1200;
  const API_TRACE_LIMIT_PER_ENDPOINT = 30;
  const DEFAULT_SORT_MODE = "consensus_quality_desc";
  const VALID_SORT_MODES = new Set([
    "none",
    "rating_desc",
    "rating_asc",
    "hidden_gems_desc",
    "consensus_quality_desc",
    "controversial_desc",
    "quality_floor_asc",
    "quick_wins_asc",
    "dormant_backlog_asc",
    "rewatch_memory_desc",
    "date_added_desc",
    "date_added_asc",
    "date_updated_desc",
    "date_updated_asc",
    "votes_desc",
    "star_points_desc",
    "star_5_desc",
    "star_4_desc",
    "star_3_desc",
    "star_2_desc",
    "star_1_desc",
    "star_5_pct_desc",
    "star_4_pct_desc",
    "star_3_pct_desc",
    "star_2_pct_desc",
    "star_1_pct_desc"
  ]);

  const DEFAULT_SETTINGS = {
    activeTab: "curated",
    watchReadyFilterMode: "hide",
    audioLocaleFilter: "any",
    genreFilter: "any",
    cardLayout: "portrait",
    sortMode: DEFAULT_SORT_MODE
  };

  const state = {
    mounted: false,
    observer: null,
    routeWatcherStarted: false,
    routeSyncTimer: null,
    processTimer: null,
    saveRatingsTimer: null,
    saveWatchHistoryTimer: null,
    saveWatchlistCacheTimer: null,
    settings: { ...DEFAULT_SETTINGS },
    ratingCache: {},
    ratingInflight: new Map(),
    ratingLocalePreloadInflight: new Map(),
    watchHistoryLocalePreloadInflight: new Map(),
    watchHistoryCache: {
      version: WATCH_HISTORY_CACHE_VERSION,
      accountId: "",
      updatedAt: 0,
      bySeriesId: {},
      bySeriesIdAudioLocale: {},
      bySeriesIdProgress: {},
      bySeriesIdAudioLocaleProgress: {}
    },
    watchHistoryStatus: "idle",
    watchlistCache: {
      accountId: "",
      updatedAt: 0,
      rows: []
    },
    watchHistoryInflight: null,
    preferredAudioLanguage: null,
    preferredAudioLanguageUpdatedAt: 0,
    apiTrace: {
      authToken: [],
      watchlist: [],
      watchHistory: [],
      cmsObjects: [],
      legacyRating: [],
      preview: []
    },
    previewCache: {},
    previewInflight: new Map(),
    authToken: null,
    authTokenInflight: null,
    curatedEntries: [],
    curatedError: null,
    curatedSource: "none",
    curatedInflight: null,
    curatedObservedPromise: null,
    curatedLastRevalidateAt: 0,
    mutationMuted: false,
    hostEl: null,
    tabCrunchyrollEl: null,
    tabCuratedEl: null,
    curatedPanelEl: null,
    controlsEl: null,
    loadingIndicatorEl: null,
    audioFilterSelectEl: null,
    genreFilterSelectEl: null,
    statsEl: null,
    gridEl: null,
    curatedGridRenderSignature: "",
    framedRootEl: null,
    nativeHiddenNodes: []
  };

  const runtime = (() => {
    const existing = window.__CW_WATCHLIST_CURATOR_RUNTIME__;
    if (existing && typeof existing === "object") {
      return existing;
    }

    const created = {
      phase: "boot",
      events: []
    };
    window.__CW_WATCHLIST_CURATOR_RUNTIME__ = created;
    return created;
  })();

  const storageLocal =
    (typeof browser !== "undefined" && browser.storage && browser.storage.local) ||
    (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) ||
    null;

  function runtimeEvent(event, data) {
    runtime.phase = event;
    runtime.events.push({
      at: Date.now(),
      event,
      data: data ?? null
    });

    if (runtime.events.length > 100) {
      runtime.events.shift();
    }
  }

  function cloneJsonValue(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return null;
    }
  }

  function pushApiTrace(endpoint, record) {
    if (!endpoint || !state.apiTrace || typeof state.apiTrace !== "object") {
      return;
    }

    if (!Array.isArray(state.apiTrace[endpoint])) {
      return;
    }

    const normalizedRecord = cloneJsonValue(record);
    if (normalizedRecord == null) {
      return;
    }

    const bucket = state.apiTrace[endpoint];
    bucket.push(normalizedRecord);

    if (bucket.length > API_TRACE_LIMIT_PER_ENDPOINT) {
      bucket.splice(0, bucket.length - API_TRACE_LIMIT_PER_ENDPOINT);
    }
  }

  function queryFirst(selectors, root = document) {
    for (const selector of selectors) {
      const found = root.querySelector(selector);
      if (found) {
        return found;
      }
    }
    return null;
  }

  function isWatchlistPath(pathname) {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length > 0 && segments[segments.length - 1] === "watchlist";
  }

  function getWatchlistRoot() {
    return queryFirst([".erc-watchlist", '[data-t="watchlist-page"]']);
  }

  function getWatchlistHeader() {
    return queryFirst([
      ".erc-watchlist .watchlist-header",
      '.erc-watchlist [class*="watchlist-header"]',
      ".erc-watchlist .erc-watchlist-controls",
      '.erc-watchlist [class*="watchlist-controls"]'
    ]);
  }

  function debounceProcess() {
    clearTimeout(state.processTimer);
    state.processTimer = window.setTimeout(() => {
      processWatchlist().catch(() => {
        // no-op
      });
    }, PROCESS_DEBOUNCE_MS);
  }

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  async function storageGet(key, fallback) {
    if (storageLocal && typeof storageLocal.get === "function") {
      if (storageLocal.get.length <= 1) {
        try {
          const result = await storageLocal.get(key);
          return result && result[key] != null ? result[key] : fallback;
        } catch (_) {
          return fallback;
        }
      }

      return new Promise((resolve) => {
        let resolved = false;

        const timer = window.setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(fallback);
          }
        }, 1500);

        try {
          storageLocal.get([key], (result) => {
            if (resolved) {
              return;
            }

            resolved = true;
            clearTimeout(timer);
            const value = result && result[key] != null ? result[key] : fallback;
            resolve(value);
          });
        } catch (_) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve(fallback);
          }
        }
      });
    }

    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch (_) {
      return fallback;
    }

    if (raw == null) {
      return fallback;
    }

    return safeJsonParse(raw, fallback);
  }

  async function storageSet(key, value) {
    if (storageLocal && typeof storageLocal.set === "function") {
      if (storageLocal.set.length <= 1) {
        try {
          await storageLocal.set({ [key]: value });
        } catch (_) {
          // no-op
        }
        return;
      }

      await new Promise((resolve) => {
        try {
          storageLocal.set({ [key]: value }, () => resolve());
        } catch (_) {
          resolve();
        }
      });
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // no-op
    }
  }

  function scheduleSaveRatings() {
    clearTimeout(state.saveRatingsTimer);
    state.saveRatingsTimer = window.setTimeout(() => {
      storageSet(RATING_CACHE_KEY, state.ratingCache).catch(() => {
        // no-op
      });
    }, 250);
  }

  function scheduleSaveWatchHistory() {
    clearTimeout(state.saveWatchHistoryTimer);
    state.saveWatchHistoryTimer = window.setTimeout(() => {
      storageSet(WATCH_HISTORY_CACHE_KEY, state.watchHistoryCache).catch(() => {
        // no-op
      });
    }, 250);
  }

  function scheduleSaveWatchlistCache() {
    clearTimeout(state.saveWatchlistCacheTimer);
    state.saveWatchlistCacheTimer = window.setTimeout(() => {
      storageSet(WATCHLIST_CACHE_KEY, state.watchlistCache).catch(() => {
        // no-op
      });
    }, 250);
  }

  function sanitizeRating(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0 || number > 5) {
      return null;
    }
    return Math.round(number * 10) / 10;
  }

  function sanitizeVotes(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      return null;
    }
    return Math.round(number);
  }

  function sanitizePositiveInt(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return null;
    }
    return Math.round(number);
  }

  function parseDateMs(value) {
    if (value == null) {
      return null;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      if (value > 1e12) {
        return Math.round(value);
      }
      if (value > 1e9) {
        return Math.round(value * 1000);
      }
      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return parseDateMs(numeric);
      }

      const parsed = Date.parse(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  function pickFirstDateMs(values) {
    for (const value of values) {
      const parsed = parseDateMs(value);
      if (parsed != null) {
        return parsed;
      }
    }
    return null;
  }

  function pickFirstPositiveInt(values) {
    for (const value of values) {
      const parsed = sanitizePositiveInt(value);
      if (parsed != null) {
        return parsed;
      }
    }
    return null;
  }

  function sanitizePercentage(value) {
    if (value == null) {
      return null;
    }

    const normalized = typeof value === "string" ? value.replace("%", "").trim() : value;
    const number = Number(normalized);
    if (!Number.isFinite(number) || number < 0 || number > 100) {
      return null;
    }

    return Math.round(number);
  }

  function normalizeAudioLocales(locales) {
    if (!Array.isArray(locales)) {
      return [];
    }

    const dedup = new Set();
    const normalized = [];

    locales.forEach((locale) => {
      const value = String(locale || "").trim();
      if (!value) {
        return;
      }

      const key = value.toLowerCase();
      if (dedup.has(key)) {
        return;
      }

      dedup.add(key);
      normalized.push(value);
    });

    return normalized;
  }

  function normalizeAudioLocale(locale) {
    const normalized = normalizeAudioLocales([locale]);
    return normalized.length ? normalized[0] : null;
  }

  function normalizeLikelyLocale(value) {
    const normalized = normalizeAudioLocale(value);
    if (!normalized) {
      return null;
    }

    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){1,3}$/i.test(normalized)) {
      return null;
    }

    return normalized;
  }

  const AUDIO_LOCALE_FIELD_CANDIDATES = new Set([
    "preferred_audio_language",
    "preferredaudiolanguage",
    "preferred_audio_locale",
    "preferredaudiolocale",
    "default_audio_language",
    "defaultaudiolanguage",
    "default_audio_locale",
    "defaultaudiolocale",
    "audio_language",
    "audiolanguage",
    "audio_locale",
    "audiolocale"
  ]);

  const AUDIO_LOCALE_FIELD_PATTERN = /(preferred[_-]?audio|default[_-]?audio|audio[_-]?(?:language|locale))/i;
  const AUDIO_LOCALE_CONTAINER_PATTERN = /(settings?|prefs?|preferences?|profile|account|user|player|state|props|data|app)/i;

  function isAudioLocaleFieldName(fieldName) {
    const normalized = String(fieldName || "").trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (AUDIO_LOCALE_FIELD_CANDIDATES.has(normalized)) {
      return true;
    }

    return AUDIO_LOCALE_FIELD_PATTERN.test(normalized);
  }

  function shouldTraverseAudioLocaleContainer(fieldName) {
    return AUDIO_LOCALE_CONTAINER_PATTERN.test(String(fieldName || "").trim().toLowerCase());
  }

  function parsePotentialJsonValue(value) {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
      return null;
    }

    if (trimmed.length > 500000) {
      return null;
    }

    return safeJsonParse(trimmed, null);
  }

  function extractAudioLocaleFromUnknown(sourceValue) {
    const queue = [sourceValue];
    const visitedObjects = new WeakSet();
    let scannedNodes = 0;

    while (queue.length && scannedNodes < PREFERRED_AUDIO_VALUE_SCAN_LIMIT) {
      scannedNodes += 1;
      const currentValue = queue.shift();

      if (currentValue == null) {
        continue;
      }

      if (typeof currentValue === "string") {
        const trimmed = currentValue.trim();
        if (!trimmed) {
          continue;
        }

        const directLocale = normalizeLikelyLocale(trimmed);
        if (directLocale) {
          return directLocale;
        }

        const inlineLocaleMatch = trimmed.match(
          /"(?:preferred[_-]?audio(?:[_-]?(?:language|locale))|default[_-]?audio(?:[_-]?(?:language|locale))|audio[_-]?(?:language|locale))"\s*:\s*"([^"]+)"/i
        );
        if (inlineLocaleMatch) {
          const matchedLocale = normalizeLikelyLocale(inlineLocaleMatch[1]);
          if (matchedLocale) {
            return matchedLocale;
          }
        }

        const parsedJsonValue = parsePotentialJsonValue(trimmed);
        if (parsedJsonValue != null) {
          queue.push(parsedJsonValue);
        }

        continue;
      }

      if (typeof currentValue !== "object") {
        continue;
      }

      if (visitedObjects.has(currentValue)) {
        continue;
      }
      visitedObjects.add(currentValue);

      if (Array.isArray(currentValue)) {
        for (let index = 0; index < currentValue.length; index += 1) {
          queue.push(currentValue[index]);
        }
        continue;
      }

      const entries = Object.entries(currentValue);
      for (const [fieldName, fieldValue] of entries) {
        if (fieldValue == null) {
          continue;
        }

        if (isAudioLocaleFieldName(fieldName)) {
          if (typeof fieldValue === "string") {
            const directFieldLocale = normalizeLikelyLocale(fieldValue);
            if (directFieldLocale) {
              return directFieldLocale;
            }

            const parsedFieldJson = parsePotentialJsonValue(fieldValue);
            if (parsedFieldJson != null) {
              queue.unshift(parsedFieldJson);
            }
          } else {
            queue.unshift(fieldValue);
          }
          continue;
        }

        if (typeof fieldValue === "object" && shouldTraverseAudioLocaleContainer(fieldName)) {
          queue.push(fieldValue);
        }
      }
    }

    return null;
  }

  function detectPreferredAudioLanguageFromStorage() {
    if (typeof localStorage === "undefined") {
      return null;
    }

    try {
      const directStorageKeys = [
        "preferred_audio_language",
        "preferredAudioLanguage",
        "preferred_audio_locale",
        "preferredAudioLocale",
        "audio_locale",
        "audioLocale",
        "audio_language",
        "audioLanguage"
      ];

      for (const key of directStorageKeys) {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) {
          continue;
        }

        const matchedLocale = extractAudioLocaleFromUnknown(rawValue);
        if (matchedLocale) {
          return matchedLocale;
        }
      }

      const scanLimit = Math.min(PREFERRED_AUDIO_STORAGE_SCAN_LIMIT, Math.max(0, localStorage.length));
      for (let index = 0; index < scanLimit; index += 1) {
        const key = localStorage.key(index);
        if (!key) {
          continue;
        }

        const normalizedKey = key.trim().toLowerCase();
        if (!isAudioLocaleFieldName(normalizedKey) && !shouldTraverseAudioLocaleContainer(normalizedKey)) {
          continue;
        }

        const rawValue = localStorage.getItem(key);
        if (!rawValue) {
          continue;
        }

        const matchedLocale = extractAudioLocaleFromUnknown(rawValue);
        if (matchedLocale) {
          return matchedLocale;
        }
      }
    } catch (_) {
      return null;
    }

    return null;
  }

  function detectPreferredAudioLanguageFromGlobals() {
    const globalCandidates = [
      window.__INITIAL_STATE__,
      window.__NEXT_DATA__,
      window.__NUXT__,
      window.__APOLLO_STATE__,
      window.__APP_STATE__,
      window.__STATE__
    ];

    for (const candidate of globalCandidates) {
      const matchedLocale = extractAudioLocaleFromUnknown(candidate);
      if (matchedLocale) {
        return matchedLocale;
      }
    }

    return null;
  }

  function detectPreferredAudioLanguageFromBrowser() {
    const candidates = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
      document?.documentElement?.lang
    ];

    for (const candidate of candidates) {
      const normalized = normalizeLikelyLocale(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  function normalizeTagList(values) {
    if (!Array.isArray(values)) {
      return [];
    }

    const seen = new Set();
    const normalized = [];

    values.forEach((value) => {
      const text = String(value || "").trim();
      if (!text) {
        return;
      }

      const key = text.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      normalized.push(text);
    });

    return normalized;
  }

  function hasEnUsAudio(locales) {
    return normalizeAudioLocales(locales).some((locale) => locale.toLowerCase() === "en-us");
  }

  function formatEpisodeIdentifier(seasonNumber, episodeNumber) {
    const season = sanitizePositiveInt(seasonNumber);
    const episode = sanitizePositiveInt(episodeNumber);

    if (season != null && episode != null) {
      return `S${season} E${episode}`;
    }

    if (episode != null) {
      return `E${episode}`;
    }

    return null;
  }

  function parseRatingPayload(payload) {
    const candidateRating = [
      payload?.rating?.average,
      payload?.rating?.value,
      payload?.average,
      payload?.data?.average,
      payload?.data?.rating,
      payload?.data?.[0]?.rating?.average,
      payload?.data?.[0]?.rating?.value,
      payload?.result?.average,
      payload?.aggregateRating?.ratingValue,
      payload?.aggregateRating?.rating
    ]
      .map(sanitizeRating)
      .find((value) => value != null);

    const candidateVotes = [
      payload?.rating?.count,
      payload?.rating?.total,
      payload?.count,
      payload?.total,
      payload?.data?.count,
      payload?.data?.total,
      payload?.data?.[0]?.rating?.count,
      payload?.data?.[0]?.rating?.total,
      payload?.aggregateRating?.ratingCount
    ]
      .map(sanitizeVotes)
      .find((value) => value != null);

    let rating = candidateRating ?? null;
    let votes = candidateVotes ?? null;

    if (rating == null || votes == null) {
      const serialized = JSON.stringify(payload || {});

      if (rating == null) {
        const ratingMatch = serialized.match(/\"(?:average|ratingValue|rating)\"\s*:\s*\"?([0-5](?:\\.\d+)?)\"?/i);
        if (ratingMatch) {
          rating = sanitizeRating(ratingMatch[1]);
        }
      }

      if (votes == null) {
        const votesMatch = serialized.match(/\"(?:ratingCount|votes|total|count)\"\s*:\s*\"?(\d{1,10})\"?/i);
        if (votesMatch) {
          votes = sanitizeVotes(votesMatch[1]);
        }
      }
    }

    return { rating, votes };
  }

  function parseRatingDistribution(ratingBlock) {
    if (!ratingBlock || typeof ratingBlock !== "object") {
      return null;
    }

    const distribution = {};
    let hasAny = false;

    for (let star = 1; star <= 5; star += 1) {
      const bucket = ratingBlock[`${star}s`];
      const percentage = sanitizePercentage(bucket?.percentage ?? bucket?.displayed);
      distribution[String(star)] = percentage;
      if (percentage != null) {
        hasAny = true;
      }
    }

    return hasAny ? distribution : null;
  }

  function parseCmsObjectRecord(record) {
    const seriesId = typeof record?.id === "string" ? record.id : null;
    const parsedRating = parseRatingPayload(record);
    const seriesMetadata = record?.series_metadata || {};
    const audioLocales = normalizeAudioLocales(seriesMetadata?.audio_locales || []);
    const description = typeof record?.description === "string" ? record.description.trim() : "";
    const episodeCount = sanitizePositiveInt(seriesMetadata?.episode_count);
    const seasonCount = sanitizePositiveInt(seriesMetadata?.season_count);
    const genreTags = normalizeTagList([...(seriesMetadata?.genres || []), ...(seriesMetadata?.tenant_categories || [])]);
    const coverImages = extractCoverImagesFromApiImages(record?.images);

    return {
      seriesId,
      rating: parsedRating.rating,
      votes: parsedRating.votes,
      distribution: parseRatingDistribution(record?.rating),
      audioLocales,
      description,
      episodeCount,
      seasonCount,
      genreTags,
      portraitImageUrl: coverImages.portrait,
      landscapeImageUrl: coverImages.landscape
    };
  }

  function normalizeAudioLocaleCountMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const normalizedMap = {};
    Object.entries(value).forEach(([localeKey, countValue]) => {
      const locale = normalizeAudioLocale(localeKey);
      const count = sanitizePositiveInt(countValue);
      if (!locale || count == null) {
        return;
      }

      normalizedMap[locale.toLowerCase()] = count;
    });

    return normalizedMap;
  }

  function mergeAudioLocaleCountMap(previousMap, audioLocale, count) {
    const merged = { ...normalizeAudioLocaleCountMap(previousMap) };
    const locale = normalizeAudioLocale(audioLocale);
    const normalizedCount = sanitizePositiveInt(count);

    if (locale && normalizedCount != null) {
      merged[locale.toLowerCase()] = normalizedCount;
    }

    return merged;
  }

  function getAudioLocaleCountFromMap(map, audioLocale) {
    const locale = normalizeAudioLocale(audioLocale);
    if (!locale) {
      return null;
    }

    const normalizedMap = normalizeAudioLocaleCountMap(map);
    return sanitizePositiveInt(normalizedMap[locale.toLowerCase()]);
  }

  function mergeCachedSeriesData(seriesId, nextData) {
    const previous = state.ratingCache[seriesId] && typeof state.ratingCache[seriesId] === "object"
      ? state.ratingCache[seriesId]
      : {};
    const preferredAudioLocale = normalizeAudioLocale(nextData.preferredAudioLocale);
    const normalizedEpisodeCount = sanitizePositiveInt(nextData.episodeCount);
    const normalizedSeasonCount = sanitizePositiveInt(nextData.seasonCount);
    const episodeCountByAudioLocale = mergeAudioLocaleCountMap(
      previous.episodeCountByAudioLocale,
      preferredAudioLocale,
      normalizedEpisodeCount
    );
    const seasonCountByAudioLocale = mergeAudioLocaleCountMap(
      previous.seasonCountByAudioLocale,
      preferredAudioLocale,
      normalizedSeasonCount
    );

    state.ratingCache[seriesId] = {
      rating: nextData.rating ?? previous.rating ?? null,
      votes: nextData.votes ?? previous.votes ?? null,
      distribution: nextData.distribution ?? previous.distribution ?? null,
      audioLocales:
        Array.isArray(nextData.audioLocales) && nextData.audioLocales.length
          ? normalizeAudioLocales(nextData.audioLocales)
          : normalizeAudioLocales(previous.audioLocales || []),
      description:
        typeof nextData.description === "string" && nextData.description.trim()
          ? nextData.description.trim()
          : typeof previous.description === "string"
            ? previous.description
            : "",
      episodeCount: normalizedEpisodeCount ?? sanitizePositiveInt(previous.episodeCount),
      seasonCount: normalizedSeasonCount ?? sanitizePositiveInt(previous.seasonCount),
      episodeCountByAudioLocale,
      seasonCountByAudioLocale,
      genreTags:
        Array.isArray(nextData.genreTags) && nextData.genreTags.length
          ? normalizeTagList(nextData.genreTags)
          : normalizeTagList(previous.genreTags || []),
      portraitImageUrl: normalizeImageUrlCandidate(nextData.portraitImageUrl) || normalizeImageUrlCandidate(previous.portraitImageUrl),
      landscapeImageUrl: normalizeImageUrlCandidate(nextData.landscapeImageUrl) || normalizeImageUrlCandidate(previous.landscapeImageUrl),
      updatedAt: Date.now()
    };

    return state.ratingCache[seriesId];
  }

  function isCacheValid(entry) {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    if (!Object.prototype.hasOwnProperty.call(entry, "distribution")) {
      return false;
    }

    if (!Array.isArray(entry.audioLocales)) {
      return false;
    }

    if (typeof entry.description !== "string") {
      return false;
    }

    if (!Object.prototype.hasOwnProperty.call(entry, "episodeCount")) {
      return false;
    }

    if (!Object.prototype.hasOwnProperty.call(entry, "seasonCount")) {
      return false;
    }

    if (!Array.isArray(entry.genreTags)) {
      return false;
    }

    // Bust older cache schema so we can use layout-aware cover art fields.
    if (!Object.prototype.hasOwnProperty.call(entry, "portraitImageUrl")) {
      return false;
    }

    if (!Object.prototype.hasOwnProperty.call(entry, "landscapeImageUrl")) {
      return false;
    }

    if (typeof entry.updatedAt !== "number") {
      return false;
    }

    return Date.now() - entry.updatedAt < RATING_CACHE_TTL_MS;
  }

  function isWatchHistoryCacheValid(cache, accountId) {
    if (!cache || typeof cache !== "object") {
      return false;
    }

    if (Number(cache.version) !== WATCH_HISTORY_CACHE_VERSION) {
      return false;
    }

    if (!cache.bySeriesId || typeof cache.bySeriesId !== "object" || Array.isArray(cache.bySeriesId)) {
      return false;
    }

    if (typeof cache.updatedAt !== "number") {
      return false;
    }

    if (typeof accountId === "string" && accountId && cache.accountId !== accountId) {
      return false;
    }

    return Date.now() - cache.updatedAt < WATCH_HISTORY_CACHE_TTL_MS;
  }

  function extractSeasonCoreFromSeasonId(value) {
    if (value == null) {
      return null;
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }

    const seasonIdMatch = text.match(/^GS(\d+)(?:[A-Z]{4})?$/i);
    if (seasonIdMatch && seasonIdMatch[1]) {
      return sanitizePositiveInt(seasonIdMatch[1]);
    }

    const compactMatch = text.match(/^S(\d+)$/i);
    if (compactMatch && compactMatch[1]) {
      return sanitizePositiveInt(compactMatch[1]);
    }

    return null;
  }

  function parseCanonicalEpisodeIdentifier(value) {
    if (value == null) {
      return null;
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }

    const match = text.match(/^([^|]+)\|S(\d+)\|E(\d+)$/i);
    if (!match) {
      return null;
    }

    const seriesId = String(match[1] || "").trim();
    const seasonCore = sanitizePositiveInt(match[2]);
    const episodeNumber = sanitizePositiveInt(match[3]);

    if (!seriesId || seasonCore == null || episodeNumber == null) {
      return null;
    }

    return {
      seriesId,
      seasonCore,
      episodeNumber,
      canonicalEpisodeKey: `${seriesId}|S${seasonCore}|E${episodeNumber}`
    };
  }

  function buildCanonicalEpisodeKey(seriesId, seasonCore, episodeNumber) {
    const normalizedSeriesId = typeof seriesId === "string" ? seriesId.trim() : "";
    const normalizedSeasonCore = sanitizePositiveInt(seasonCore);
    const normalizedEpisodeNumber = sanitizePositiveInt(episodeNumber);

    if (!normalizedSeriesId || normalizedSeasonCore == null || normalizedEpisodeNumber == null) {
      return null;
    }

    return `${normalizedSeriesId}|S${normalizedSeasonCore}|E${normalizedEpisodeNumber}`;
  }

  function deriveCanonicalEpisodeKeyFromEpisodeMetadata(meta, fallbackSeriesId = null) {
    const parsedIdentifier = parseCanonicalEpisodeIdentifier(meta?.identifier);
    if (parsedIdentifier) {
      if (!fallbackSeriesId || parsedIdentifier.seriesId === fallbackSeriesId) {
        return parsedIdentifier.canonicalEpisodeKey;
      }
    }

    const seriesId = typeof fallbackSeriesId === "string" && fallbackSeriesId
      ? fallbackSeriesId
      : (typeof meta?.series_id === "string" ? meta.series_id : "");
    const seasonCore = pickFirstPositiveInt([
      extractSeasonCoreFromSeasonId(meta?.season_id),
      sanitizePositiveInt(meta?.season_number)
    ]);
    const episodeNumber = sanitizePositiveInt(meta?.episode_number);

    return buildCanonicalEpisodeKey(seriesId, seasonCore, episodeNumber);
  }

  function getAbsoluteEpisodeNumberFromEpisodeMetadata(meta) {
    const seasonNumber = sanitizePositiveInt(meta?.season_number);
    const episodeNumber = sanitizePositiveInt(meta?.episode_number);
    return pickFirstPositiveInt([
      sanitizePositiveInt(meta?.sequence_number),
      sanitizePositiveInt(meta?.episode_sequence_number),
      sanitizePositiveInt(meta?.global_episode_number),
      sanitizePositiveInt(meta?.global_episode_num),
      seasonNumber === 1 ? episodeNumber : null
    ]);
  }

  function getEpisodeAvailabilityByAudioLocale(meta) {
    const absoluteEpisodeNumber = getAbsoluteEpisodeNumberFromEpisodeMetadata(meta);
    if (absoluteEpisodeNumber == null) {
      return {};
    }

    const byAudioLocale = {};
    const panelAudioLocale = normalizeAudioLocale(meta?.audio_locale);
    if (panelAudioLocale) {
      byAudioLocale[panelAudioLocale.toLowerCase()] = absoluteEpisodeNumber;
    }

    if (Array.isArray(meta?.versions)) {
      meta.versions.forEach((version) => {
        const locale = normalizeAudioLocale(version?.audio_locale);
        if (!locale) {
          return;
        }

        const localeKey = locale.toLowerCase();
        const previous = sanitizePositiveInt(byAudioLocale[localeKey]) ?? 0;
        byAudioLocale[localeKey] = Math.max(previous, absoluteEpisodeNumber);
      });
    }

    return byAudioLocale;
  }

  function mergeEpisodeAvailabilityByAudioLocale(previousMap, nextMap) {
    const merged = { ...normalizeAudioLocaleCountMap(previousMap) };
    if (!nextMap || typeof nextMap !== "object" || Array.isArray(nextMap)) {
      return merged;
    }

    Object.entries(nextMap).forEach(([localeKey, value]) => {
      const locale = normalizeAudioLocale(localeKey);
      const absoluteEpisodeNumber = sanitizePositiveInt(value);
      if (!locale || absoluteEpisodeNumber == null) {
        return;
      }

      const storageKey = locale.toLowerCase();
      const previous = sanitizePositiveInt(merged[storageKey]) ?? 0;
      merged[storageKey] = Math.max(previous, absoluteEpisodeNumber);
    });

    return merged;
  }

  function getWatchHistoryProgressIndex(value) {
    const absoluteEpisodeNumber = pickFirstPositiveInt([
      sanitizePositiveInt(value?.absoluteEpisodeNumber),
      sanitizePositiveInt(value?.sequenceNumber),
      sanitizePositiveInt(value?.sequence_number)
    ]);
    if (absoluteEpisodeNumber != null) {
      return absoluteEpisodeNumber;
    }

    const seasonNumber = sanitizePositiveInt(value?.seasonNumber);
    const episodeNumber = sanitizePositiveInt(value?.episodeNumber);
    if (seasonNumber != null && episodeNumber != null) {
      return seasonNumber * 100000 + episodeNumber;
    }

    return null;
  }

  function shouldReplaceWatchHistoryProgress(previous, next) {
    if (!previous) {
      return true;
    }

    const previousAudioInferred = Boolean(previous?.audioLocaleInferred);
    const nextAudioInferred = Boolean(next?.audioLocaleInferred);
    const previousDateMs = parseDateMs(previous?.datePlayedMs ?? previous?.datePlayed) ?? 0;
    const nextDateMs = parseDateMs(next?.datePlayedMs ?? next?.datePlayed) ?? 0;

    if (previousAudioInferred !== nextAudioInferred) {
      return !nextAudioInferred;
    }

    if (previousAudioInferred && nextAudioInferred) {
      if (nextDateMs !== previousDateMs) {
        return nextDateMs > previousDateMs;
      }
    }

    const previousIndex = getWatchHistoryProgressIndex(previous);
    const nextIndex = getWatchHistoryProgressIndex(next);

    if (nextIndex != null && previousIndex != null && nextIndex !== previousIndex) {
      return nextIndex > previousIndex;
    }

    if (nextIndex != null && previousIndex == null) {
      return true;
    }

    if (nextIndex == null && previousIndex != null) {
      return false;
    }

    const previousCompleted = Boolean(previous?.fullyWatched);
    const nextCompleted = Boolean(next?.fullyWatched);
    if (nextCompleted !== previousCompleted) {
      return nextCompleted;
    }

    return nextDateMs > previousDateMs;
  }

  function normalizeWatchHistoryEntry(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const datePlayedMs = parseDateMs(value.datePlayedMs ?? value.datePlayed);
    if (datePlayedMs == null) {
      return null;
    }

    const seasonNumber = sanitizePositiveInt(value.seasonNumber ?? value?.panel?.episode_metadata?.season_number);
    const episodeNumber = sanitizePositiveInt(value.episodeNumber ?? value?.panel?.episode_metadata?.episode_number);
    const absoluteEpisodeNumber = pickFirstPositiveInt([
      sanitizePositiveInt(value.absoluteEpisodeNumber),
      sanitizePositiveInt(value.sequenceNumber),
      sanitizePositiveInt(value.sequence_number),
      sanitizePositiveInt(value?.panel?.episode_metadata?.sequence_number),
      sanitizePositiveInt(value?.panel?.episode_metadata?.episode_sequence_number),
      sanitizePositiveInt(value?.panel?.episode_metadata?.global_episode_number),
      sanitizePositiveInt(value?.panel?.episode_metadata?.global_episode_num),
      seasonNumber === 1 ? episodeNumber : null
    ]);
    const audioLocale = normalizeAudioLocale(
      value.audioLocale ??
      value.audio_locale ??
      value?.panel?.episode_metadata?.audio_locale ??
      value?.panel?.audio_locale
    );
    const seriesId = typeof value?.seriesId === "string"
      ? value.seriesId
      : (typeof value?.panel?.episode_metadata?.series_id === "string" ? value.panel.episode_metadata.series_id : "");
    const episodeId = typeof value?.episodeId === "string"
      ? value.episodeId
      : (typeof value?.id === "string"
        ? value.id
        : (typeof value?.panel?.id === "string" ? value.panel.id : null));
    const identifier = typeof value?.identifier === "string"
      ? value.identifier
      : (typeof value?.panel?.episode_metadata?.identifier === "string"
        ? value.panel.episode_metadata.identifier
        : "");
    const canonicalEpisodeKey =
      typeof value?.canonicalEpisodeKey === "string" && value.canonicalEpisodeKey
        ? value.canonicalEpisodeKey
        : deriveCanonicalEpisodeKeyFromEpisodeMetadata(value?.panel?.episode_metadata || {}, seriesId);

    return {
      seriesId,
      datePlayedMs,
      datePlayed: new Date(datePlayedMs).toISOString(),
      seasonNumber,
      episodeNumber,
      absoluteEpisodeNumber,
      episodeId,
      identifier,
      canonicalEpisodeKey,
      episodeTitle: typeof value.episodeTitle === "string"
        ? value.episodeTitle
        : (typeof value?.panel?.title === "string" ? value.panel.title : ""),
      playhead: Number(value.playhead || 0),
      fullyWatched: Boolean(value.fullyWatched ?? value.fully_watched),
      audioLocale,
      audioLocaleInferred: Boolean(value?.audioLocaleInferred)
    };
  }

  function normalizeStoredWatchHistoryBySeriesAudioLocale(raw) {
    if (!raw || typeof raw !== "object") {
      return {};
    }

    const normalizedBySeries = {};

    Object.entries(raw).forEach(([seriesId, localeMapValue]) => {
      if (!seriesId || !localeMapValue || typeof localeMapValue !== "object" || Array.isArray(localeMapValue)) {
        return;
      }

      const normalizedLocaleMap = {};

      Object.entries(localeMapValue).forEach(([localeKey, entryValue]) => {
        const normalizedEntry = normalizeWatchHistoryEntry(entryValue);
        if (!normalizedEntry) {
          return;
        }

        const locale = normalizeAudioLocale(normalizedEntry.audioLocale || localeKey);
        if (!locale) {
          return;
        }

        const localeStorageKey = locale.toLowerCase();
        const previousEntry = normalizedLocaleMap[localeStorageKey];
        if (!previousEntry || normalizedEntry.datePlayedMs > previousEntry.datePlayedMs) {
          normalizedLocaleMap[localeStorageKey] = {
            ...normalizedEntry,
            audioLocale: locale
          };
        }
      });

      if (Object.keys(normalizedLocaleMap).length) {
        normalizedBySeries[seriesId] = normalizedLocaleMap;
      }
    });

    return normalizedBySeries;
  }

  function normalizeStoredWatchHistoryCache(raw) {
    if (!raw || typeof raw !== "object") {
      return {
        version: WATCH_HISTORY_CACHE_VERSION,
        accountId: "",
        updatedAt: 0,
        bySeriesId: {},
        bySeriesIdAudioLocale: {},
        bySeriesIdProgress: {},
        bySeriesIdAudioLocaleProgress: {}
      };
    }

    const bySeriesIdRaw = raw.bySeriesId && typeof raw.bySeriesId === "object" ? raw.bySeriesId : {};
    const bySeriesId = {};

    Object.entries(bySeriesIdRaw).forEach(([seriesId, value]) => {
      if (!seriesId) {
        return;
      }
      const normalized = normalizeWatchHistoryEntry(value);
      if (normalized) {
        bySeriesId[seriesId] = normalized;
      }
    });

    const bySeriesIdAudioLocale = normalizeStoredWatchHistoryBySeriesAudioLocale(raw.bySeriesIdAudioLocale);
    const bySeriesIdProgressRaw =
      raw.bySeriesIdProgress && typeof raw.bySeriesIdProgress === "object"
        ? raw.bySeriesIdProgress
        : {};
    const bySeriesIdProgress = {};

    Object.entries(bySeriesIdProgressRaw).forEach(([seriesId, value]) => {
      if (!seriesId) {
        return;
      }
      const normalized = normalizeWatchHistoryEntry(value);
      if (normalized) {
        bySeriesIdProgress[seriesId] = normalized;
      }
    });

    const bySeriesIdAudioLocaleProgress = normalizeStoredWatchHistoryBySeriesAudioLocale(raw.bySeriesIdAudioLocaleProgress);

    return {
      version: Number(raw.version) || 0,
      accountId: typeof raw.accountId === "string" ? raw.accountId : "",
      updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
      bySeriesId,
      bySeriesIdAudioLocale,
      bySeriesIdProgress,
      bySeriesIdAudioLocaleProgress
    };
  }

  function normalizeStoredWatchlistCache(raw) {
    if (!raw || typeof raw !== "object") {
      return {
        accountId: "",
        updatedAt: 0,
        rows: []
      };
    }

    const rows = Array.isArray(raw.rows)
      ? raw.rows.filter((row) => row && typeof row === "object")
      : [];

    return {
      accountId: typeof raw.accountId === "string" ? raw.accountId : "",
      updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
      rows
    };
  }

  function isWatchlistCacheValid(cache, accountId) {
    if (!cache || typeof cache !== "object") {
      return false;
    }

    if (!Array.isArray(cache.rows)) {
      return false;
    }

    if (typeof cache.updatedAt !== "number") {
      return false;
    }

    if (typeof accountId === "string" && accountId && cache.accountId && cache.accountId !== accountId) {
      return false;
    }

    if (!cache.rows.length) {
      return false;
    }

    return Date.now() - cache.updatedAt < WATCHLIST_CACHE_TTL_MS;
  }

  function getCachedWatchHistoryFromBuckets(
    seriesBucket,
    seriesByLocaleBucket,
    seriesId,
    audioLocale = null,
    allowSeriesFallback = true
  ) {
    if (!seriesId || !seriesBucket || typeof seriesBucket !== "object") {
      return null;
    }

    const normalizedAudioLocale = normalizeAudioLocale(audioLocale);
    if (normalizedAudioLocale) {
      const perSeriesLocaleMap =
        seriesByLocaleBucket &&
        typeof seriesByLocaleBucket === "object" &&
        !Array.isArray(seriesByLocaleBucket[seriesId]) &&
        typeof seriesByLocaleBucket[seriesId] === "object"
          ? seriesByLocaleBucket[seriesId]
          : null;

      if (perSeriesLocaleMap) {
        const matchedByLocale = normalizeWatchHistoryEntry(perSeriesLocaleMap[normalizedAudioLocale.toLowerCase()]);
        if (matchedByLocale) {
          return {
            ...matchedByLocale,
            audioLocale: normalizeAudioLocale(matchedByLocale.audioLocale) || normalizedAudioLocale
          };
        }
      }
    }

    if (!allowSeriesFallback) {
      return null;
    }

    return normalizeWatchHistoryEntry(seriesBucket[seriesId]);
  }

  function getCachedWatchHistory(seriesId, audioLocale = null, allowSeriesFallback = true) {
    if (!seriesId || !state.watchHistoryCache || typeof state.watchHistoryCache !== "object") {
      return null;
    }

    const bySeriesId = state.watchHistoryCache.bySeriesId;
    const bySeriesIdAudioLocale = state.watchHistoryCache.bySeriesIdAudioLocale;
    if (!bySeriesId || typeof bySeriesId !== "object") {
      return null;
    }

    return getCachedWatchHistoryFromBuckets(
      bySeriesId,
      bySeriesIdAudioLocale,
      seriesId,
      audioLocale,
      allowSeriesFallback
    );
  }

  function getCachedWatchHistoryProgress(seriesId, audioLocale = null, allowSeriesFallback = true) {
    if (!seriesId || !state.watchHistoryCache || typeof state.watchHistoryCache !== "object") {
      return null;
    }

    const bySeriesIdProgress = state.watchHistoryCache.bySeriesIdProgress;
    const bySeriesIdAudioLocaleProgress = state.watchHistoryCache.bySeriesIdAudioLocaleProgress;
    if (!bySeriesIdProgress || typeof bySeriesIdProgress !== "object") {
      return null;
    }

    return getCachedWatchHistoryFromBuckets(
      bySeriesIdProgress,
      bySeriesIdAudioLocaleProgress,
      seriesId,
      audioLocale,
      allowSeriesFallback
    );
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function parseRetryAfterMs(response) {
    try {
      const raw = response?.headers?.get("retry-after");
      if (!raw) {
        return null;
      }

      const seconds = Number(raw);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(30000, Math.round(seconds * 1000));
      }

      const when = Date.parse(raw);
      if (Number.isFinite(when)) {
        return Math.min(30000, Math.max(0, when - Date.now()));
      }
    } catch (_) {
      // no-op
    }

    return null;
  }

  function computeFetchRetryDelayMs(attemptNumber, response) {
    const retryAfterMs = parseRetryAfterMs(response);
    if (retryAfterMs != null) {
      return retryAfterMs;
    }

    const exponent = Math.max(0, Number(attemptNumber) - 1);
    const exponential = FETCH_BACKOFF_BASE_MS * (2 ** exponent);
    const jitter = Math.round(Math.random() * FETCH_BACKOFF_JITTER_MS);
    return Math.min(10000, exponential + jitter);
  }

  function shouldRetryStatus(statusCode) {
    const status = Number(statusCode);
    return status === 429 || (status >= 500 && status < 600);
  }

  function makeApiContractError(endpointName, message, extra = {}) {
    runtimeEvent("api-contract-error", {
      endpoint: endpointName,
      message,
      ...extra
    });
    return new Error(`Crunchyroll API contract changed for ${endpointName}: ${message}`);
  }

  function emitApiContractWarning(endpointName, message, extra = {}) {
    runtimeEvent("api-contract-warning", {
      endpoint: endpointName,
      message,
      ...extra
    });
  }

  function requirePayloadDataArray(endpointName, payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray(payload.data)) {
      throw makeApiContractError(endpointName, "expected a JSON object with a data[] array");
    }
    return payload.data;
  }

  function auditWatchlistRowsContract(rows) {
    let missingPanelCount = 0;
    let missingSeriesCount = 0;
    let missingEpisodeMetaCount = 0;

    rows.forEach((row) => {
      if (!row || typeof row !== "object") {
        missingPanelCount += 1;
        return;
      }

      if (!row.panel || typeof row.panel !== "object") {
        missingPanelCount += 1;
        return;
      }

      if (!row.panel.episode_metadata || typeof row.panel.episode_metadata !== "object") {
        missingEpisodeMetaCount += 1;
      }

      if (!getWatchlistSeriesId(row)) {
        missingSeriesCount += 1;
      }
    });

    if (missingPanelCount || missingEpisodeMetaCount || missingSeriesCount) {
      emitApiContractWarning("watchlist", "rows are missing expected fields", {
        rowCount: rows.length,
        missingPanelCount,
        missingEpisodeMetaCount,
        missingSeriesCount
      });
    }
  }

  function auditWatchHistoryRowsContract(rows) {
    let missingSeriesCount = 0;
    let missingDatePlayedCount = 0;

    rows.forEach((row) => {
      if (!getWatchHistorySeriesId(row)) {
        missingSeriesCount += 1;
      }
      if (parseDateMs(row?.date_played) == null) {
        missingDatePlayedCount += 1;
      }
    });

    if (missingSeriesCount || missingDatePlayedCount) {
      emitApiContractWarning("watch-history", "rows are missing expected fields", {
        rowCount: rows.length,
        missingSeriesCount,
        missingDatePlayedCount
      });
    }
  }

  function auditCmsObjectContract(records) {
    let missingIdCount = 0;
    let missingSeriesMetadataCount = 0;
    let missingRatingCount = 0;

    records.forEach((record) => {
      if (!record || typeof record !== "object") {
        missingIdCount += 1;
        missingSeriesMetadataCount += 1;
        missingRatingCount += 1;
        return;
      }

      if (typeof record.id !== "string" || !record.id) {
        missingIdCount += 1;
      }
      if (!record.series_metadata || typeof record.series_metadata !== "object") {
        missingSeriesMetadataCount += 1;
      }
      if (!record.rating || typeof record.rating !== "object") {
        missingRatingCount += 1;
      }
    });

    if (missingIdCount || missingSeriesMetadataCount) {
      emitApiContractWarning("cms-objects", "records are missing expected fields", {
        recordCount: records.length,
        missingIdCount,
        missingSeriesMetadataCount,
        missingRatingCount
      });
    }
  }

  function createAuthRefreshHandler(tokenEntry) {
    return async () => {
      const refreshed = await getAccessToken(true);
      if (!refreshed?.accessToken) {
        return "";
      }

      if (tokenEntry && typeof tokenEntry === "object") {
        tokenEntry.accessToken = refreshed.accessToken;
        tokenEntry.expiresAt = refreshed.expiresAt;
        if (typeof refreshed.accountId === "string" && refreshed.accountId) {
          tokenEntry.accountId = refreshed.accountId;
        }
      }

      return refreshed.accessToken;
    };
  }

  async function fetchWithResilience(url, init = {}, options = {}) {
    const label = typeof options.label === "string" && options.label.trim() ? options.label.trim() : "request";
    const timeoutMs = sanitizePositiveInt(options.timeoutMs) ?? FETCH_TIMEOUT_MS;
    const maxAttempts = Math.max(1, sanitizePositiveInt(options.maxAttempts) ?? FETCH_MAX_ATTEMPTS);
    const retryNetworkErrors = options.retryNetworkErrors !== false;

    let attempt = 0;
    let lastErrorMessage = "";
    let hasTriedRefresh = false;
    let bearerToken = typeof options.bearerToken === "string" ? options.bearerToken : "";

    while (attempt < maxAttempts) {
      attempt += 1;
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutId = controller
        ? window.setTimeout(() => {
            try {
              controller.abort();
            } catch (_) {
              // no-op
            }
          }, timeoutMs)
        : null;

      try {
        const headers = new Headers(init.headers || {});
        if (bearerToken) {
          headers.set("authorization", `Bearer ${bearerToken}`);
        }

        const response = await fetch(url, {
          ...init,
          headers,
          signal: controller ? controller.signal : init.signal
        });

        if (timeoutId != null) {
          clearTimeout(timeoutId);
        }

        if (response.status === 401 && !hasTriedRefresh && typeof options.refreshBearerToken === "function") {
          hasTriedRefresh = true;
          try {
            const refreshed = await options.refreshBearerToken();
            if (typeof refreshed === "string" && refreshed) {
              bearerToken = refreshed;
              runtimeEvent("fetch-auth-refresh", { label, attempt });
              continue;
            }
          } catch (_) {
            // no-op
          }
        }

        if (response.ok) {
          return response;
        }

        if (attempt < maxAttempts && shouldRetryStatus(response.status)) {
          const delayMs = computeFetchRetryDelayMs(attempt, response);
          runtimeEvent("fetch-retry", {
            label,
            attempt,
            status: response.status,
            delayMs
          });
          await sleep(delayMs);
          continue;
        }

        throw new Error(`${label} failed: ${response.status}`);
      } catch (error) {
        if (timeoutId != null) {
          clearTimeout(timeoutId);
        }

        const aborted = error?.name === "AbortError";
        const message = aborted ? "timeout" : error?.message || "network failure";
        lastErrorMessage = message;

        if (attempt < maxAttempts && retryNetworkErrors && !/failed:\s*\d{3}\b/.test(String(message))) {
          const delayMs = computeFetchRetryDelayMs(attempt, null);
          runtimeEvent("fetch-retry", {
            label,
            attempt,
            reason: message,
            delayMs
          });
          await sleep(delayMs);
          continue;
        }

        throw new Error(`${label} failed: ${message}`);
      }
    }

    throw new Error(`${label} failed: ${lastErrorMessage || "exhausted retries"}`);
  }

  function generateDeviceId() {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch (_) {
      // no-op
    }

    return `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getOrCreateDeviceId() {
    try {
      const existing = localStorage.getItem(AUTH_DEVICE_KEY);
      if (existing) {
        return existing;
      }

      const created = generateDeviceId();
      localStorage.setItem(AUTH_DEVICE_KEY, created);
      return created;
    } catch (_) {
      return generateDeviceId();
    }
  }

  function getAuthDeviceType() {
    const userAgent = typeof navigator.userAgent === "string" ? navigator.userAgent : "";
    const platform = typeof navigator.platform === "string" && navigator.platform.trim() ? navigator.platform.trim() : "Unknown";

    if (/\bEdg\//.test(userAgent)) {
      return `Edge on ${platform}`;
    }

    if (/\bFirefox\//.test(userAgent)) {
      return `Firefox on ${platform}`;
    }

    if (/\bChrome\//.test(userAgent) || /\bChromium\//.test(userAgent)) {
      return `Chrome on ${platform}`;
    }

    if (/\bSafari\//.test(userAgent)) {
      return `Safari on ${platform}`;
    }

    return `Browser on ${platform}`;
  }

  function isAuthTokenValid(tokenEntry) {
    return (
      tokenEntry &&
      typeof tokenEntry === "object" &&
      typeof tokenEntry.accessToken === "string" &&
      tokenEntry.accessToken.length > 10 &&
      typeof tokenEntry.expiresAt === "number" &&
      tokenEntry.expiresAt - Date.now() > AUTH_TOKEN_SKEW_MS
    );
  }

  async function requestAccessToken() {
    const body = new URLSearchParams({
      device_id: getOrCreateDeviceId(),
      device_type: getAuthDeviceType(),
      grant_type: "etp_rt_cookie"
    });

    const response = await fetchWithResilience(
      resolveApiHref("/auth/v1/token"),
      {
        method: "POST",
        credentials: "include",
        headers: {
          authorization: AUTH_CLIENT_BASIC,
          "content-type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      },
      {
        label: "auth token request",
        maxAttempts: 2
      }
    );

    if (!response.ok) {
      throw new Error(`auth token request failed: ${response.status}`);
    }

    const payload = await response.json();
    pushApiTrace("authToken", {
      at: Date.now(),
      request: {
        url: resolveApiHref("/auth/v1/token"),
        grant_type: "etp_rt_cookie"
      },
      response: {
        account_id: typeof payload?.account_id === "string" ? payload.account_id : null,
        expires_in: Number(payload?.expires_in || 0) || null,
        token_type: typeof payload?.token_type === "string" ? payload.token_type : null,
        country: typeof payload?.country === "string" ? payload.country : null
      }
    });
    const accessToken = typeof payload?.access_token === "string" ? payload.access_token : "";
    const expiresInSeconds = Number(payload?.expires_in || 0);
    const accountId = payload?.account_id || null;

    if (!accessToken) {
      throw new Error("auth token missing access_token");
    }

    const expiresAt =
      Date.now() + (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds * 1000 : 15 * 60 * 1000);

    return {
      accessToken,
      accountId,
      expiresAt
    };
  }

  async function getAccessToken(forceRefresh = false) {
    if (!forceRefresh && isAuthTokenValid(state.authToken)) {
      return state.authToken;
    }

    if (!forceRefresh && state.authTokenInflight) {
      return state.authTokenInflight;
    }

    const inflight = (async () => {
      try {
        const tokenEntry = await requestAccessToken();
        state.authToken = tokenEntry;
        runtimeEvent("auth-token-ready", {
          hasAccountId: !!tokenEntry.accountId
        });
        return tokenEntry;
      } catch (_) {
        runtimeEvent("auth-token-failed");
        state.authToken = null;
        return null;
      } finally {
        if (state.authTokenInflight === inflight) {
          state.authTokenInflight = null;
        }
      }
    })();

    state.authTokenInflight = inflight;
    return inflight;
  }

  function chunkArray(values, chunkSize) {
    if (!Array.isArray(values) || !values.length || chunkSize <= 0) {
      return [];
    }

    const chunks = [];
    for (let i = 0; i < values.length; i += chunkSize) {
      chunks.push(values.slice(i, i + chunkSize));
    }
    return chunks;
  }

  function getLocale() {
    return (navigator.language || "en-US").trim() || "en-US";
  }

  function getPreferredAudioLanguage() {
    const now = Date.now();
    if (
      state.preferredAudioLanguage &&
      now - state.preferredAudioLanguageUpdatedAt < PREFERRED_AUDIO_CACHE_TTL_MS
    ) {
      return state.preferredAudioLanguage;
    }

    const detectedPreferredAudioLanguage =
      detectPreferredAudioLanguageFromStorage() ||
      detectPreferredAudioLanguageFromGlobals() ||
      detectPreferredAudioLanguageFromBrowser() ||
      "en-US";
    const normalizedPreferredAudioLanguage = normalizeLikelyLocale(detectedPreferredAudioLanguage) || "en-US";
    const previousPreferredAudioLanguage = state.preferredAudioLanguage;

    state.preferredAudioLanguage = normalizedPreferredAudioLanguage;
    state.preferredAudioLanguageUpdatedAt = now;

    if (previousPreferredAudioLanguage !== normalizedPreferredAudioLanguage) {
      runtimeEvent("preferred-audio-language-detected", {
        locale: normalizedPreferredAudioLanguage
      });
    }

    return normalizedPreferredAudioLanguage;
  }

  async function fetchWatchlistPage(tokenEntry, start) {
    const accountId = tokenEntry?.accountId;
    const params = new URLSearchParams({
      order: "desc",
      n: String(WATCHLIST_PAGE_SIZE),
      preferred_audio_language: getPreferredAudioLanguage(),
      locale: getLocale()
    });

    if (start > 0) {
      params.set("start", String(start));
    }

    const url = resolveApiHref(`/content/v2/discover/${encodeURIComponent(accountId)}/watchlist?${params.toString()}`);
    const response = await fetchWithResilience(
      url,
      {
        credentials: "include"
      },
      {
        label: "watchlist page request",
        bearerToken: tokenEntry?.accessToken,
        refreshBearerToken: createAuthRefreshHandler(tokenEntry)
      }
    );

    if (!response.ok) {
      throw new Error(`watchlist page request failed: ${response.status}`);
    }

    const payload = await response.json();
    const rows = requirePayloadDataArray("watchlist", payload);
    auditWatchlistRowsContract(rows);
    const total = Number(payload?.total || rows.length);

    pushApiTrace("watchlist", {
      at: Date.now(),
      request: {
        url,
        start: Math.max(0, Number(start) || 0),
        n: WATCHLIST_PAGE_SIZE,
        preferred_audio_language: params.get("preferred_audio_language"),
        locale: params.get("locale")
      },
      response: {
        total,
        rowCount: rows.length
      },
      data: rows
    });

    return {
      rows,
      total
    };
  }

  function getWatchlistSeriesId(entry) {
    return entry?.panel?.episode_metadata?.series_id || entry?.panel?.series_metadata?.series_id || null;
  }

  async function fetchAllWatchlistRows(tokenEntry) {
    const allRows = [];
    const seenRowKeys = new Set();
    let start = 0;
    let total = null;
    let pages = 0;

    while (pages < WATCHLIST_MAX_PAGES) {
      pages += 1;
      const page = await fetchWatchlistPage(tokenEntry, start);

      if (total == null) {
        total = page.total;
      }

      page.rows.forEach((row) => {
        const seriesId = getWatchlistSeriesId(row) || "";
        const panelId = typeof row?.panel?.id === "string" ? row.panel.id : "";
        const rowKey = `${seriesId}|${panelId}`;
        if (rowKey !== "|" && seenRowKeys.has(rowKey)) {
          return;
        }
        if (rowKey !== "|") {
          seenRowKeys.add(rowKey);
        }
        allRows.push(row);
      });
      start += WATCHLIST_PAGE_SIZE;

      if (page.rows.length < WATCHLIST_PAGE_SIZE) {
        break;
      }
      if (total != null && start >= total) {
        break;
      }
    }

    return allRows;
  }

  async function fetchWatchHistoryPage(tokenEntry, pageNumber, preferredAudioLanguage = getPreferredAudioLanguage()) {
    const accountId = tokenEntry?.accountId;
    const effectivePreferredAudioLanguage =
      normalizeAudioLocale(preferredAudioLanguage) || getPreferredAudioLanguage();
    const params = new URLSearchParams({
      page_size: String(WATCH_HISTORY_PAGE_SIZE),
      preferred_audio_language: effectivePreferredAudioLanguage,
      locale: getLocale()
    });

    if (pageNumber > 1) {
      params.set("page", String(pageNumber));
    }

    const url = resolveApiHref(`/content/v2/${encodeURIComponent(accountId)}/watch-history?${params.toString()}`);
    const response = await fetchWithResilience(
      url,
      {
        credentials: "include"
      },
      {
        label: "watch history page request",
        bearerToken: tokenEntry?.accessToken,
        refreshBearerToken: createAuthRefreshHandler(tokenEntry)
      }
    );

    if (!response.ok) {
      throw new Error(`watch history page request failed: ${response.status}`);
    }

    const payload = await response.json();
    const rows = requirePayloadDataArray("watch-history", payload);
    auditWatchHistoryRowsContract(rows);
    const total = Number(payload?.total || rows.length);

    pushApiTrace("watchHistory", {
      at: Date.now(),
      request: {
        url,
        page: Math.max(1, Number(pageNumber) || 1),
        page_size: WATCH_HISTORY_PAGE_SIZE,
        preferred_audio_language: params.get("preferred_audio_language"),
        locale: params.get("locale")
      },
      response: {
        total,
        rowCount: rows.length
      },
      data: rows
    });

    return {
      rows,
      total
    };
  }

  function getWatchHistorySeriesId(entry) {
    return entry?.panel?.episode_metadata?.series_id || entry?.panel?.series_metadata?.series_id || null;
  }

  function getWatchlistSeriesTitle(entry) {
    return (
      entry?.panel?.episode_metadata?.series_title ||
      entry?.panel?.series_metadata?.title ||
      entry?.panel?.title ||
      ""
    );
  }

  function getWatchHistorySeriesTitle(entry) {
    return (
      entry?.panel?.episode_metadata?.series_title ||
      entry?.panel?.series_metadata?.title ||
      entry?.panel?.title ||
      ""
    );
  }

  function getKnownSeriesCandidates() {
    const bySeriesId = new Map();

    const addCandidate = (seriesId, title) => {
      const normalizedSeriesId = typeof seriesId === "string" ? seriesId.trim() : "";
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      if (!normalizedSeriesId) {
        return;
      }

      if (bySeriesId.has(normalizedSeriesId)) {
        const existing = bySeriesId.get(normalizedSeriesId);
        if (!existing.title && normalizedTitle) {
          existing.title = normalizedTitle;
        }
        return;
      }

      bySeriesId.set(normalizedSeriesId, {
        seriesId: normalizedSeriesId,
        title: normalizedTitle
      });
    };

    state.curatedEntries.forEach((entry) => {
      addCandidate(entry?.seriesId, entry?.title || "");
    });

    if (Array.isArray(state.watchlistCache?.rows)) {
      state.watchlistCache.rows.forEach((row) => {
        addCandidate(getWatchlistSeriesId(row), getWatchlistSeriesTitle(row));
      });
    }

    if (Array.isArray(state.apiTrace?.watchlist)) {
      state.apiTrace.watchlist.forEach((record) => {
        (Array.isArray(record?.data) ? record.data : []).forEach((row) => {
          addCandidate(getWatchlistSeriesId(row), getWatchlistSeriesTitle(row));
        });
      });
    }

    if (Array.isArray(state.apiTrace?.watchHistory)) {
      state.apiTrace.watchHistory.forEach((record) => {
        (Array.isArray(record?.data) ? record.data : []).forEach((row) => {
          addCandidate(getWatchHistorySeriesId(row), getWatchHistorySeriesTitle(row));
        });
      });
    }

    return Array.from(bySeriesId.values()).sort((left, right) => {
      const leftTitle = String(left.title || left.seriesId).toLowerCase();
      const rightTitle = String(right.title || right.seriesId).toLowerCase();
      return leftTitle.localeCompare(rightTitle);
    });
  }

  function resolveSeriesCandidate(query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) {
      return null;
    }

    const knownCandidates = getKnownSeriesCandidates();

    const exactSeriesIdMatch = knownCandidates.find((candidate) => candidate.seriesId.toLowerCase() === normalizedQuery);
    if (exactSeriesIdMatch) {
      return exactSeriesIdMatch;
    }

    const exactTitleMatch = knownCandidates.find((candidate) => candidate.title.toLowerCase() === normalizedQuery);
    if (exactTitleMatch) {
      return exactTitleMatch;
    }

    return knownCandidates.find((candidate) => candidate.title.toLowerCase().includes(normalizedQuery)) || null;
  }

  function mapApiTraceRowsBySeries(bucket, seriesId, rowSeriesIdGetter) {
    if (!Array.isArray(bucket) || !seriesId) {
      return [];
    }

    return bucket
      .map((record) => {
        const rows = Array.isArray(record?.data) ? record.data : [];
        const matchedRows = rows.filter((row) => rowSeriesIdGetter(row) === seriesId);
        if (!matchedRows.length) {
          return null;
        }

        return {
          ...record,
          response: {
            ...(record?.response || {}),
            matchedRowCount: matchedRows.length
          },
          data: matchedRows
        };
      })
      .filter(Boolean);
  }

  function buildSeriesApiDataDump(query) {
    const matchedSeries = resolveSeriesCandidate(query);
    if (!matchedSeries) {
      return {
        query,
        error: "Series not found in current extension data.",
        availableSeries: getKnownSeriesCandidates()
      };
    }

    const seriesId = matchedSeries.seriesId;
    const apis = {};

    const watchlistCalls = mapApiTraceRowsBySeries(state.apiTrace.watchlist, seriesId, getWatchlistSeriesId);
    if (watchlistCalls.length) {
      apis["/content/v2/discover/{account_id}/watchlist"] = watchlistCalls;
    }

    const watchHistoryCalls = mapApiTraceRowsBySeries(state.apiTrace.watchHistory, seriesId, getWatchHistorySeriesId);
    if (watchHistoryCalls.length) {
      apis["/content/v2/{account_id}/watch-history"] = watchHistoryCalls;
    }

    const cmsCalls = mapApiTraceRowsBySeries(state.apiTrace.cmsObjects, seriesId, (row) => row?.id || null);
    if (cmsCalls.length) {
      apis["/content/v2/cms/objects/{series_ids}"] = cmsCalls;
    }

    const legacyRatingCalls = (Array.isArray(state.apiTrace.legacyRating) ? state.apiTrace.legacyRating : []).filter(
      (record) => record?.request?.seriesId === seriesId
    );
    if (legacyRatingCalls.length) {
      apis["/content-reviews/v3/rating/series/{series_id}"] = legacyRatingCalls;
    }

    const previewCalls = (Array.isArray(state.apiTrace.preview) ? state.apiTrace.preview : []).filter(
      (record) => record?.request?.seriesId === seriesId
    );
    if (previewCalls.length) {
      apis["/content/v2/cms/videos/{video_id}/streams"] = previewCalls;
    }

    return {
      query,
      generatedAt: new Date().toISOString(),
      matchedSeries,
      apis
    };
  }

  function exposeDebugApi() {
    window.__CW_WATCHLIST_CURATOR_DEBUG__ = {
      listSeries: () => getKnownSeriesCandidates(),
      dumpSeriesApiData: (query) => buildSeriesApiDataDump(query),
      printSeriesApiData: (query) => {
        const dump = buildSeriesApiDataDump(query);
        try {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(dump, null, 2));
        } catch (_) {
          // no-op
        }
        return dump;
      }
    };
  }

  function parseWatchHistoryRow(entry, fallbackAudioLocale = null) {
    const seriesId = getWatchHistorySeriesId(entry);
    if (!seriesId) {
      return null;
    }

    const datePlayedMs = parseDateMs(entry?.date_played);
    if (datePlayedMs == null) {
      return null;
    }

    const meta = entry?.panel?.episode_metadata || {};
    const seasonNumber = sanitizePositiveInt(meta?.season_number);
    const episodeNumber = sanitizePositiveInt(meta?.episode_number);
    const absoluteEpisodeNumber = getAbsoluteEpisodeNumberFromEpisodeMetadata(meta);
    const explicitAudioLocale = normalizeAudioLocale(
      meta?.audio_locale ||
      entry?.panel?.audio_locale ||
      entry?.audio_locale ||
      entry?.audioLocale
    );
    const audioLocale = explicitAudioLocale || normalizeAudioLocale(fallbackAudioLocale);
    const identifier = typeof meta?.identifier === "string" ? meta.identifier : "";
    const canonicalEpisodeKey = deriveCanonicalEpisodeKeyFromEpisodeMetadata(meta, seriesId);
    const episodeId = typeof entry?.id === "string"
      ? entry.id
      : (typeof entry?.panel?.id === "string" ? entry.panel.id : null);

    return {
      seriesId,
      datePlayedMs,
      datePlayed: new Date(datePlayedMs).toISOString(),
      seasonNumber,
      episodeNumber,
      absoluteEpisodeNumber,
      episodeId,
      identifier,
      canonicalEpisodeKey,
      episodeTitle: typeof entry?.panel?.title === "string" ? entry.panel.title : "",
      playhead: Number(entry?.playhead || 0),
      fullyWatched: Boolean(entry?.fully_watched),
      audioLocale,
      audioLocaleInferred: !explicitAudioLocale && Boolean(audioLocale)
    };
  }

  async function fetchRatingsBatch(tokenEntry, seriesIds, preferredAudioLanguage = getPreferredAudioLanguage()) {
    if (!Array.isArray(seriesIds) || !seriesIds.length) {
      return [];
    }

    const effectivePreferredAudioLanguage = normalizeAudioLocale(preferredAudioLanguage) || getPreferredAudioLanguage();
    const cmsUrl = resolveApiHref(
      `/content/v2/cms/objects/${seriesIds.map((id) => encodeURIComponent(id)).join(",")}` +
        `?ratings=true&preferred_audio_language=${encodeURIComponent(effectivePreferredAudioLanguage)}` +
        `&locale=${encodeURIComponent(getLocale())}`
    );

    const response = await fetchWithResilience(
      cmsUrl,
      {
        credentials: "include"
      },
      {
        label: "rating batch request",
        bearerToken: tokenEntry?.accessToken,
        refreshBearerToken: createAuthRefreshHandler(tokenEntry)
      }
    );

    if (!response.ok) {
      throw new Error(`rating batch request failed: ${response.status}`);
    }

    const payload = await response.json();
    const records = requirePayloadDataArray("cms-objects", payload);
    auditCmsObjectContract(records);

    pushApiTrace("cmsObjects", {
      at: Date.now(),
      request: {
        url: cmsUrl,
        mode: "batch",
        preferred_audio_language: effectivePreferredAudioLanguage,
        seriesIds: seriesIds.slice()
      },
      response: {
        total: Number(payload?.total || records.length),
        rowCount: records.length
      },
      data: records
    });

    return records
      .map((record) => parseCmsObjectRecord(record))
      .filter((record) => record && record.seriesId)
      .filter(Boolean);
  }

  async function fetchRatingFromCmsObjects(seriesId, preferredAudioLanguage = getPreferredAudioLanguage()) {
    const effectivePreferredAudioLanguage = normalizeAudioLocale(preferredAudioLanguage) || getPreferredAudioLanguage();
    const cmsUrl = resolveApiHref(
      `/content/v2/cms/objects/${encodeURIComponent(seriesId)}` +
        `?ratings=true&preferred_audio_language=${encodeURIComponent(effectivePreferredAudioLanguage)}` +
        `&locale=${encodeURIComponent(getLocale())}`
    );

    let tokenEntry = await getAccessToken(false);
    if (!tokenEntry?.accessToken) {
      return {
        rating: null,
        votes: null,
        distribution: null,
        description: "",
        audioLocales: [],
        episodeCount: null,
        seasonCount: null,
        genreTags: [],
        preferredAudioLocale: effectivePreferredAudioLanguage
      };
    }

    const attempt = async () => {
      const response = await fetchWithResilience(
        cmsUrl,
        {
          credentials: "include"
        },
        {
          label: "cms ratings request",
          bearerToken: tokenEntry?.accessToken,
          refreshBearerToken: createAuthRefreshHandler(tokenEntry)
        }
      );

      if (!response.ok) {
        throw new Error(`cms ratings request failed: ${response.status}`);
      }

      const payload = await response.json();
      const records = requirePayloadDataArray("cms-objects", payload);
      auditCmsObjectContract(records);
      pushApiTrace("cmsObjects", {
        at: Date.now(),
        request: {
          url: cmsUrl,
          mode: "single",
          preferred_audio_language: effectivePreferredAudioLanguage,
          seriesIds: [seriesId]
        },
        response: {
          total: Number(payload?.total || records.length),
          rowCount: records.length
        },
        data: records
      });
      const record = records.find((row) => row && row.id === seriesId) || records[0] || null;
      if (record) {
        const parsed = parseCmsObjectRecord(record);
        return {
          rating: parsed.rating,
          votes: parsed.votes,
          distribution: parsed.distribution,
          description: parsed.description,
          audioLocales: parsed.audioLocales,
          episodeCount: parsed.episodeCount,
          seasonCount: parsed.seasonCount,
          genreTags: parsed.genreTags,
          preferredAudioLocale: effectivePreferredAudioLanguage
        };
      }

      const fallback = parseRatingPayload(payload);
      return {
        rating: fallback.rating,
        votes: fallback.votes,
        distribution: null,
        description: "",
        audioLocales: [],
        episodeCount: null,
        seasonCount: null,
        genreTags: [],
        preferredAudioLocale: effectivePreferredAudioLanguage
      };
    };

    try {
      return await attempt();
    } catch (_) {
      return {
        rating: null,
        votes: null,
        distribution: null,
        description: "",
        audioLocales: [],
        episodeCount: null,
        seasonCount: null,
        genreTags: [],
        preferredAudioLocale: effectivePreferredAudioLanguage
      };
    }
  }

  async function fetchRatingFromSeriesPage(seriesHref) {
    const seriesUrl = resolveApiHref(seriesHref);
    if (!seriesUrl) {
      throw new Error("series page url missing");
    }

    const response = await fetchWithResilience(
      seriesUrl,
      { credentials: "include" },
      { label: "series page fetch", maxAttempts: 2 }
    );
    if (!response.ok) {
      throw new Error(`series page fetch failed: ${response.status}`);
    }

    const html = await response.text();

    const ratingMatch =
      html.match(/\"ratingValue\"\s*:\s*\"?([0-5](?:\\.\d+)?)\"?/i) ||
      html.match(/\"averageRating\"\s*:\s*([0-5](?:\\.\d+)?)/i) ||
      html.match(/\"average\"\s*:\s*([0-5](?:\\.\d+)?)/i);

    const votesMatch =
      html.match(/\"ratingCount\"\s*:\s*\"?(\d{1,10})\"?/i) ||
      html.match(/\"votes\"\s*:\s*(\d{1,10})/i) ||
      html.match(/\"count\"\s*:\s*(\d{1,10})/i);

    return {
      rating: ratingMatch ? sanitizeRating(ratingMatch[1]) : null,
      votes: votesMatch ? sanitizeVotes(votesMatch[1]) : null,
      distribution: null,
      description: "",
      audioLocales: [],
      episodeCount: null,
      seasonCount: null,
      genreTags: []
    };
  }

  async function fetchRating(seriesId, seriesHref, preferredAudioLanguage = getPreferredAudioLanguage()) {
    if (seriesId) {
      try {
        const cmsRating = await fetchRatingFromCmsObjects(seriesId, preferredAudioLanguage);
        if (cmsRating.rating != null) {
          return cmsRating;
        }
      } catch (_) {
        // no-op
      }
    }

    const ratingUrl = resolveApiHref(`/content-reviews/v3/rating/series/${encodeURIComponent(seriesId)}`);
    try {
      const response = await fetchWithResilience(
        ratingUrl,
        { credentials: "include" },
        { label: "legacy rating request", maxAttempts: 2 }
      );
      if (response.ok) {
        const payload = await response.json();
        pushApiTrace("legacyRating", {
          at: Date.now(),
          request: {
            url: ratingUrl,
            seriesId
          },
          response: payload
        });
        const parsed = parseRatingPayload(payload);
        if (parsed.rating != null) {
          return {
            rating: parsed.rating,
            votes: parsed.votes,
            distribution: null,
            description: "",
            audioLocales: [],
            episodeCount: null,
            seasonCount: null,
            genreTags: []
          };
        }
      }
    } catch (_) {
      // no-op
    }

    if (!seriesHref) {
      return {
        rating: null,
        votes: null,
        distribution: null,
        description: "",
        audioLocales: [],
        episodeCount: null,
        seasonCount: null,
        genreTags: []
      };
    }

    try {
      return await fetchRatingFromSeriesPage(seriesHref);
    } catch (_) {
      return {
        rating: null,
        votes: null,
        distribution: null,
        description: "",
        audioLocales: [],
        episodeCount: null,
        seasonCount: null,
        genreTags: []
      };
    }
  }

  async function getSeriesRating(seriesId, seriesHref) {
    const cached = state.ratingCache[seriesId];
    if (isCacheValid(cached)) {
      return cached;
    }

    if (state.ratingInflight.has(seriesId)) {
      return state.ratingInflight.get(seriesId);
    }

    const inflight = (async () => {
      const fetched = await fetchRating(seriesId, seriesHref);
      const entry = mergeCachedSeriesData(seriesId, fetched);
      scheduleSaveRatings();
      return entry;
    })()
      .catch(() =>
        mergeCachedSeriesData(seriesId, {
          rating: null,
          votes: null,
          distribution: null,
          description: "",
          audioLocales: [],
          episodeCount: null,
          seasonCount: null,
          genreTags: []
        })
      )
      .finally(() => {
        state.ratingInflight.delete(seriesId);
      });

    state.ratingInflight.set(seriesId, inflight);
    return inflight;
  }

  function normalizeImageUrlCandidate(value) {
    if (typeof value !== "string") {
      return "";
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    return resolveApiHref(trimmed) || trimmed;
  }

  function collectImageVariantsFromApiImages(images) {
    if (!images || typeof images !== "object") {
      return [];
    }

    const variants = [];
    const seen = new Set();
    const visited = new WeakSet();

    const pushVariant = (value, groupKey) => {
      if (!value || typeof value !== "object") {
        return;
      }

      const source = normalizeImageUrlCandidate(value.source || value.url || value.href);
      if (!source || seen.has(source)) {
        return;
      }

      seen.add(source);
      variants.push({
        source,
        width: sanitizePositiveInt(value.width),
        height: sanitizePositiveInt(value.height),
        groupKey: typeof groupKey === "string" ? groupKey : ""
      });
    };

    const walk = (value, groupKey) => {
      if (!value || typeof value !== "object") {
        return;
      }

      if (visited.has(value)) {
        return;
      }
      visited.add(value);

      if (Array.isArray(value)) {
        value.forEach((item) => walk(item, groupKey));
        return;
      }

      pushVariant(value, groupKey);
      for (const nested of Object.values(value)) {
        walk(nested, groupKey);
      }
    };

    for (const [groupKey, groupValue] of Object.entries(images)) {
      walk(groupValue, groupKey);
    }

    return variants;
  }

  function scoreImageVariantForLayout(variant, layout) {
    const ratio = variant.width && variant.height ? variant.width / variant.height : null;
    const targetRatio = layout === "landscape" ? 16 / 9 : 2 / 3;
    const group = String(variant.groupKey || "").toLowerCase();

    let groupPenalty = 1;
    if (layout === "landscape") {
      if (/poster[_-]?wide|landscape|banner|thumbnail/.test(group)) {
        groupPenalty = 0;
      } else if (/poster/.test(group)) {
        groupPenalty = 0.5;
      } else if (/poster[_-]?tall|portrait/.test(group)) {
        groupPenalty = 1.5;
      }
    } else if (/poster[_-]?tall|portrait/.test(group)) {
      groupPenalty = 0;
    } else if (/poster/.test(group)) {
      groupPenalty = 0.5;
    } else if (/thumbnail|poster[_-]?wide|landscape|banner/.test(group)) {
      groupPenalty = 1.5;
    }

    let orientationPenalty = 0;
    if (ratio != null) {
      if (layout === "landscape" && ratio < 1) {
        orientationPenalty = 2.5;
      } else if (layout === "portrait" && ratio > 1) {
        orientationPenalty = 2.5;
      }
    } else {
      orientationPenalty = 1.1;
    }

    const ratioPenalty = ratio == null ? 1.4 : Math.abs(ratio - targetRatio);
    const widthBonus = variant.width ? Math.min(variant.width, 2000) / 2000 : 0;

    return groupPenalty * 2 + orientationPenalty + ratioPenalty - widthBonus * 0.35;
  }

  function selectPreferredCardImage(variants, layout) {
    if (!Array.isArray(variants) || !variants.length) {
      return "";
    }

    let winner = null;
    let winnerScore = Number.POSITIVE_INFINITY;

    for (const variant of variants) {
      const score = scoreImageVariantForLayout(variant, layout);
      if (score < winnerScore) {
        winner = variant;
        winnerScore = score;
      }
    }

    return winner?.source || "";
  }

  function extractCoverImagesFromApiImages(images) {
    const variants = collectImageVariantsFromApiImages(images);
    if (!variants.length) {
      return {
        portrait: "",
        landscape: "",
        fallback: ""
      };
    }

    const portrait = selectPreferredCardImage(variants, "portrait");
    const landscape = selectPreferredCardImage(variants, "landscape");
    const fallback = portrait || landscape || variants[0].source || "";

    return {
      portrait: portrait || fallback,
      landscape: landscape || fallback,
      fallback
    };
  }

  function extractThumbnailImageFromApiImages(images) {
    const variants = collectImageVariantsFromApiImages({
      thumbnail: images?.thumbnail
    });
    if (!variants.length) {
      return "";
    }

    let preferred = variants[0];
    for (const variant of variants) {
      const currentWidth = sanitizePositiveInt(variant.width) ?? 0;
      const preferredWidth = sanitizePositiveInt(preferred.width) ?? 0;
      if (currentWidth > preferredWidth) {
        preferred = variant;
      }
    }

    return normalizeImageUrlCandidate(preferred?.source);
  }

  function deriveStatusBaseFromApi(row, meta) {
    if (meta?.availability_status && meta.availability_status !== "available") {
      return "Unavailable";
    }

    if (row?.fully_watched) {
      return "Watch Again";
    }

    if (row?.never_watched) {
      return "Start Watching";
    }

    if (Number(row?.playhead || 0) > 0) {
      return "Continue";
    }

    if (row?.new) {
      return "Up Next";
    }

    return "Up Next";
  }

  function hasInProgressPlayback(entry, watchHistoryEntry) {
    const hasEntryProgress = Number(entry?.playheadMs || 0) > 0 && !Boolean(entry?.fullyWatched);
    if (hasEntryProgress) {
      return true;
    }

    return Number(watchHistoryEntry?.playhead || 0) > 0 && !Boolean(watchHistoryEntry?.fullyWatched);
  }

  function deriveDisplayStatusBase(entry, watchHistoryEntry) {
    const fallbackStatus = typeof entry?.statusBase === "string" && entry.statusBase.trim()
      ? entry.statusBase.trim()
      : "Up Next";
    const normalizedFallback = fallbackStatus.toLowerCase();

    if (normalizedFallback.includes("unavailable") || normalizedFallback.includes("coming soon")) {
      return fallbackStatus;
    }

    if (Boolean(entry?.fullyWatched) || normalizedFallback.includes("watch again") || normalizedFallback.includes("rewatch")) {
      return "Watch Again";
    }

    if (hasInProgressPlayback(entry, watchHistoryEntry)) {
      return "Continue";
    }

    if (Boolean(entry?.neverWatched) || normalizedFallback.includes("start watching")) {
      return "Start Watching";
    }

    return normalizedFallback.includes("up next") ? "Up Next" : fallbackStatus;
  }

  function deriveAudioLocalesFromApi(meta) {
    const locales = [];

    if (meta?.audio_locale) {
      locales.push(meta.audio_locale);
    }

    if (Array.isArray(meta?.audio_locales)) {
      locales.push(...meta.audio_locales);
    }

    return normalizeAudioLocales(locales);
  }

  function parseWatchReadyBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return null;
      }
      return value !== 0;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "") {
        return null;
      }
      if (["true", "1", "yes", "on", "y"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "off", "n"].includes(normalized)) {
        return false;
      }
    }

    return null;
  }

  function resolveWatchReadyFromApi(row) {
    if (!row || typeof row !== "object") {
      return null;
    }

    const meta = row?.panel?.episode_metadata || {};

    const candidates = [
      { value: row?.non_actionable, watchReadyMeaning: false },
      { value: row?.nonActionable, watchReadyMeaning: false },
      { value: row?.is_non_actionable, watchReadyMeaning: false },
      { value: row?.isNonActionable, watchReadyMeaning: false },
      { value: row?.watch_ready, watchReadyMeaning: true },
      { value: row?.watchReady, watchReadyMeaning: true },
      { value: row?.actionable, watchReadyMeaning: true },
      { value: row?.is_actionable, watchReadyMeaning: true },
      { value: row?.isActionable, watchReadyMeaning: true },
      { value: row?.watchable, watchReadyMeaning: true },
      { value: row?.is_watchable, watchReadyMeaning: true },
      { value: meta?.non_actionable, watchReadyMeaning: false },
      { value: meta?.nonActionable, watchReadyMeaning: false },
      { value: meta?.is_non_actionable, watchReadyMeaning: false },
      { value: meta?.isNonActionable, watchReadyMeaning: false },
      { value: meta?.watch_ready, watchReadyMeaning: true },
      { value: meta?.watchReady, watchReadyMeaning: true },
      { value: meta?.actionable, watchReadyMeaning: true },
      { value: meta?.is_actionable, watchReadyMeaning: true },
      { value: meta?.isActionable, watchReadyMeaning: true },
      { value: meta?.watchable, watchReadyMeaning: true },
      { value: meta?.is_watchable, watchReadyMeaning: true }
    ];

    for (const candidate of candidates) {
      const parsed = parseWatchReadyBoolean(candidate.value);
      if (parsed === null) {
        continue;
      }
      return candidate.watchReadyMeaning ? parsed : !parsed;
    }

    return null;
  }

  function deriveBaseWatchReady(row, statusBase, availabilityStatus, fullyWatched) {
    const explicitWatchReady = resolveWatchReadyFromApi(row);
    if (explicitWatchReady !== null) {
      return explicitWatchReady;
    }

    if (/watch again|rewatch|coming soon|unavailable/i.test(statusBase || "")) {
      return false;
    }
    if (availabilityStatus && availabilityStatus !== "available") {
      return false;
    }
    if (fullyWatched) {
      return false;
    }
    return true;
  }

  function normalizeEntriesFromApiRows(rows) {
    const dedup = new Map();

    rows.forEach((row, index) => {
      const seriesId = getWatchlistSeriesId(row);
      if (!seriesId) {
        return;
      }

      const meta = row?.panel?.episode_metadata || {};
      const knownEpisodeMaxByAudioLocale = getEpisodeAvailabilityByAudioLocale(meta);
      const existing = dedup.get(seriesId);
      if (existing) {
        existing.knownEpisodeMaxByAudioLocale = mergeEpisodeAvailabilityByAudioLocale(
          existing.knownEpisodeMaxByAudioLocale,
          knownEpisodeMaxByAudioLocale
        );
        return;
      }

      const statusBase = deriveStatusBaseFromApi(row, meta);
      const seasonNumber = sanitizePositiveInt(meta?.season_number);
      const episodeNumber = sanitizePositiveInt(meta?.episode_number);
      const absoluteEpisodeNumber = getAbsoluteEpisodeNumberFromEpisodeMetadata(meta);
      const canonicalEpisodeKey = deriveCanonicalEpisodeKeyFromEpisodeMetadata(meta, seriesId);
      const nextEpisodeLabel = formatEpisodeIdentifier(seasonNumber, episodeNumber);
      const statusText = nextEpisodeLabel ? `${statusBase}: ${nextEpisodeLabel}` : statusBase;
      const audioLocales = deriveAudioLocalesFromApi(meta);
      const hasEnglishAudio = hasEnUsAudio(audioLocales);
      const fullyWatched = Boolean(row?.fully_watched);
      const neverWatched = Boolean(row?.never_watched);
      const watchReadyBase = deriveBaseWatchReady(row, statusBase, meta?.availability_status, fullyWatched);
      const title = meta?.series_title || row?.panel?.title || seriesId;
      const slug = meta?.series_slug_title || "";
      const href = slug ? `/series/${seriesId}/${slug}` : `/series/${seriesId}`;
      const coverImages = extractCoverImagesFromApiImages(row?.panel?.images);
      const portraitImageUrl = coverImages.portrait;
      const landscapeImageUrl = coverImages.landscape;
      const imageUrl = portraitImageUrl || landscapeImageUrl || coverImages.fallback;
      const hoverPreviewImageUrl = extractThumbnailImageFromApiImages(row?.panel?.images);
      const description = typeof row?.panel?.description === "string" ? row.panel.description.trim() : "";
      const dateAddedMs = pickFirstDateMs([
        row?.date_added,
        row?.added_at,
        row?.created_at,
        row?.created,
        row?.createdAt,
        row?.panel?.date_added,
        row?.panel?.created_at,
        row?.panel?.episode_metadata?.availability_starts
      ]);
      const lastWatchedMs = pickFirstDateMs([
        row?.last_watched,
        row?.last_watched_at,
        row?.watch_history_updated_at,
        row?.playhead_updated_at,
        row?.last_played_at,
        row?.panel?.last_watched,
        row?.panel?.episode_metadata?.last_watched
      ]);
      const dateUpdatedMs = pickFirstDateMs([
        lastWatchedMs,
        row?.date_updated,
        row?.updated_at,
        row?.modified_at,
        row?.last_modified_at,
        row?.updatedAt,
        row?.panel?.updated_at,
        row?.panel?.last_modified_at,
        dateAddedMs
      ]);
      const playheadMs = Number(row?.playhead || 0) > 0 ? Number(row.playhead) : 0;

      dedup.set(seriesId, {
        source: "api",
        seriesId,
        panelId: typeof row?.panel?.id === "string" ? row.panel.id : null,
        canonicalEpisodeKey,
        title,
        href,
        imageUrl,
        portraitImageUrl,
        landscapeImageUrl,
        hoverPreviewImageUrl,
        streamsLink:
          typeof row?.panel?.streams_link === "string"
            ? row.panel.streams_link
            : typeof meta?.streams_link === "string"
              ? meta.streams_link
              : "",
        description,
        dateAddedMs,
        lastWatchedMs,
        dateUpdatedMs,
        episodeCount: null,
        seasonCount: null,
        genreTags: [],
        statusText,
        statusBase,
        nextEpisodeLabel,
        seasonNumber,
        episodeNumber,
        absoluteEpisodeNumber,
        playheadMs,
        fullyWatched,
        neverWatched,
        isFavorite: Boolean(row?.is_favorite),
        audioLocales,
        knownEpisodeMaxByAudioLocale,
        hasEnglishAudio,
        watchReadyBase,
        originalIndex: index,
        fixtureTitle: null
      });
    });

    return Array.from(dedup.values());
  }

  function resolveApiHref(href) {
    if (!href || typeof href !== "string") {
      return "";
    }

    try {
      return new URL(href, window.location.origin).toString();
    } catch (_) {
      return "";
    }
  }

  function resolveSeriesHref(entry) {
    return resolveApiHref(entry?.href);
  }

  function hasEpisodeCountForAudioLocale(entry, audioLocale) {
    return getAudioLocaleCountFromMap(entry?.episodeCountByAudioLocale, audioLocale) != null;
  }

  async function preloadRatingsForEntries(entries, tokenEntry, preferredAudioLanguage = getPreferredAudioLanguage()) {
    const effectivePreferredAudioLanguage = normalizeAudioLocale(preferredAudioLanguage) || getPreferredAudioLanguage();
    const allSeriesIds = Array.from(new Set(entries.map((entry) => entry.seriesId).filter(Boolean)));
    const staleSeriesIds = allSeriesIds.filter((seriesId) => {
      const cachedEntry = state.ratingCache[seriesId];
      if (!isCacheValid(cachedEntry)) {
        return true;
      }

      return !hasEpisodeCountForAudioLocale(cachedEntry, effectivePreferredAudioLanguage);
    });

    if (!staleSeriesIds.length) {
      return;
    }

    let updated = 0;

    if (tokenEntry?.accessToken) {
      const chunks = chunkArray(staleSeriesIds, RATING_BATCH_SIZE);
      for (const chunk of chunks) {
        try {
          const records = await fetchRatingsBatch(tokenEntry, chunk, effectivePreferredAudioLanguage);
          records.forEach(
            ({
              seriesId,
              rating,
              votes,
              distribution,
              description,
              audioLocales,
              episodeCount,
              seasonCount,
              genreTags,
              portraitImageUrl,
              landscapeImageUrl
            }) => {
              mergeCachedSeriesData(seriesId, {
                preferredAudioLocale: effectivePreferredAudioLanguage,
                rating,
                votes,
                distribution,
                description,
                audioLocales,
                episodeCount,
                seasonCount,
                genreTags,
                portraitImageUrl,
                landscapeImageUrl
              });
              updated += 1;
            }
          );
        } catch (_) {
          // no-op
        }
      }
    }

    if (updated > 0) {
      scheduleSaveRatings();
    }

    runtimeEvent("ratings-preload", {
      preferredAudioLanguage: effectivePreferredAudioLanguage,
      stale: staleSeriesIds.length,
      updated
    });
  }

  async function preloadWatchHistoryForEntries(
    entries,
    tokenEntry,
    force = false,
    preferredAudioLanguage = getPreferredAudioLanguage()
  ) {
    if (!tokenEntry?.accessToken || !tokenEntry?.accountId) {
      state.watchHistoryStatus = "unavailable";
      return;
    }

    const effectivePreferredAudioLanguage =
      normalizeAudioLocale(preferredAudioLanguage) || getPreferredAudioLanguage();
    const isDefaultPreferredAudio =
      effectivePreferredAudioLanguage.toLowerCase() === getPreferredAudioLanguage().toLowerCase();

    if (!force && isWatchHistoryCacheValid(state.watchHistoryCache, tokenEntry.accountId)) {
      state.watchHistoryStatus = "ready";
      return;
    }

    if (!force && state.watchHistoryInflight) {
      return state.watchHistoryInflight;
    }

    const candidateSeriesIds = Array.from(
      new Set(
        entries
          .filter((entry) => entry?.seriesId)
          .filter((entry) => !entry.neverWatched || Number(entry.playheadMs || 0) > 0)
          .map((entry) => entry.seriesId)
      )
    );
    const remainingSeriesIds = new Set(candidateSeriesIds);

    const inflight = (async () => {
      state.watchHistoryStatus = "loading";
      const seriesUpdates = {};
      const seriesProgressUpdates = {};
      const localeUpdates = {};
      const localeProgressUpdates = {};
      let pages = 0;
      let totalRows = null;
      let fetchedRows = 0;
      let noMatchPageStreak = 0;
      const seenRowKeys = new Set();

      while (pages < WATCH_HISTORY_MAX_PAGES) {
        pages += 1;
        const page = await fetchWatchHistoryPage(tokenEntry, pages, effectivePreferredAudioLanguage);
        let matchedOnPage = 0;

        if (totalRows == null) {
          totalRows = page.total;
        }

        fetchedRows += page.rows.length;

        page.rows.forEach((row) => {
          const parsed = parseWatchHistoryRow(row, effectivePreferredAudioLanguage);
          if (!parsed || !parsed.seriesId || parsed.datePlayedMs == null) {
            return;
          }

          const rowKey =
            parsed.canonicalEpisodeKey ||
            parsed.episodeId ||
            `${parsed.seriesId}|${parsed.absoluteEpisodeNumber || ""}|${parsed.datePlayedMs}`;
          if (seenRowKeys.has(rowKey)) {
            return;
          }
          seenRowKeys.add(rowKey);

          if (isDefaultPreferredAudio) {
            const previous = seriesUpdates[parsed.seriesId];
            if (!previous || parsed.datePlayedMs > previous.datePlayedMs) {
              seriesUpdates[parsed.seriesId] = parsed;
            }

            const previousProgress = seriesProgressUpdates[parsed.seriesId];
            if (shouldReplaceWatchHistoryProgress(previousProgress, parsed)) {
              seriesProgressUpdates[parsed.seriesId] = parsed;
            }
          }

          const locale = normalizeAudioLocale(parsed.audioLocale);
          if (locale) {
            const localeStorageKey = locale.toLowerCase();
            const perSeriesLocaleMap = localeUpdates[parsed.seriesId] || {};
            const previousByLocale = perSeriesLocaleMap[localeStorageKey];
            if (!previousByLocale || parsed.datePlayedMs > previousByLocale.datePlayedMs) {
              perSeriesLocaleMap[localeStorageKey] = {
                ...parsed,
                audioLocale: locale
              };
            }
            localeUpdates[parsed.seriesId] = perSeriesLocaleMap;

            const perSeriesLocaleProgressMap = localeProgressUpdates[parsed.seriesId] || {};
            const previousProgressByLocale = perSeriesLocaleProgressMap[localeStorageKey];
            if (shouldReplaceWatchHistoryProgress(previousProgressByLocale, parsed)) {
              perSeriesLocaleProgressMap[localeStorageKey] = {
                ...parsed,
                audioLocale: locale
              };
            }
            localeProgressUpdates[parsed.seriesId] = perSeriesLocaleProgressMap;
          }

          if (remainingSeriesIds.has(parsed.seriesId)) {
            remainingSeriesIds.delete(parsed.seriesId);
            matchedOnPage += 1;
          }
        });

        if (matchedOnPage === 0 && remainingSeriesIds.size > 0) {
          noMatchPageStreak += 1;
        } else {
          noMatchPageStreak = 0;
        }

        if (!page.rows.length || page.rows.length < WATCH_HISTORY_PAGE_SIZE) {
          break;
        }

        if (totalRows != null && fetchedRows >= totalRows) {
          break;
        }

        if (!remainingSeriesIds.size) {
          break;
        }

        if (remainingSeriesIds.size && noMatchPageStreak >= WATCH_HISTORY_NO_MATCH_PAGE_LIMIT) {
          break;
        }
      }

      const latestCache = normalizeStoredWatchHistoryCache(state.watchHistoryCache);
      const nextBySeriesId = isDefaultPreferredAudio ? { ...latestCache.bySeriesId } : latestCache.bySeriesId;
      const nextBySeriesIdProgress = isDefaultPreferredAudio
        ? { ...latestCache.bySeriesIdProgress }
        : latestCache.bySeriesIdProgress;
      const nextBySeriesIdAudioLocale = normalizeStoredWatchHistoryBySeriesAudioLocale(latestCache.bySeriesIdAudioLocale);
      const nextBySeriesIdAudioLocaleProgress = normalizeStoredWatchHistoryBySeriesAudioLocale(
        latestCache.bySeriesIdAudioLocaleProgress
      );

      if (isDefaultPreferredAudio) {
        Object.entries(seriesUpdates).forEach(([seriesId, updateEntry]) => {
          const previous = normalizeWatchHistoryEntry(nextBySeriesId[seriesId]);
          if (!previous || updateEntry.datePlayedMs > previous.datePlayedMs) {
            nextBySeriesId[seriesId] = updateEntry;
          }
        });

        Object.entries(seriesProgressUpdates).forEach(([seriesId, updateEntry]) => {
          const previous = normalizeWatchHistoryEntry(nextBySeriesIdProgress[seriesId]);
          if (shouldReplaceWatchHistoryProgress(previous, updateEntry)) {
            nextBySeriesIdProgress[seriesId] = updateEntry;
          }
        });
      }

      Object.entries(localeUpdates).forEach(([seriesId, localeMapUpdates]) => {
        const nextLocaleMap = { ...(nextBySeriesIdAudioLocale[seriesId] || {}) };

        Object.entries(localeMapUpdates).forEach(([localeStorageKey, updateEntry]) => {
          const previous = normalizeWatchHistoryEntry(nextLocaleMap[localeStorageKey]);
          if (!previous || updateEntry.datePlayedMs > previous.datePlayedMs) {
            nextLocaleMap[localeStorageKey] = updateEntry;
          }
        });

        if (Object.keys(nextLocaleMap).length) {
          nextBySeriesIdAudioLocale[seriesId] = nextLocaleMap;
        }
      });

      Object.entries(localeProgressUpdates).forEach(([seriesId, localeMapUpdates]) => {
        const nextLocaleProgressMap = { ...(nextBySeriesIdAudioLocaleProgress[seriesId] || {}) };

        Object.entries(localeMapUpdates).forEach(([localeStorageKey, updateEntry]) => {
          const previous = normalizeWatchHistoryEntry(nextLocaleProgressMap[localeStorageKey]);
          if (shouldReplaceWatchHistoryProgress(previous, updateEntry)) {
            nextLocaleProgressMap[localeStorageKey] = updateEntry;
          }
        });

        if (Object.keys(nextLocaleProgressMap).length) {
          nextBySeriesIdAudioLocaleProgress[seriesId] = nextLocaleProgressMap;
        }
      });

      state.watchHistoryCache = {
        version: WATCH_HISTORY_CACHE_VERSION,
        accountId: tokenEntry.accountId,
        updatedAt: Date.now(),
        bySeriesId: nextBySeriesId,
        bySeriesIdAudioLocale: nextBySeriesIdAudioLocale,
        bySeriesIdProgress: nextBySeriesIdProgress,
        bySeriesIdAudioLocaleProgress: nextBySeriesIdAudioLocaleProgress
      };
      state.watchHistoryStatus = "ready";
      scheduleSaveWatchHistory();

      runtimeEvent("watch-history-preload", {
        preferredAudioLanguage: effectivePreferredAudioLanguage,
        pages,
        fetchedRows,
        mappedSeries: Object.keys(nextBySeriesId).length,
        mappedSeriesByAudioLocale: Object.keys(nextBySeriesIdAudioLocale).length,
        mappedProgressSeries: Object.keys(nextBySeriesIdProgress).length,
        mappedProgressSeriesByAudioLocale: Object.keys(nextBySeriesIdAudioLocaleProgress).length,
        matchedCandidates: candidateSeriesIds.length - remainingSeriesIds.size,
        candidates: candidateSeriesIds.length,
        noMatchPageStreak
      });
    })()
      .catch((error) => {
        if (isDefaultPreferredAudio || !isWatchHistoryCacheValid(state.watchHistoryCache, tokenEntry.accountId)) {
          state.watchHistoryStatus = "failed";
        } else {
          state.watchHistoryStatus = "ready";
        }
        runtimeEvent("watch-history-preload-failed", {
          preferredAudioLanguage: effectivePreferredAudioLanguage,
          message: error?.message || "unknown"
        });
      })
      .finally(() => {
        if (state.watchHistoryInflight === inflight) {
          state.watchHistoryInflight = null;
        }
      });

    state.watchHistoryInflight = inflight;
    return inflight;
  }

  function loadCuratedEntries(force = false) {
    if (state.curatedInflight) {
      return state.curatedInflight;
    }

    const inflight = (async () => {
      runtimeEvent("curated-load-start");
      state.curatedError = null;
      const tokenEntry = await getAccessToken(false);

      if (!tokenEntry?.accessToken || !tokenEntry?.accountId) {
        throw new Error("Unable to load curated watchlist: Crunchyroll API auth is unavailable.");
      }

      if (
        state.watchlistCache?.accountId &&
        tokenEntry.accountId &&
        state.watchlistCache.accountId !== tokenEntry.accountId
      ) {
        state.watchlistCache = {
          accountId: "",
          updatedAt: 0,
          rows: []
        };
        scheduleSaveWatchlistCache();
      }

      const rows = await fetchAllWatchlistRows(tokenEntry);
      const entries = normalizeEntriesFromApiRows(rows);

      await Promise.all([
        preloadRatingsForEntries(entries, tokenEntry),
        preloadWatchHistoryForEntries(entries, tokenEntry, force)
      ]);

      const selectedAudioLocale = normalizeAudioLocale(state.settings.audioLocaleFilter);
      if (
        selectedAudioLocale &&
        selectedAudioLocale.toLowerCase() !== getPreferredAudioLanguage().toLowerCase()
      ) {
        await Promise.all([
          preloadRatingsForEntries(entries, tokenEntry, selectedAudioLocale),
          preloadWatchHistoryForEntries(entries, tokenEntry, true, selectedAudioLocale)
        ]);
      }

      state.watchlistCache = {
        accountId: tokenEntry.accountId,
        updatedAt: Date.now(),
        rows
      };
      scheduleSaveWatchlistCache();

      state.curatedEntries = entries;
      state.curatedSource = "api";
      state.curatedError = null;
      state.curatedLastRevalidateAt = Date.now();

      runtimeEvent("curated-load-done", {
        source: "api",
        total: entries.length
      });

      return entries;
    })()
      .catch((error) => {
        const hadCachedOrExistingEntries = state.curatedEntries.length > 0;
        if (!hadCachedOrExistingEntries) {
          state.curatedEntries = [];
          state.curatedSource = "none";
        }
        state.curatedError = hadCachedOrExistingEntries
          ? "Showing cached data; latest refresh failed."
          : error?.message || "Unable to load curated watchlist from Crunchyroll API.";
        runtimeEvent("curated-load-failed", {
          message: error?.message || state.curatedError
        });
        return state.curatedEntries;
      })
      .finally(() => {
        state.curatedInflight = null;
      });

    state.curatedInflight = inflight;
    return inflight;
  }

  function shouldBackgroundRevalidateCurated() {
    if (state.curatedInflight || !state.curatedEntries.length) {
      return false;
    }

    const now = Date.now();
    if (state.curatedSource === "cache") {
      return now - state.curatedLastRevalidateAt > 1000;
    }

    return now - state.curatedLastRevalidateAt > WATCHLIST_REVALIDATE_COOLDOWN_MS;
  }

  function observeCuratedLoadPromise(promise) {
    if (!promise || typeof promise.finally !== "function") {
      return;
    }

    if (state.curatedObservedPromise === promise) {
      return;
    }

    state.curatedObservedPromise = promise;
    promise.finally(() => {
      if (state.curatedObservedPromise === promise) {
        state.curatedObservedPromise = null;
      }

      if (!state.mounted || !isWatchlistPath(window.location.pathname)) {
        return;
      }

      renderCuratedPanel();
    });
  }

  function ensureCuratedDataLoad(force = false) {
    if (!force && state.curatedEntries.length) {
      if (shouldBackgroundRevalidateCurated()) {
        const backgroundPromise = loadCuratedEntries(false);
        observeCuratedLoadPromise(backgroundPromise);
      }
      return Promise.resolve(state.curatedEntries);
    }

    const promise = loadCuratedEntries(force);
    observeCuratedLoadPromise(promise);
    return promise;
  }

  function getCachedRating(seriesId) {
    const cached = state.ratingCache[seriesId];
    return isCacheValid(cached) ? cached : null;
  }

  function getLocalizedSeriesCount(ratingEntry, audioLocale, countType) {
    const fallbackFieldName = countType === "season" ? "seasonCount" : "episodeCount";
    const mapFieldName = countType === "season" ? "seasonCountByAudioLocale" : "episodeCountByAudioLocale";
    const localizedCount = getAudioLocaleCountFromMap(ratingEntry?.[mapFieldName], audioLocale);
    if (localizedCount != null) {
      return localizedCount;
    }

    return sanitizePositiveInt(ratingEntry?.[fallbackFieldName]);
  }

  function isLocalizedRatingDataMissingForEntries(entries, audioLocale) {
    const selectedAudioLocale = normalizeAudioLocale(audioLocale);
    if (!selectedAudioLocale || !Array.isArray(entries) || !entries.length) {
      return false;
    }

    return entries.some((entry) => {
      const seriesId = entry?.seriesId;
      if (!seriesId) {
        return false;
      }

      const cached = state.ratingCache[seriesId];
      if (!isCacheValid(cached)) {
        return true;
      }

      return !hasEpisodeCountForAudioLocale(cached, selectedAudioLocale);
    });
  }

  async function preloadRatingsForSelectedAudioLocale(audioLocale) {
    const selectedAudioLocale = normalizeAudioLocale(audioLocale);
    if (!selectedAudioLocale || !state.curatedEntries.length) {
      return;
    }

    if (!isLocalizedRatingDataMissingForEntries(state.curatedEntries, selectedAudioLocale)) {
      return;
    }

    const localeKey = selectedAudioLocale.toLowerCase();
    if (state.ratingLocalePreloadInflight.has(localeKey)) {
      return state.ratingLocalePreloadInflight.get(localeKey);
    }

    const inflight = (async () => {
      const tokenEntry = await getAccessToken(false);
      if (!tokenEntry?.accessToken) {
        return;
      }

      await preloadRatingsForEntries(state.curatedEntries, tokenEntry, selectedAudioLocale);
    })()
      .finally(() => {
        if (state.ratingLocalePreloadInflight.get(localeKey) === inflight) {
          state.ratingLocalePreloadInflight.delete(localeKey);
        }
      });

    state.ratingLocalePreloadInflight.set(localeKey, inflight);
    return inflight;
  }

  function isLocalizedWatchHistoryDataMissingForEntries(entries, audioLocale) {
    const selectedAudioLocale = normalizeAudioLocale(audioLocale);
    if (!selectedAudioLocale || !Array.isArray(entries) || !entries.length) {
      return false;
    }

    const isDefaultPreferredAudio =
      selectedAudioLocale.toLowerCase() === getPreferredAudioLanguage().toLowerCase();

    return entries.some((entry) => {
      const seriesId = entry?.seriesId;
      if (!seriesId) {
        return false;
      }

      if (entry.neverWatched && Number(entry.playheadMs || 0) <= 0) {
        return false;
      }

      const localizedEntry = getCachedWatchHistory(seriesId, selectedAudioLocale, false);
      if (localizedEntry) {
        return false;
      }

      if (isDefaultPreferredAudio) {
        return !getCachedWatchHistory(seriesId);
      }

      return true;
    });
  }

  async function preloadWatchHistoryForSelectedAudioLocale(audioLocale) {
    const selectedAudioLocale = normalizeAudioLocale(audioLocale);
    if (!selectedAudioLocale || !state.curatedEntries.length) {
      return;
    }

    if (!isLocalizedWatchHistoryDataMissingForEntries(state.curatedEntries, selectedAudioLocale)) {
      return;
    }

    const localeKey = selectedAudioLocale.toLowerCase();
    if (state.watchHistoryLocalePreloadInflight.has(localeKey)) {
      return state.watchHistoryLocalePreloadInflight.get(localeKey);
    }

    const inflight = (async () => {
      const tokenEntry = await getAccessToken(false);
      if (!tokenEntry?.accessToken || !tokenEntry?.accountId) {
        return;
      }

      await preloadWatchHistoryForEntries(state.curatedEntries, tokenEntry, true, selectedAudioLocale);
    })()
      .finally(() => {
        if (state.watchHistoryLocalePreloadInflight.get(localeKey) === inflight) {
          state.watchHistoryLocalePreloadInflight.delete(localeKey);
        }
      });

    state.watchHistoryLocalePreloadInflight.set(localeKey, inflight);
    return inflight;
  }

  function extractSeriesIdFromHref(href) {
    if (typeof href !== "string") {
      return null;
    }

    const match = href.match(/\/series\/([^/?#]+)/i);
    if (!match || !match[1]) {
      return null;
    }

    try {
      return decodeURIComponent(match[1]);
    } catch (_) {
      return match[1];
    }
  }

  function getNativeCardSeriesId(card) {
    if (!(card instanceof HTMLElement)) {
      return null;
    }

    const links = Array.from(card.querySelectorAll('a[href*="/series/"]'));
    for (const link of links) {
      const seriesId = extractSeriesIdFromHref(link.getAttribute("href") || "");
      if (seriesId) {
        return seriesId;
      }
    }

    return null;
  }

  function findNativeCardBySeriesId(seriesId) {
    if (!seriesId) {
      return null;
    }

    const nativeCards = Array.from(document.querySelectorAll('[data-t="watch-list-card"]'));
    for (const card of nativeCards) {
      if (!(card instanceof HTMLElement)) {
        continue;
      }

      const cardSeriesId = getNativeCardSeriesId(card);
      if (cardSeriesId === seriesId) {
        return card;
      }
    }

    return null;
  }

  function findNativeActionButton(card, actionType) {
    if (!(card instanceof HTMLElement)) {
      return null;
    }

    const selectors =
      actionType === "favorite"
        ? [
            '[data-cw-native-action="favorite"]',
            'button[aria-label*="favorite" i]',
            '[role="button"][aria-label*="favorite" i]',
            '[data-t*="favorite" i]',
            'button[class*="favorite" i]',
            'button[class*="heart" i]'
          ]
        : [
            '[data-cw-native-action="remove"]',
            'button[aria-label*="remove" i]',
            '[role="button"][aria-label*="remove" i]',
            'button[aria-label*="trash" i]',
            '[role="button"][aria-label*="trash" i]',
            'button[aria-label*="delete" i]',
            '[role="button"][aria-label*="delete" i]',
            '[data-t*="remove" i]',
            'button[class*="remove" i]',
            'button[class*="trash" i]',
            'button[class*="delete" i]'
          ];

    for (const selector of selectors) {
      const button = card.querySelector(selector);
      if (button instanceof HTMLElement) {
        return button;
      }
    }

    return null;
  }

  function triggerNativeCardAction(seriesId, actionType) {
    const nativeCard = findNativeCardBySeriesId(seriesId);
    if (!nativeCard) {
      return false;
    }

    const nativeButton = findNativeActionButton(nativeCard, actionType);
    if (!nativeButton) {
      return false;
    }

    nativeButton.click();
    runtimeEvent("native-action-forwarded", {
      seriesId,
      actionType
    });
    return true;
  }

  function toggleCuratedFavorite(seriesId) {
    state.curatedEntries = state.curatedEntries.map((entry) => {
      if (entry.seriesId !== seriesId) {
        return entry;
      }

      return {
        ...entry,
        isFavorite: !Boolean(entry.isFavorite)
      };
    });
  }

  function removeCuratedSeries(seriesId) {
    state.curatedEntries = state.curatedEntries.filter((entry) => entry.seriesId !== seriesId);
  }

  function extractUrlFromCssBackground(backgroundValue) {
    if (typeof backgroundValue !== "string") {
      return "";
    }

    const match = backgroundValue.match(/url\((['"]?)(.*?)\1\)/i);
    if (!match || !match[2]) {
      return "";
    }

    return resolveApiHref(match[2]) || match[2];
  }

  function getNativeCardPreviewUrl(card) {
    if (!(card instanceof HTMLElement)) {
      return "";
    }

    const mediaSelector = [
      "video",
      "img",
      "picture img",
      '[data-t*="preview"]',
      '[class*="preview"]',
      '[class*="thumbnail"]',
      '[class*="poster"]',
      '[class*="image"]'
    ].join(", ");

    const candidates = Array.from(card.querySelectorAll(mediaSelector));
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) {
        continue;
      }

      if (candidate instanceof HTMLVideoElement) {
        const current = candidate.currentSrc || candidate.src;
        if (current) {
          return current;
        }
      }

      if (candidate instanceof HTMLImageElement) {
        const current = candidate.currentSrc || candidate.src;
        if (current) {
          return current;
        }
      }

      const styleValue = window.getComputedStyle(candidate).backgroundImage;
      const backgroundUrl = extractUrlFromCssBackground(styleValue);
      if (backgroundUrl) {
        return backgroundUrl;
      }
    }

    const cardBackground = extractUrlFromCssBackground(window.getComputedStyle(card).backgroundImage);
    return cardBackground || "";
  }

  function isLikelyVideoUrl(url) {
    if (typeof url !== "string") {
      return false;
    }

    return /\.(m3u8|mp4|webm|m4v|mpd)(\?|$)/i.test(url);
  }

  function findFirstMediaUrl(value, visited = new Set()) {
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) {
        return null;
      }

      if (!/^https?:\/\//i.test(text) && !text.startsWith("/")) {
        return null;
      }

      const looksLikeMedia =
        /\.(m3u8|mp4|webm|m4v|mpd|jpg|jpeg|png|webp|avif)(\?|$)/i.test(text) ||
        /(?:playlist|manifest|stream|preview|video|thumbnail|poster|image)/i.test(text);

      if (!looksLikeMedia) {
        return null;
      }

      return resolveApiHref(text) || text;
    }

    if (!value || typeof value !== "object") {
      return null;
    }

    if (visited.has(value)) {
      return null;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findFirstMediaUrl(item, visited);
        if (found) {
          return found;
        }
      }
      return null;
    }

    for (const key of Object.keys(value)) {
      const found = findFirstMediaUrl(value[key], visited);
      if (found) {
        return found;
      }
    }

    return null;
  }

  function parsePreviewUrlFromPayload(payload) {
    const directCandidates = [
      payload?.preview_url,
      payload?.previewUrl,
      payload?.preview_image,
      payload?.previewImage,
      payload?.preview?.url,
      payload?.preview?.image,
      payload?.url,
      payload?.streams?.adaptive_hls?.url,
      payload?.streams?.adaptive_hls?.[""],
      payload?.streams?.hls?.url,
      payload?.streams?.hls?.[""]
    ];

    for (const candidate of directCandidates) {
      const resolved = resolveApiHref(candidate);
      if (resolved) {
        return resolved;
      }
    }

    const nestedCandidates = [
      payload?.streams?.adaptive_hls,
      payload?.streams?.hls,
      payload?.streams
    ];

    for (const candidate of nestedCandidates) {
      const found = findFirstMediaUrl(candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  function getPreviewCacheKey(entry) {
    const streamsUrl = resolveApiHref(entry?.streamsLink);
    if (streamsUrl) {
      return `streams:${streamsUrl}`;
    }

    const panelId = typeof entry?.panelId === "string" ? entry.panelId.trim() : "";
    if (panelId) {
      return `episode:${panelId}`;
    }

    const canonicalEpisodeKey = typeof entry?.canonicalEpisodeKey === "string"
      ? entry.canonicalEpisodeKey.trim()
      : "";
    if (canonicalEpisodeKey) {
      return `canonical:${canonicalEpisodeKey}`;
    }

    const seriesId = typeof entry?.seriesId === "string" ? entry.seriesId.trim() : "";
    if (seriesId) {
      return `series:${seriesId}`;
    }

    return "";
  }

  async function fetchPreviewUrlForEntry(entry) {
    const seriesId = entry?.seriesId;
    if (!seriesId) {
      return null;
    }

    const previewCacheKey = getPreviewCacheKey(entry);
    if (!previewCacheKey) {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(state.previewCache, previewCacheKey)) {
      return state.previewCache[previewCacheKey] || null;
    }

    if (state.previewInflight.has(previewCacheKey)) {
      return state.previewInflight.get(previewCacheKey);
    }

    const streamsUrl = resolveApiHref(entry?.streamsLink);
    if (!streamsUrl) {
      state.previewCache[previewCacheKey] = null;
      return null;
    }

    const inflight = (async () => {
      let previewUrl = null;
      const tokenEntry = await getAccessToken(false);

      try {
        const response = await fetchWithResilience(
          streamsUrl,
          {
            credentials: "include"
          },
          {
            label: "preview request",
            bearerToken: tokenEntry?.accessToken,
            refreshBearerToken: createAuthRefreshHandler(tokenEntry)
          }
        );

        if (response.ok) {
          const payload = await response.json();
          pushApiTrace("preview", {
            at: Date.now(),
            request: {
              url: streamsUrl,
              seriesId,
              cacheKey: previewCacheKey
            },
            response: payload
          });
          previewUrl = parsePreviewUrlFromPayload(payload);
        }
      } catch (_) {
        previewUrl = null;
      }

      state.previewCache[previewCacheKey] = previewUrl || null;
      return previewUrl || null;
    })().finally(() => {
      state.previewInflight.delete(previewCacheKey);
    });

    state.previewInflight.set(previewCacheKey, inflight);
    return inflight;
  }

  function isEntryWatchReady(entry) {
    return Boolean(entry.watchReadyBase);
  }

  function compareRenderableEntries(left, right) {
    const leftRating = left.rating == null ? null : Number(left.rating);
    const rightRating = right.rating == null ? null : Number(right.rating);

    if (state.settings.sortMode === "rating_desc") {
      const normalizedLeft = leftRating == null ? -Infinity : leftRating;
      const normalizedRight = rightRating == null ? -Infinity : rightRating;
      if (normalizedLeft !== normalizedRight) {
        return normalizedRight - normalizedLeft;
      }
      return left.originalIndex - right.originalIndex;
    }

    if (state.settings.sortMode === "rating_asc") {
      const normalizedLeft = leftRating == null ? Infinity : leftRating;
      const normalizedRight = rightRating == null ? Infinity : rightRating;
      if (normalizedLeft !== normalizedRight) {
        return normalizedLeft - normalizedRight;
      }
      return left.originalIndex - right.originalIndex;
    }

    if (state.settings.sortMode === "hidden_gems_desc") {
      const normalizedLeftRating = leftRating == null ? -Infinity : leftRating;
      const normalizedRightRating = rightRating == null ? -Infinity : rightRating;
      if (normalizedLeftRating !== normalizedRightRating) {
        return normalizedRightRating - normalizedLeftRating;
      }

      const leftVotes = sanitizeVotes(left.votes);
      const rightVotes = sanitizeVotes(right.votes);
      const normalizedLeftVotes = leftVotes == null ? Infinity : leftVotes;
      const normalizedRightVotes = rightVotes == null ? Infinity : rightVotes;
      if (normalizedLeftVotes !== normalizedRightVotes) {
        return normalizedLeftVotes - normalizedRightVotes;
      }

      return left.originalIndex - right.originalIndex;
    }

    if (state.settings.sortMode === "rewatch_memory_desc") {
      const leftScore = getRewatchMemoryScore(left);
      const rightScore = getRewatchMemoryScore(right);
      const normalizedLeftScore = leftScore == null ? -Infinity : leftScore;
      const normalizedRightScore = rightScore == null ? -Infinity : rightScore;
      if (normalizedLeftScore !== normalizedRightScore) {
        return normalizedRightScore - normalizedLeftScore;
      }

      // When the rewatch score is unavailable, prefer entries with more existing progress.
      const leftWatched = getWatchedEpisodeEstimate(left);
      const rightWatched = getWatchedEpisodeEstimate(right);
      const normalizedLeftWatched = leftWatched == null ? -Infinity : leftWatched;
      const normalizedRightWatched = rightWatched == null ? -Infinity : rightWatched;
      if (normalizedLeftWatched !== normalizedRightWatched) {
        return normalizedRightWatched - normalizedLeftWatched;
      }

      const leftEpisodes = sanitizePositiveInt(left.episodeCount) ?? -Infinity;
      const rightEpisodes = sanitizePositiveInt(right.episodeCount) ?? -Infinity;
      if (leftEpisodes !== rightEpisodes) {
        return rightEpisodes - leftEpisodes;
      }

      const leftActivityMs =
        getRewatchActivityTimestamp(left) ??
        getPlausiblePastTimestamp(left.dateUpdatedMs) ??
        getPlausiblePastTimestamp(left.dateAddedMs);
      const rightActivityMs =
        getRewatchActivityTimestamp(right) ??
        getPlausiblePastTimestamp(right.dateUpdatedMs) ??
        getPlausiblePastTimestamp(right.dateAddedMs);
      const normalizedLeftActivity = leftActivityMs == null ? Infinity : leftActivityMs;
      const normalizedRightActivity = rightActivityMs == null ? Infinity : rightActivityMs;
      if (normalizedLeftActivity !== normalizedRightActivity) {
        return normalizedLeftActivity - normalizedRightActivity;
      }

      return left.originalIndex - right.originalIndex;
    }

    const numericSortExtractors = {
      votes_desc: (entry) => sanitizeVotes(entry.votes),
      star_points_desc: (entry) => getTotalStarPoints(entry.votes, entry.distribution),
      star_5_desc: (entry) => getStarCountFromDistribution(entry.votes, entry.distribution, 5),
      star_4_desc: (entry) => getStarCountFromDistribution(entry.votes, entry.distribution, 4),
      star_3_desc: (entry) => getStarCountFromDistribution(entry.votes, entry.distribution, 3),
      star_2_desc: (entry) => getStarCountFromDistribution(entry.votes, entry.distribution, 2),
      star_1_desc: (entry) => getStarCountFromDistribution(entry.votes, entry.distribution, 1),
      star_5_pct_desc: (entry) => getStarPercentageFromDistribution(entry.distribution, 5),
      star_4_pct_desc: (entry) => getStarPercentageFromDistribution(entry.distribution, 4),
      star_3_pct_desc: (entry) => getStarPercentageFromDistribution(entry.distribution, 3),
      star_2_pct_desc: (entry) => getStarPercentageFromDistribution(entry.distribution, 2),
      star_1_pct_desc: (entry) => getStarPercentageFromDistribution(entry.distribution, 1),
      consensus_quality_desc: (entry) => getConsensusQualityScore(entry.distribution),
      controversial_desc: (entry) => getControversyScore(entry.distribution),
      quality_floor_asc: (entry) => getQualityFloorScore(entry.distribution),
      quick_wins_asc: (entry) => getQuickWinScore(entry),
      dormant_backlog_asc: (entry) => getDormantBacklogScore(entry),
      date_added_desc: (entry) => parseDateMs(entry.dateAddedMs),
      date_added_asc: (entry) => parseDateMs(entry.dateAddedMs),
      date_updated_desc: (entry) => parseDateMs(entry.dateUpdatedMs),
      date_updated_asc: (entry) => parseDateMs(entry.dateUpdatedMs)
    };

    const extractor = numericSortExtractors[state.settings.sortMode];
    if (extractor) {
      const leftValue = extractor(left);
      const rightValue = extractor(right);
      const isAscending = state.settings.sortMode.endsWith("_asc");
      const missingSentinel = isAscending ? Infinity : -Infinity;
      const normalizedLeft = leftValue == null ? missingSentinel : leftValue;
      const normalizedRight = rightValue == null ? missingSentinel : rightValue;
      if (normalizedLeft !== normalizedRight) {
        return isAscending ? normalizedLeft - normalizedRight : normalizedRight - normalizedLeft;
      }
      return left.originalIndex - right.originalIndex;
    }

    return left.originalIndex - right.originalIndex;
  }

  function withMutedObserver(work) {
    state.mutationMuted = true;
    try {
      work();
    } finally {
      window.setTimeout(() => {
        state.mutationMuted = false;
      }, 0);
    }
  }

  function createCheckboxField(id, label, checked) {
    const field = document.createElement("label");
    field.className = "cw-controls__field";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.checked = checked;

    const text = document.createElement("span");
    text.textContent = label;

    field.appendChild(input);
    field.appendChild(text);

    return { field, input };
  }

  function createSelectField(id, label, value, options) {
    const field = document.createElement("label");
    field.className = "cw-controls__field";

    const text = document.createElement("span");
    text.textContent = label;

    const select = document.createElement("select");
    select.id = id;

    options.forEach(({ optionValue, title }) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = title;
      option.selected = optionValue === value;
      select.appendChild(option);
    });

    field.appendChild(text);
    field.appendChild(select);

    return { field, select };
  }

  function setSelectOptions(select, options, selectedValue) {
    if (!select) {
      return;
    }

    const currentValue = String(selectedValue ?? "");
    const existing = Array.from(select.options).map((option) => option.value);
    const next = options.map((option) => option.optionValue);
    const unchanged = existing.length === next.length && existing.every((value, index) => value === next[index]);

    if (!unchanged) {
      select.textContent = "";
      options.forEach(({ optionValue, title }) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = title;
        select.appendChild(option);
      });
    }

    select.value = next.includes(currentValue) ? currentValue : options[0]?.optionValue || "";
  }

  function applyCardLayoutUi() {
    if (!state.hostEl) {
      return;
    }

    const layout = state.settings.cardLayout === "landscape" ? "landscape" : "portrait";
    state.hostEl.dataset.cwCardLayout = layout;
  }

  async function persistSettings() {
    await storageSet(SETTINGS_KEY, state.settings);
  }

  function ensureRootFrame(root) {
    if (!root) {
      return;
    }

    if (state.framedRootEl && state.framedRootEl !== root && state.framedRootEl.isConnected) {
      state.framedRootEl.classList.remove("cw-watchlist-frame");
    }

    root.classList.add("cw-watchlist-frame");
    state.framedRootEl = root;
  }

  function clearRootFrame() {
    if (state.framedRootEl && state.framedRootEl.isConnected) {
      state.framedRootEl.classList.remove("cw-watchlist-frame");
    }
    state.framedRootEl = null;
  }

  function setNativeVisibility(showNative) {
    const root = getWatchlistRoot();
    if (!root) {
      return;
    }

    if (showNative) {
      const flaggedNodes = Array.from(root.querySelectorAll("[data-cw-prev-display]"));
      const restoreCandidates = new Set([...state.nativeHiddenNodes, ...flaggedNodes]);

      restoreCandidates.forEach((node) => {
        if (!(node instanceof HTMLElement) || !node.isConnected) {
          return;
        }

        const previousDisplay = node.dataset.cwPrevDisplay;
        node.style.display = previousDisplay != null ? previousDisplay : "";
        delete node.dataset.cwPrevDisplay;
      });

      state.nativeHiddenNodes = [];

      window.requestAnimationFrame(() => {
        try {
          window.dispatchEvent(new Event("resize"));
          window.dispatchEvent(new Event("scroll"));
        } catch (_) {
          // no-op
        }
      });
      return;
    }

    const children = Array.from(root.children).filter((child) => child !== state.hostEl);

    state.nativeHiddenNodes = [];
    children.forEach((node) => {
      if (!Object.prototype.hasOwnProperty.call(node.dataset, "cwPrevDisplay")) {
        node.dataset.cwPrevDisplay = node.style.display || "";
      }
      node.style.display = "none";
      state.nativeHiddenNodes.push(node);
    });
  }

  function createTabButton(label, tabValue) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cw-tab";
    button.textContent = label;
    button.dataset.cwTab = tabValue;
    return button;
  }

  function formatVotes(votes) {
    if (votes == null) {
      return "";
    }

    try {
      return Number(votes).toLocaleString();
    } catch (_) {
      return String(votes);
    }
  }

  function formatLastWatchedValue(value) {
    const timestamp = getPlausiblePastTimestamp(value);
    if (timestamp == null) {
      return null;
    }

    let dateLabel;
    try {
      dateLabel = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(timestamp);
    } catch (_) {
      dateLabel = new Date(timestamp).toISOString().slice(0, 10);
    }

    const daysAgo = Math.max(0, Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
    if (daysAgo === 0) {
      return `${dateLabel} (today)`;
    }
    if (daysAgo === 1) {
      return `${dateLabel} (1 day ago)`;
    }
    return `${dateLabel} (${daysAgo} days ago)`;
  }

  function getLastWatchedPresentation(entry) {
    if (entry?.neverWatched) {
      return {
        state: "never",
        text: "never"
      };
    }

    const formatted = formatLastWatchedValue(entry?.lastWatchedMs);
    if (formatted) {
      return {
        state: "dated",
        text: formatted
      };
    }

    if (state.watchHistoryStatus === "ready") {
      return {
        state: "retained-miss",
        text: "not in retained history"
      };
    }

    if (state.watchHistoryStatus === "failed") {
      return {
        state: "history-unavailable",
        text: "history unavailable"
      };
    }

    return {
      state: "unknown",
      text: "unknown"
    };
  }

  function createLoadingIndicator(text) {
    const loading = document.createElement("span");
    loading.className = "cw-loading";

    const spinner = document.createElement("span");
    spinner.className = "cw-spinner";
    spinner.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "cw-loading__label";
    label.textContent = text;

    loading.appendChild(spinner);
    loading.appendChild(label);
    return loading;
  }

  function makeRatingBadge(rating, votes) {
    const badge = document.createElement("span");
    badge.className = "cw-rating-badge";

    if (rating != null && Number.isFinite(Number(rating))) {
      const normalized = Number(rating);
      badge.dataset.cwRatingState = "ok";
      badge.textContent = `★ ${normalized.toFixed(1)}`;
      badge.title = votes != null ? `${normalized.toFixed(1)} (${formatVotes(votes)} ratings)` : `${normalized.toFixed(1)}`;
    } else {
      badge.dataset.cwRatingState = "missing";
      badge.textContent = "NR";
      badge.title = "No rating found";
    }

    return badge;
  }

  function getStarCountFromDistribution(votes, distribution, starLevel) {
    const percentage = sanitizePercentage(distribution?.[String(starLevel)]);
    const normalizedVotes = sanitizeVotes(votes);
    if (percentage == null || normalizedVotes == null) {
      return null;
    }

    return Math.round((normalizedVotes * percentage) / 100);
  }

  function getStarPercentageFromDistribution(distribution, starLevel) {
    return sanitizePercentage(distribution?.[String(starLevel)]);
  }

  function getTotalStarPoints(votes, distribution) {
    let total = 0;
    let hasAny = false;

    for (let star = 1; star <= 5; star += 1) {
      const count = getStarCountFromDistribution(votes, distribution, star);
      if (count == null) {
        continue;
      }

      hasAny = true;
      total += count * star;
    }

    return hasAny ? total : null;
  }

  function getConsensusQualityScore(distribution) {
    const p5 = getStarPercentageFromDistribution(distribution, 5);
    const p4 = getStarPercentageFromDistribution(distribution, 4);
    const p2 = getStarPercentageFromDistribution(distribution, 2);
    const p1 = getStarPercentageFromDistribution(distribution, 1);

    if (p5 == null && p4 == null && p2 == null && p1 == null) {
      return null;
    }

    return (p5 ?? 0) + (p4 ?? 0) - (p2 ?? 0) - (p1 ?? 0);
  }

  function getControversyScore(distribution) {
    if (!distribution || typeof distribution !== "object") {
      return null;
    }

    const buckets = [];
    for (let star = 1; star <= 5; star += 1) {
      const percentage = getStarPercentageFromDistribution(distribution, star);
      if (percentage != null && percentage > 0) {
        buckets.push({ star, percentage });
      }
    }

    const totalPercentage = buckets.reduce((sum, bucket) => sum + bucket.percentage, 0);
    if (!buckets.length || totalPercentage <= 0) {
      return null;
    }

    const mean = buckets.reduce((sum, bucket) => sum + bucket.star * (bucket.percentage / totalPercentage), 0);
    const variance = buckets.reduce(
      (sum, bucket) => sum + ((bucket.star - mean) ** 2) * (bucket.percentage / totalPercentage),
      0
    );
    return variance;
  }

  function getQualityFloorScore(distribution) {
    const p1 = getStarPercentageFromDistribution(distribution, 1);
    const p2 = getStarPercentageFromDistribution(distribution, 2);
    if (p1 == null && p2 == null) {
      return null;
    }

    return (p1 ?? 0) * 2 + (p2 ?? 0);
  }

  function getQuickWinScore(entry) {
    const unwatchedLeft = estimateUnwatchedEpisodesLeft(entry);
    const remaining = unwatchedLeft ?? sanitizePositiveInt(entry?.episodeCount);
    if (remaining == null) {
      return null;
    }

    const watchReadyPenalty = entry?.watchReady ? 0 : 100000;
    return watchReadyPenalty + remaining;
  }

  function getWatchedEpisodeEstimate(entry) {
    const totalEpisodes = sanitizePositiveInt(entry?.episodeCount);
    if (totalEpisodes == null) {
      return null;
    }

    const unwatchedLeft = estimateUnwatchedEpisodesLeft(entry);
    if (unwatchedLeft == null) {
      return null;
    }

    return Math.max(0, totalEpisodes - Math.max(0, Number(unwatchedLeft) || 0));
  }

  function getPlausiblePastTimestamp(value) {
    const parsed = parseDateMs(value);
    if (parsed == null) {
      return null;
    }

    // Ignore sentinel/future timestamps (e.g. availability window far-future values).
    const latestAllowed = Date.now() + 2 * 24 * 60 * 60 * 1000;
    if (parsed > latestAllowed) {
      return null;
    }

    return parsed;
  }

  function getRewatchActivityTimestamp(entry) {
    const lastWatched = getPlausiblePastTimestamp(entry?.lastWatchedMs);
    if (lastWatched != null) {
      return lastWatched;
    }

    const watchedEpisodes = getWatchedEpisodeEstimate(entry);
    if (watchedEpisodes == null || watchedEpisodes <= 0) {
      return null;
    }

    return getPlausiblePastTimestamp(entry?.dateUpdatedMs) ?? getPlausiblePastTimestamp(entry?.dateAddedMs);
  }

  function getDormantBacklogScore(entry) {
    const updatedAt =
      getRewatchActivityTimestamp(entry) ??
      getPlausiblePastTimestamp(entry?.dateUpdatedMs) ??
      getPlausiblePastTimestamp(entry?.dateAddedMs);
    if (updatedAt == null) {
      return null;
    }

    const watchReadyPenalty = entry?.watchReady ? 0 : 10000000000000;
    return watchReadyPenalty + updatedAt;
  }

  function getRewatchMemoryScore(entry) {
    const updatedAt = getRewatchActivityTimestamp(entry);
    const episodeCount = sanitizePositiveInt(entry?.episodeCount);
    if (updatedAt == null || episodeCount == null) {
      return null;
    }

    const watchedEpisodes = getWatchedEpisodeEstimate(entry);
    if (watchedEpisodes == null || watchedEpisodes <= 0) {
      return null;
    }

    const watchedRatio = watchedEpisodes / episodeCount;
    if (!Number.isFinite(watchedRatio) || watchedRatio < 0.2) {
      return null;
    }

    const dormantDays = Math.max(0, (Date.now() - updatedAt) / (24 * 60 * 60 * 1000));
    if (dormantDays < 21) {
      return null;
    }

    const lengthFactor = 1 + Math.max(0, episodeCount - 12) / 24;
    const progressFactor = 0.5 + watchedRatio;
    return watchedEpisodes * dormantDays * lengthFactor * progressFactor;
  }

  function estimateUnwatchedEpisodesLeft(entry) {
    const filteredProgressEntry =
      entry?.watchHistoryProgressEntry && typeof entry.watchHistoryProgressEntry === "object"
        ? entry.watchHistoryProgressEntry
        : null;
    const totalEpisodes = sanitizePositiveInt(entry?.episodeCount);
    if (totalEpisodes == null) {
      return null;
    }

    if (entry?.fullyWatched) {
      return 0;
    }

    if (entry?.neverWatched) {
      return totalEpisodes;
    }

    const overrideEpisodeIndex = pickFirstPositiveInt([
      filteredProgressEntry?.absoluteEpisodeNumber,
      filteredProgressEntry?.seasonNumber === 1 ? filteredProgressEntry?.episodeNumber : null
    ]);
    const overrideNextEpisodeIndex =
      overrideEpisodeIndex != null
        ? overrideEpisodeIndex + (filteredProgressEntry?.fullyWatched ? 1 : 0)
        : null;

    const nextEpisodeIndex =
      overrideNextEpisodeIndex ??
      pickFirstPositiveInt([
        entry?.absoluteEpisodeNumber,
        entry?.seasonNumber === 1 ? entry?.episodeNumber : null
      ]);

    if (nextEpisodeIndex == null) {
      return null;
    }

    return Math.max(0, totalEpisodes - nextEpisodeIndex + 1);
  }

  function appendLabeledValue(element, label, value) {
    const labelNode = document.createElement("span");
    labelNode.textContent = `${label}: `;

    const valueNode = document.createElement("span");
    valueNode.className = "cw-curated-card__value";
    valueNode.textContent = String(value);

    element.appendChild(labelNode);
    element.appendChild(valueNode);
  }

  function setLabeledValue(element, label, value) {
    element.textContent = "";
    appendLabeledValue(element, label, value);
  }

  function setLabeledValuePairs(element, pairs) {
    element.textContent = "";

    pairs.forEach(({ label, value }, index) => {
      if (index > 0) {
        element.appendChild(document.createTextNode(" | "));
      }
      appendLabeledValue(element, label, value);
    });
  }

  function getSeriesScopePairs(entry) {
    const pairs = [];
    const seasons = sanitizePositiveInt(entry?.seasonCount);
    const episodes = sanitizePositiveInt(entry?.episodeCount);
    const left = estimateUnwatchedEpisodesLeft(entry);

    if (seasons != null) {
      pairs.push({ label: "Seasons", value: seasons });
    }

    if (episodes != null) {
      pairs.push({ label: "Episodes", value: episodes });
    }

    if (left != null) {
      pairs.push({ label: "Unwatched left", value: left });
    }

    return pairs;
  }

  function getGenreValue(entry) {
    const genreTags = normalizeTagList(entry?.genreTags || []);
    if (!genreTags.length) {
      return "";
    }

    return genreTags.slice(0, 3).join(", ");
  }

  function makeRatingHistogram(distribution, votes) {
    const histogram = document.createElement("div");
    histogram.className = "cw-rating-histogram";

    if (!distribution || typeof distribution !== "object") {
      const missing = document.createElement("div");
      missing.className = "cw-rating-histogram__missing";
      missing.textContent = "Rating distribution unavailable";
      histogram.appendChild(missing);
      return histogram;
    }

    for (let star = 5; star >= 1; star -= 1) {
      const row = document.createElement("div");
      row.className = "cw-rating-row";

      const label = document.createElement("span");
      label.className = "cw-rating-row__label";
      label.textContent = `${star}★`;

      const track = document.createElement("span");
      track.className = "cw-rating-row__track";

      const fill = document.createElement("span");
      fill.className = "cw-rating-row__fill";
      const percentage = sanitizePercentage(distribution[String(star)]) ?? 0;
      fill.style.width = `${percentage}%`;

      const percentageText = document.createElement("span");
      percentageText.className = "cw-rating-row__percentage";
      percentageText.textContent = `${percentage}%`;

      const countText = document.createElement("span");
      countText.className = "cw-rating-row__count";
      const starCount = getStarCountFromDistribution(votes, distribution, star);
      countText.textContent = starCount != null ? formatVotes(starCount) : "-";

      track.appendChild(fill);
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(percentageText);
      row.appendChild(countText);
      histogram.appendChild(row);
    }

    return histogram;
  }

  function getCardCoverImage(entry, layout = state.settings.cardLayout) {
    const portrait = normalizeImageUrlCandidate(entry?.portraitImageUrl);
    const landscape = normalizeImageUrlCandidate(entry?.landscapeImageUrl);
    const fallback = normalizeImageUrlCandidate(entry?.imageUrl);
    if (layout === "landscape") {
      return landscape || portrait || fallback;
    }
    return portrait || landscape || fallback;
  }

  function createCuratedCard(entry) {
    const item = document.createElement("article");
    item.className = "cw-curated-card";
    item.dataset.cwSeriesId = entry.seriesId;
    item.dataset.cwCuratedTitle = entry.fixtureTitle || entry.title;
    const cardHref = resolveApiHref(entry.href || "");
    if (entry.dimNotWatchReady) {
      item.classList.add("cw-curated-card--not-watch-ready");
    }
    if (cardHref) {
      item.classList.add("cw-curated-card--clickable");
      item.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        if (target.closest("a, button, input, select, textarea, label, [role='button']")) {
          return;
        }

        const selection = window.getSelection();
        if (selection && selection.type === "Range") {
          return;
        }

        window.location.assign(cardHref);
      });
    }

    const titleLink = document.createElement("a");
    titleLink.className = "cw-curated-card__title";
    titleLink.href = entry.href || "#";
    titleLink.textContent = entry.title;

    const ratingBadge = makeRatingBadge(entry.rating, entry.votes);
    ratingBadge.classList.add("cw-rating-badge--headline");

    const header = document.createElement("div");
    header.className = "cw-curated-card__header";
    header.appendChild(titleLink);
    header.appendChild(ratingBadge);

    const media = document.createElement("div");
    media.className = "cw-curated-card__media";

    const thumbLink = document.createElement("a");
    thumbLink.className = "cw-curated-card__thumb";
    thumbLink.href = entry.href || "#";
    thumbLink.setAttribute("aria-label", entry.title);
    thumbLink.dataset.cwSeriesId = entry.seriesId || "";

    const coverImageUrl = getCardCoverImage(entry);
    const hoverPreviewImageUrl = normalizeImageUrlCandidate(entry.hoverPreviewImageUrl);

    let thumbImage = null;
    let previewImage = null;
    let previewVideo = null;
    let previewTimer = null;
    let previewPollTimer = null;
    let previewSession = 0;
    let activeNativeCard = null;

    if (coverImageUrl) {
      const image = document.createElement("img");
      image.loading = "lazy";
      image.src = coverImageUrl;
      image.alt = "";
      thumbLink.appendChild(image);
      thumbImage = image;
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "cw-curated-card__placeholder";
      placeholder.textContent = "No Image";
      thumbLink.appendChild(placeholder);
    }

    const stopPreview = () => {
      clearTimeout(previewTimer);
      clearTimeout(previewPollTimer);
      previewTimer = null;
      previewPollTimer = null;

      if (activeNativeCard) {
        try {
          activeNativeCard.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true, cancelable: true }));
          activeNativeCard.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, cancelable: true }));
        } catch (_) {
          // no-op
        }
      }
      activeNativeCard = null;

      if (previewVideo) {
        previewVideo.pause();
        previewVideo.currentTime = 0;
        previewVideo.style.display = "none";
      }

      if (previewImage) {
        previewImage.style.display = "none";
      }

      thumbLink.classList.remove("cw-curated-card__thumb--previewing");
      if (thumbImage) {
        thumbImage.style.opacity = "";
      }
    };

    const showPreviewImage = (url) => {
      if (!url) {
        return;
      }

      if (!previewImage) {
        previewImage = document.createElement("img");
        previewImage.className = "cw-curated-card__preview cw-curated-card__preview-image";
        previewImage.alt = "";
        previewImage.setAttribute("aria-hidden", "true");
        thumbLink.appendChild(previewImage);
      }

      previewImage.src = url;
      previewImage.style.display = "block";

      if (previewVideo) {
        previewVideo.pause();
        previewVideo.style.display = "none";
      }

      thumbLink.classList.add("cw-curated-card__thumb--previewing");
      if (thumbImage) {
        thumbImage.style.opacity = "0";
      }
    };

    const showPreviewVideo = async (url) => {
      if (!url) {
        return;
      }

      if (!previewVideo) {
        previewVideo = document.createElement("video");
        previewVideo.className = "cw-curated-card__preview cw-curated-card__preview-video";
        previewVideo.muted = true;
        previewVideo.loop = true;
        previewVideo.playsInline = true;
        previewVideo.preload = "none";
        previewVideo.setAttribute("aria-hidden", "true");
        thumbLink.appendChild(previewVideo);
      }

      if (previewVideo.src !== url) {
        previewVideo.src = url;
      }
      previewVideo.style.display = "block";

      if (previewImage) {
        previewImage.style.display = "none";
      }

      thumbLink.classList.add("cw-curated-card__thumb--previewing");
      if (thumbImage) {
        thumbImage.style.opacity = "0";
      }

      try {
        await previewVideo.play();
      } catch (_) {
        stopPreview();
      }
    };

    const startMirroredNativePreview = (sessionId) =>
      new Promise((resolve) => {
        const nativeCard = findNativeCardBySeriesId(entry.seriesId);
        if (!nativeCard) {
          resolve(false);
          return;
        }

        activeNativeCard = nativeCard;
        let baseline = "";
        try {
          baseline = getNativeCardPreviewUrl(nativeCard);
        } catch (_) {
          resolve(false);
          return;
        }
        const fallbackPoster = thumbImage?.currentSrc || thumbImage?.src || coverImageUrl || "";

        try {
          nativeCard.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
          nativeCard.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
        } catch (_) {
          // no-op
        }

        let attempts = 0;
        const poll = () => {
          try {
            if (sessionId !== previewSession) {
              resolve(false);
              return;
            }

            const current = getNativeCardPreviewUrl(nativeCard);
            if (current && current !== baseline && current !== fallbackPoster) {
              showPreviewImage(current);
              resolve(true);
              return;
            }

            attempts += 1;
            if (attempts >= 8) {
              resolve(false);
              return;
            }

            previewPollTimer = window.setTimeout(poll, 120);
          } catch (_) {
            resolve(false);
          }
        };

        previewPollTimer = window.setTimeout(poll, 120);
      });

    const startPreview = async (sessionId) => {
      const mirrored = await startMirroredNativePreview(sessionId);
      if (mirrored || sessionId !== previewSession) {
        return;
      }

      if (!entry.streamsLink) {
        const fallbackPreview = hoverPreviewImageUrl || coverImageUrl;
        if (fallbackPreview) {
          showPreviewImage(fallbackPreview);
        }
        return;
      }

      let previewUrl = null;
      try {
        previewUrl = await fetchPreviewUrlForEntry(entry);
      } catch (_) {
        previewUrl = null;
      }

      if (!previewUrl || sessionId !== previewSession) {
        if (sessionId === previewSession) {
          const fallbackPreview = hoverPreviewImageUrl || coverImageUrl;
          if (fallbackPreview) {
            showPreviewImage(fallbackPreview);
          }
        }
        return;
      }

      const normalizedPreviewUrl = normalizeImageUrlCandidate(previewUrl);
      if (
        normalizedPreviewUrl &&
        coverImageUrl &&
        normalizedPreviewUrl === coverImageUrl &&
        hoverPreviewImageUrl &&
        hoverPreviewImageUrl !== coverImageUrl
      ) {
        showPreviewImage(hoverPreviewImageUrl);
        return;
      }

      if (isLikelyVideoUrl(previewUrl)) {
        await showPreviewVideo(previewUrl);
      } else {
        showPreviewImage(previewUrl);
      }
    };

    const queuePreview = () => {
      previewSession += 1;
      const currentSession = previewSession;
      clearTimeout(previewTimer);
      previewTimer = window.setTimeout(() => {
        startPreview(currentSession).catch(() => {
          // no-op
        });
      }, PREVIEW_HOVER_DELAY_MS);
    };

    thumbLink.addEventListener("mouseenter", queuePreview);

    thumbLink.addEventListener("mouseleave", () => {
      previewSession += 1;
      stopPreview();
    });

    thumbLink.addEventListener("blur", () => {
      previewSession += 1;
      stopPreview();
    });

    const actions = document.createElement("div");
    actions.className = "cw-curated-card__actions";

    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = `cw-card-action cw-card-action--favorite${entry.isFavorite ? " is-active" : ""}`;
    favoriteButton.dataset.cwAction = "favorite";
    favoriteButton.setAttribute("aria-label", entry.isFavorite ? "Unfavorite" : "Favorite");
    favoriteButton.setAttribute("aria-pressed", entry.isFavorite ? "true" : "false");
    favoriteButton.title = entry.isFavorite ? "Unfavorite" : "Favorite";
    favoriteButton.textContent = entry.isFavorite ? "♥" : "♡";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "cw-card-action cw-card-action--remove";
    removeButton.dataset.cwAction = "remove";
    removeButton.setAttribute("aria-label", "Remove from watchlist");
    removeButton.title = "Remove from watchlist";
    removeButton.textContent = "🗑";

    if (!entry.seriesId) {
      favoriteButton.disabled = true;
      removeButton.disabled = true;
    }

    const missingActionMessage =
      "Crunchyroll action controls are not loaded for this show yet. Open the Crunchyroll tab and scroll this show into view once, then retry.";

    favoriteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const forwarded = triggerNativeCardAction(entry.seriesId, "favorite");
      if (!forwarded) {
        window.alert(missingActionMessage);
        return;
      }

      toggleCuratedFavorite(entry.seriesId);
      renderCuratedPanel();
    });

    removeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const confirmed = window.confirm(`Remove "${entry.title}" from your Crunchyroll watchlist?`);
      if (!confirmed) {
        return;
      }

      const forwarded = triggerNativeCardAction(entry.seriesId, "remove");
      if (!forwarded) {
        window.alert(missingActionMessage);
        return;
      }

      removeCuratedSeries(entry.seriesId);
      renderCuratedPanel();
    });

    actions.appendChild(favoriteButton);
    actions.appendChild(removeButton);

    media.appendChild(thumbLink);

    const body = document.createElement("div");
    body.className = "cw-curated-card__body";

    const description = document.createElement("div");
    description.className = "cw-curated-card__description";
    description.textContent = entry.description || "No description available.";

    const status = document.createElement("div");
    status.className = "cw-curated-card__status";
    status.textContent = entry.statusBase || "Up Next";

    const lastWatched = document.createElement("div");
    lastWatched.className = "cw-curated-card__last-watched";
    const lastWatchedPresentation = getLastWatchedPresentation(entry);
    lastWatched.dataset.cwLastWatchedState = lastWatchedPresentation.state;
    setLabeledValue(lastWatched, "Last watched", lastWatchedPresentation.text);

    const nextEpisode = document.createElement("div");
    nextEpisode.className = "cw-curated-card__next";
    if (entry.fullyWatched) {
      setLabeledValue(nextEpisode, "Next unwatched", "none");
    } else if (entry.nextEpisodeLabel) {
      setLabeledValue(nextEpisode, "Next unwatched", entry.nextEpisodeLabel);
    } else {
      setLabeledValue(nextEpisode, "Next unwatched", "unknown");
    }

    const scope = document.createElement("div");
    scope.className = "cw-curated-card__scope";
    const scopePairs = getSeriesScopePairs(entry);
    if (scopePairs.length) {
      const summaryPairs = scopePairs.filter(({ label }) => label !== "Unwatched left");
      const unwatchedPair = scopePairs.find(({ label }) => label === "Unwatched left");

      if (summaryPairs.length) {
        setLabeledValuePairs(scope, summaryPairs);
      }

      if (unwatchedPair) {
        if (summaryPairs.length) {
          scope.appendChild(document.createElement("br"));
        } else {
          scope.textContent = "";
        }
        appendLabeledValue(scope, unwatchedPair.label, unwatchedPair.value);
      }
    } else {
      scope.textContent = "Series totals unavailable";
    }

    const genres = document.createElement("div");
    genres.className = "cw-curated-card__genres";
    const genreValue = getGenreValue(entry);
    if (genreValue) {
      setLabeledValue(genres, "Genres", genreValue);
    }

    const histogram = makeRatingHistogram(entry.distribution, entry.votes);

    const actionsRow = document.createElement("div");
    actionsRow.className = "cw-curated-card__actions-row";

    const ratingMeta = document.createElement("div");
    ratingMeta.className = "cw-curated-card__rating-meta";
    setLabeledValue(ratingMeta, "Ratings", entry.votes != null ? formatVotes(entry.votes) : "none");

    actionsRow.appendChild(ratingMeta);
    actionsRow.appendChild(actions);

    body.appendChild(description);
    body.appendChild(status);
    body.appendChild(lastWatched);
    body.appendChild(nextEpisode);
    body.appendChild(scope);
    if (genreValue) {
      body.appendChild(genres);
    }
    body.appendChild(histogram);
    body.appendChild(actionsRow);

    item.appendChild(header);
    item.appendChild(media);
    item.appendChild(body);

    return item;
  }

  function buildRenderableEntries() {
    const normalizedAudioFilter = String(state.settings.audioLocaleFilter || "any");
    const normalizedGenreFilter = String(state.settings.genreFilter || "any");
    const effectiveAudioFilter = normalizedAudioFilter.trim() || "any";
    const effectiveGenreFilter = normalizedGenreFilter.trim() || "any";
    const localizedAudioForCounts = effectiveAudioFilter !== "any" ? effectiveAudioFilter : null;
    const selectedAudioLocale =
      effectiveAudioFilter !== "any" ? normalizeAudioLocale(effectiveAudioFilter) : null;
    const selectedAudioIsDefaultPreferred = selectedAudioLocale
      ? selectedAudioLocale.toLowerCase() === getPreferredAudioLanguage().toLowerCase()
      : false;

    const merged = state.curatedEntries.map((entry) => {
      const ratingEntry = getCachedRating(entry.seriesId);
      const watchHistoryEntry = getCachedWatchHistory(entry.seriesId);
      const localeWatchHistoryEntry =
        selectedAudioLocale
          ? getCachedWatchHistory(entry.seriesId, selectedAudioLocale, false)
          : null;
      const watchHistoryProgressFallback = getCachedWatchHistoryProgress(entry.seriesId);
      const localeWatchHistoryProgressEntry =
        selectedAudioLocale
          ? getCachedWatchHistoryProgress(entry.seriesId, selectedAudioLocale, false)
          : null;
      const watchHistoryProgressEntry =
        localeWatchHistoryProgressEntry ||
        (selectedAudioIsDefaultPreferred ? watchHistoryProgressFallback : null) ||
        localeWatchHistoryEntry ||
        (selectedAudioIsDefaultPreferred ? watchHistoryEntry : null);
      const rating = ratingEntry?.rating ?? null;
      const votes = ratingEntry?.votes ?? null;
      const distribution = ratingEntry?.distribution ?? null;
      const audioLocales = normalizeAudioLocales(
        (Array.isArray(ratingEntry?.audioLocales) && ratingEntry.audioLocales.length
          ? ratingEntry.audioLocales
          : entry.audioLocales) || []
      );
      const hasEnglishAudio = hasEnUsAudio(audioLocales);
      const description =
        (typeof ratingEntry?.description === "string" && ratingEntry.description.trim()
          ? ratingEntry.description.trim()
          : "") ||
        entry.description ||
        "";
      const knownEpisodeCountForSelectedAudio =
        localizedAudioForCounts
          ? getAudioLocaleCountFromMap(entry?.knownEpisodeMaxByAudioLocale, localizedAudioForCounts)
          : null;
      const episodeCount =
        getLocalizedSeriesCount(ratingEntry, localizedAudioForCounts, "episode") ??
        knownEpisodeCountForSelectedAudio ??
        sanitizePositiveInt(entry.episodeCount);
      const seasonCount =
        getLocalizedSeriesCount(ratingEntry, localizedAudioForCounts, "season") ?? sanitizePositiveInt(entry.seasonCount);
      const genreTags = normalizeTagList(
        (Array.isArray(ratingEntry?.genreTags) && ratingEntry.genreTags.length
          ? ratingEntry.genreTags
          : entry.genreTags) || []
      );
      const portraitImageUrl =
        normalizeImageUrlCandidate(ratingEntry?.portraitImageUrl) ||
        normalizeImageUrlCandidate(entry.portraitImageUrl) ||
        normalizeImageUrlCandidate(entry.imageUrl);
      const landscapeImageUrl =
        normalizeImageUrlCandidate(ratingEntry?.landscapeImageUrl) ||
        normalizeImageUrlCandidate(entry.landscapeImageUrl) ||
        portraitImageUrl;
      const hoverPreviewImageUrl = normalizeImageUrlCandidate(entry.hoverPreviewImageUrl);
      const lastWatchedMs = pickFirstDateMs([
        watchHistoryEntry?.datePlayedMs,
        entry.lastWatchedMs
      ]);
      const mergedEntry = {
        ...entry,
        description,
        distribution,
        audioLocales,
        hasEnglishAudio,
        episodeCount,
        seasonCount,
        genreTags,
        portraitImageUrl,
        landscapeImageUrl,
        hoverPreviewImageUrl,
        lastWatchedMs,
        watchHistoryProgressEntry,
        imageUrl: portraitImageUrl || landscapeImageUrl || normalizeImageUrlCandidate(entry.imageUrl),
        rating,
        votes
      };
      const statusBase = deriveDisplayStatusBase(mergedEntry, localeWatchHistoryEntry || watchHistoryEntry);
      const watchReady = isEntryWatchReady(mergedEntry);

      return {
        ...mergedEntry,
        statusBase,
        watchReady
      };
    });

    let filtered = merged.slice();
    const watchReadyFilterMode = ["none", "dim", "hide"].includes(state.settings.watchReadyFilterMode)
      ? state.settings.watchReadyFilterMode
      : "hide";
    const audioValues = Array.from(
      new Set(
        merged
          .flatMap((entry) => entry.audioLocales || [])
          .map((locale) => String(locale || "").trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right));
    const genreValues = Array.from(
      new Set(
        merged
          .flatMap((entry) => entry.genreTags || [])
          .map((tag) => String(tag || "").trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right));

    if (effectiveAudioFilter !== "any") {
      filtered = filtered.filter((entry) =>
        (entry.audioLocales || []).some((locale) => String(locale).toLowerCase() === effectiveAudioFilter.toLowerCase())
      );
    }

    if (effectiveGenreFilter !== "any") {
      filtered = filtered.filter((entry) =>
        (entry.genreTags || []).some((tag) => String(tag).toLowerCase() === effectiveGenreFilter.toLowerCase())
      );
    }

    if (watchReadyFilterMode === "hide") {
      filtered = filtered.filter((entry) => entry.watchReady);
    }

    const decorated = filtered.map((entry) => ({
      ...entry,
      dimNotWatchReady: watchReadyFilterMode === "dim" && !entry.watchReady
    }));

    decorated.sort(compareRenderableEntries);

    return {
      mode: watchReadyFilterMode,
      total: merged.length,
      visible: decorated,
      audioOptions: [
        { optionValue: "any", title: "Any language" },
        ...(effectiveAudioFilter !== "any" && !audioValues.includes(effectiveAudioFilter)
          ? [{ optionValue: effectiveAudioFilter, title: `${effectiveAudioFilter} (no matches)` }]
          : []),
        ...audioValues.map((value) => ({ optionValue: value, title: value }))
      ],
      genreOptions: [
        { optionValue: "any", title: "Any genre" },
        ...(effectiveGenreFilter !== "any" && !genreValues.includes(effectiveGenreFilter)
          ? [{ optionValue: effectiveGenreFilter, title: `${effectiveGenreFilter} (no matches)` }]
          : []),
        ...genreValues.map((value) => ({ optionValue: value, title: value }))
      ],
      selectedAudioFilter: effectiveAudioFilter,
      selectedGenreFilter: effectiveGenreFilter
    };
  }

  function renderCuratedPanel() {
    if (!state.gridEl || !state.statsEl) {
      return;
    }

    applyCardLayoutUi();

    const {
      mode: watchReadyFilterMode,
      total,
      visible,
      audioOptions,
      genreOptions,
      selectedAudioFilter,
      selectedGenreFilter
    } = buildRenderableEntries();
    const loading = Boolean(state.curatedInflight);
    const gridRenderSignature = JSON.stringify(
      visible.length
        ? {
            layout: state.settings.cardLayout,
            visible
          }
        : {
            layout: state.settings.cardLayout,
            emptyState:
              state.curatedError && total === 0
                ? `error:${state.curatedError}`
                : loading && total === 0
                  ? "loading"
                  : total > 0
                    ? "no-match"
                    : "no-watchlist"
          }
    );

    withMutedObserver(() => {
      setSelectOptions(state.audioFilterSelectEl, audioOptions, selectedAudioFilter);
      setSelectOptions(state.genreFilterSelectEl, genreOptions, selectedGenreFilter);

      if (state.loadingIndicatorEl) {
        state.loadingIndicatorEl.style.display = loading ? "inline-flex" : "none";
      }

      if (state.curatedGridRenderSignature !== gridRenderSignature) {
        state.gridEl.textContent = "";

        if (!visible.length) {
          const empty = document.createElement("div");
          empty.className = "cw-empty";
          if (state.curatedError && total === 0) {
            empty.textContent = state.curatedError;
          } else if (loading && total === 0) {
            const loadingContent = createLoadingIndicator("Loading curated watchlist from Crunchyroll API...");
            empty.appendChild(loadingContent);
          } else if (total > 0) {
            empty.textContent = "No shows match the current filters.";
          } else {
            empty.textContent = "No watchlist items were returned by Crunchyroll.";
          }
          state.gridEl.appendChild(empty);
        } else {
          const fragment = document.createDocumentFragment();
          visible.forEach((entry) => {
            fragment.appendChild(createCuratedCard(entry));
          });
          state.gridEl.appendChild(fragment);
        }

        state.curatedGridRenderSignature = gridRenderSignature;
      }

      if (state.curatedError && total === 0) {
        state.statsEl.textContent = "API load failed";
      } else if (loading && total === 0) {
        state.statsEl.textContent = "Loading...";
      } else if (loading && total > 0) {
        const base = watchReadyFilterMode === "hide"
          ? `Showing ${visible.length} of ${total}`
          : `${total} shows`;
        state.statsEl.textContent = `${base} (refreshing...)`;
      } else if (state.curatedError) {
        state.statsEl.textContent = state.curatedError;
      } else {
        state.statsEl.textContent = watchReadyFilterMode === "hide"
          ? `Showing ${visible.length} of ${total}`
          : `${total} shows`;
      }
    });

    const shouldPreloadLocalizedRatings =
      selectedAudioFilter !== "any" &&
      isLocalizedRatingDataMissingForEntries(state.curatedEntries, selectedAudioFilter);
    const shouldPreloadLocalizedWatchHistory =
      selectedAudioFilter !== "any" &&
      isLocalizedWatchHistoryDataMissingForEntries(state.curatedEntries, selectedAudioFilter);

    if (shouldPreloadLocalizedRatings || shouldPreloadLocalizedWatchHistory) {
      const preloadTasks = [];
      if (shouldPreloadLocalizedRatings) {
        preloadTasks.push(preloadRatingsForSelectedAudioLocale(selectedAudioFilter));
      }
      if (shouldPreloadLocalizedWatchHistory) {
        preloadTasks.push(preloadWatchHistoryForSelectedAudioLocale(selectedAudioFilter));
      }

      Promise.allSettled(preloadTasks).then(() => {
        if (!state.mounted || !isWatchlistPath(window.location.pathname)) {
          return;
        }
        renderCuratedPanel();
      });
    }
  }

  function applyTabUi() {
    if (!state.tabCrunchyrollEl || !state.tabCuratedEl || !state.curatedPanelEl) {
      return;
    }

    const curatedActive = state.settings.activeTab === "curated";

    withMutedObserver(() => {
      state.tabCrunchyrollEl.setAttribute("aria-selected", curatedActive ? "false" : "true");
      state.tabCuratedEl.setAttribute("aria-selected", curatedActive ? "true" : "false");
      state.tabCrunchyrollEl.classList.toggle("cw-tab--active", !curatedActive);
      state.tabCuratedEl.classList.toggle("cw-tab--active", curatedActive);
      state.curatedPanelEl.style.display = curatedActive ? "block" : "none";
    });

    setNativeVisibility(!curatedActive);
  }

  async function setActiveTab(tabValue) {
    if (tabValue !== "crunchyroll" && tabValue !== "curated") {
      return;
    }

    if (state.settings.activeTab === tabValue) {
      applyTabUi();
      if (tabValue === "curated") {
        renderCuratedPanel();
      }
      return;
    }

    state.settings.activeTab = tabValue;
    await persistSettings();
    applyTabUi();
    if (tabValue === "curated") {
      ensureCuratedDataLoad(false);
      renderCuratedPanel();
    }
    debounceProcess();
  }

  function ensureInterface() {
    const root = getWatchlistRoot();
    const header = getWatchlistHeader();

    if (!root || !header) {
      runtimeEvent("ui-missing-watchlist-structure");
      return;
    }

    ensureRootFrame(root);

    if (state.hostEl && state.hostEl.isConnected) {
      return;
    }

    const host = document.createElement("section");
    host.className = "cw-host";

    const tabs = document.createElement("div");
    tabs.className = "cw-tabs";

    const tabCrunchyroll = createTabButton("Crunchyroll", "crunchyroll");
    const tabCurated = createTabButton("Curated", "curated");

    tabCrunchyroll.addEventListener("click", () => {
      setActiveTab("crunchyroll").catch(() => {
        // no-op
      });
    });

    tabCurated.addEventListener("click", () => {
      setActiveTab("curated").catch(() => {
        // no-op
      });
    });

    tabs.appendChild(tabCrunchyroll);
    tabs.appendChild(tabCurated);

    const panel = document.createElement("div");
    panel.className = "cw-panel";

    const controls = document.createElement("div");
    controls.className = "cw-controls";
    const controlsRow = document.createElement("div");
    controlsRow.className = "cw-controls__row";

    const watchReadyFilterControl = createSelectField(
      "cw-watch-ready-mode",
      "Watch-ready filter:",
      state.settings.watchReadyFilterMode,
      [
        { optionValue: "none", title: "None" },
        { optionValue: "dim", title: "Dim not watch-ready" },
        { optionValue: "hide", title: "Hide not watch-ready" }
      ]
    );

    const cardLayoutControl = createCheckboxField(
      "cw-landscape-cards",
      "Landscape cards",
      state.settings.cardLayout === "landscape"
    );

    const audioFilterControl = createSelectField(
      "cw-audio-filter",
      "Audio:",
      state.settings.audioLocaleFilter,
      [{ optionValue: "any", title: "Any language" }]
    );

    const genreFilterControl = createSelectField(
      "cw-genre-filter",
      "Genre:",
      state.settings.genreFilter,
      [{ optionValue: "any", title: "Any genre" }]
    );

    const sortControl = createSelectField(
      "cw-sort-mode",
      "Sort:",
      state.settings.sortMode,
      [
        { optionValue: "consensus_quality_desc", title: "Consensus quality (default)" },
        { optionValue: "rating_desc", title: "Rating high to low" },
        { optionValue: "rating_asc", title: "Rating low to high" },
        { optionValue: "hidden_gems_desc", title: "Hidden gems (high rating, fewer ratings)" },
        { optionValue: "controversial_desc", title: "Most controversial" },
        { optionValue: "quality_floor_asc", title: "Quality floor (lowest 1★/2★)" },
        { optionValue: "quick_wins_asc", title: "Quick wins (few unwatched left)" },
        { optionValue: "dormant_backlog_asc", title: "Dormant backlog (oldest activity)" },
        { optionValue: "rewatch_memory_desc", title: "May need re-watch to remember" },
        { optionValue: "date_added_desc", title: "Recently added" },
        { optionValue: "date_added_asc", title: "Oldest added" },
        { optionValue: "date_updated_desc", title: "Recently updated" },
        { optionValue: "date_updated_asc", title: "Oldest updated" },
        { optionValue: "votes_desc", title: "Most ratings (count)" },
        { optionValue: "star_points_desc", title: "Most total stars" },
        { optionValue: "star_5_desc", title: "Most 5-star ratings" },
        { optionValue: "star_4_desc", title: "Most 4-star ratings" },
        { optionValue: "star_3_desc", title: "Most 3-star ratings" },
        { optionValue: "star_2_desc", title: "Most 2-star ratings" },
        { optionValue: "star_1_desc", title: "Most 1-star ratings" },
        { optionValue: "star_5_pct_desc", title: "Most 5-star ratings (%)" },
        { optionValue: "star_4_pct_desc", title: "Most 4-star ratings (%)" },
        { optionValue: "star_3_pct_desc", title: "Most 3-star ratings (%)" },
        { optionValue: "star_2_pct_desc", title: "Most 2-star ratings (%)" },
        { optionValue: "star_1_pct_desc", title: "Most 1-star ratings (%)" }
      ]
    );

    [watchReadyFilterControl.field, audioFilterControl.field, genreFilterControl.field, sortControl.field].forEach((field) => {
      field.classList.add("cw-controls__field--grow");
    });

    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.textContent = "Refresh ratings";
    refreshButton.className = "cw-button cw-button--primary cw-controls__refresh";

    const stats = document.createElement("span");
    stats.className = "cw-controls__stats";
    stats.textContent = "";

    const loadingIndicator = createLoadingIndicator("Loading");
    loadingIndicator.classList.add("cw-loading-indicator");
    loadingIndicator.style.display = "none";

    watchReadyFilterControl.select.addEventListener("change", async () => {
      state.settings.watchReadyFilterMode = watchReadyFilterControl.select.value;
      await persistSettings();
      renderCuratedPanel();
    });

    cardLayoutControl.input.addEventListener("change", async () => {
      state.settings.cardLayout = cardLayoutControl.input.checked ? "landscape" : "portrait";
      await persistSettings();
      renderCuratedPanel();
    });

    audioFilterControl.select.addEventListener("change", async () => {
      state.settings.audioLocaleFilter = audioFilterControl.select.value || "any";
      await persistSettings();
      renderCuratedPanel();

      const selectedAudioLocale = normalizeAudioLocale(state.settings.audioLocaleFilter);
      if (!selectedAudioLocale) {
        return;
      }

      Promise.allSettled([
        preloadRatingsForSelectedAudioLocale(selectedAudioLocale),
        preloadWatchHistoryForSelectedAudioLocale(selectedAudioLocale)
      ]).then(() => {
        if (!state.mounted || !isWatchlistPath(window.location.pathname)) {
          return;
        }
        renderCuratedPanel();
      });
    });

    genreFilterControl.select.addEventListener("change", async () => {
      state.settings.genreFilter = genreFilterControl.select.value || "any";
      await persistSettings();
      renderCuratedPanel();
    });

    sortControl.select.addEventListener("change", async () => {
      state.settings.sortMode = sortControl.select.value;
      await persistSettings();
      renderCuratedPanel();
    });

    refreshButton.addEventListener("click", async () => {
      state.ratingCache = {};
      state.ratingInflight.clear();
      state.ratingLocalePreloadInflight.clear();
      state.watchHistoryLocalePreloadInflight.clear();
      state.watchHistoryCache = {
        version: WATCH_HISTORY_CACHE_VERSION,
        accountId: "",
        updatedAt: 0,
        bySeriesId: {},
        bySeriesIdAudioLocale: {},
        bySeriesIdProgress: {},
        bySeriesIdAudioLocaleProgress: {}
      };
      state.watchHistoryStatus = "idle";
      state.watchHistoryInflight = null;
      await storageSet(RATING_CACHE_KEY, state.ratingCache);
      await storageSet(WATCH_HISTORY_CACHE_KEY, state.watchHistoryCache);
      state.curatedEntries = [];
      state.curatedError = null;
      ensureCuratedDataLoad(true);
      renderCuratedPanel();
      debounceProcess();
    });

    controlsRow.appendChild(watchReadyFilterControl.field);
    controlsRow.appendChild(cardLayoutControl.field);
    controlsRow.appendChild(audioFilterControl.field);
    controlsRow.appendChild(genreFilterControl.field);
    controlsRow.appendChild(sortControl.field);
    controlsRow.appendChild(refreshButton);
    controlsRow.appendChild(loadingIndicator);
    controlsRow.appendChild(stats);

    controls.appendChild(controlsRow);

    const grid = document.createElement("div");
    grid.className = "cw-curated-grid";

    panel.appendChild(controls);
    panel.appendChild(grid);

    host.appendChild(tabs);
    host.appendChild(panel);

    header.insertAdjacentElement("beforebegin", host);

    state.hostEl = host;
    state.tabCrunchyrollEl = tabCrunchyroll;
    state.tabCuratedEl = tabCurated;
    state.curatedPanelEl = panel;
    state.controlsEl = controls;
    state.loadingIndicatorEl = loadingIndicator;
    state.audioFilterSelectEl = audioFilterControl.select;
    state.genreFilterSelectEl = genreFilterControl.select;
    state.statsEl = stats;
    state.gridEl = grid;
    state.curatedGridRenderSignature = "";

    runtimeEvent("ui-mounted", {
      headerClass: String(header.className || "")
    });

    applyCardLayoutUi();
    applyTabUi();
  }

  async function processWatchlist() {
    if (!state.mounted || !isWatchlistPath(window.location.pathname)) {
      return;
    }

    ensureInterface();
    applyTabUi();
    const loadPromise = ensureCuratedDataLoad(false);
    renderCuratedPanel();

    if (state.settings.activeTab !== "curated") {
      return;
    }

    await loadPromise;
    renderCuratedPanel();
  }

  function startObserver() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    const target = document.body || document.documentElement;
    if (!target) {
      return;
    }

    const observer = new MutationObserver((records) => {
      if (state.mutationMuted) {
        return;
      }

      if (
        state.hostEl &&
        records.length > 0 &&
        records.every((record) => record.target instanceof Node && state.hostEl.contains(record.target))
      ) {
        return;
      }
      debounceProcess();
    });

    observer.observe(target, {
      childList: true,
      subtree: true
    });

    state.observer = observer;
    runtimeEvent("observer-started");
  }

  function stopObserver() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
  }

  function unmount() {
    state.mounted = false;
    stopObserver();

    setNativeVisibility(true);
    clearRootFrame();

    if (state.hostEl && state.hostEl.isConnected) {
      state.hostEl.remove();
    }

    state.hostEl = null;
    state.tabCrunchyrollEl = null;
    state.tabCuratedEl = null;
    state.curatedPanelEl = null;
    state.controlsEl = null;
    state.loadingIndicatorEl = null;
    state.audioFilterSelectEl = null;
    state.genreFilterSelectEl = null;
    state.statsEl = null;
    state.gridEl = null;

    clearTimeout(state.processTimer);
    state.processTimer = null;
    state.curatedObservedPromise = null;
  }

  function mount() {
    if (state.mounted) {
      return;
    }

    state.mounted = true;
    runtimeEvent("mounted");
    startObserver();
    debounceProcess();
  }

  function syncRoute() {
    const pathname = window.location.pathname;

    if (isWatchlistPath(pathname)) {
      mount();
      debounceProcess();
      return;
    }

    unmount();
  }

  function scheduleRouteSync() {
    if (state.routeSyncTimer != null) {
      return;
    }

    state.routeSyncTimer = window.setTimeout(() => {
      state.routeSyncTimer = null;
      syncRoute();
    }, 0);
  }

  function patchHistoryForRouteSync() {
    const historyRef = window.history;
    if (!historyRef) {
      return;
    }

    ["pushState", "replaceState"].forEach((methodName) => {
      const original = historyRef[methodName];
      if (typeof original !== "function") {
        return;
      }

      try {
        historyRef[methodName] = function patchedHistoryState(...args) {
          const result = original.apply(this, args);
          scheduleRouteSync();
          return result;
        };
      } catch (_) {
        // Some browsers lock history methods. Popstate/hashchange still cover most navigation.
      }
    });
  }

  function startRouteWatcher() {
    if (state.routeWatcherStarted) {
      return;
    }

    state.routeWatcherStarted = true;
    patchHistoryForRouteSync();
    window.addEventListener("popstate", scheduleRouteSync);
    window.addEventListener("hashchange", scheduleRouteSync);
    window.addEventListener("pageshow", scheduleRouteSync);
  }

  async function loadInitialState() {
    const storedSettings = await storageGet(SETTINGS_KEY, DEFAULT_SETTINGS);
    state.settings = {
      ...DEFAULT_SETTINGS,
      ...(storedSettings || {})
    };

    if (
      typeof state.settings.audioLocaleFilter !== "string" &&
      typeof storedSettings?.requireEnglishAudio === "boolean"
    ) {
      state.settings.audioLocaleFilter = storedSettings.requireEnglishAudio ? "en-US" : "any";
    }

    if (
      typeof state.settings.audioLocaleFilter !== "string" &&
      typeof storedSettings?.requireDubTag === "boolean"
    ) {
      state.settings.audioLocaleFilter = storedSettings.requireDubTag ? "en-US" : "any";
    }

    if (typeof state.settings.audioLocaleFilter !== "string" || !state.settings.audioLocaleFilter.trim()) {
      state.settings.audioLocaleFilter = "any";
    }

    if (typeof state.settings.genreFilter !== "string" || !state.settings.genreFilter.trim()) {
      state.settings.genreFilter = "any";
    }

    if (!["portrait", "landscape"].includes(state.settings.cardLayout)) {
      state.settings.cardLayout = "portrait";
    }

    if (typeof storedSettings?.watchReadyFilterMode === "string") {
      state.settings.watchReadyFilterMode = storedSettings.watchReadyFilterMode;
    } else if (typeof storedSettings?.actionabilityMode === "string") {
      state.settings.watchReadyFilterMode = storedSettings.actionabilityMode;
    } else if (typeof storedSettings?.hideNonActionable === "boolean") {
      state.settings.watchReadyFilterMode = storedSettings.hideNonActionable ? "hide" : "none";
    }

    if (!["none", "dim", "hide"].includes(state.settings.watchReadyFilterMode)) {
      state.settings.watchReadyFilterMode = "hide";
    }

    if (!VALID_SORT_MODES.has(state.settings.sortMode)) {
      state.settings.sortMode = DEFAULT_SORT_MODE;
    }

    const rawRatingCache = await storageGet(RATING_CACHE_KEY, {});
    if (rawRatingCache && typeof rawRatingCache === "object") {
      state.ratingCache = rawRatingCache;
    }

    const rawWatchHistoryCache = await storageGet(WATCH_HISTORY_CACHE_KEY, null);
    if (rawWatchHistoryCache && typeof rawWatchHistoryCache === "object") {
      state.watchHistoryCache = normalizeStoredWatchHistoryCache(rawWatchHistoryCache);
    }

    state.watchHistoryStatus = isWatchHistoryCacheValid(state.watchHistoryCache) ? "ready" : "idle";

    const rawWatchlistCache = await storageGet(WATCHLIST_CACHE_KEY, null);
    if (rawWatchlistCache && typeof rawWatchlistCache === "object") {
      state.watchlistCache = normalizeStoredWatchlistCache(rawWatchlistCache);
    }

    if (isWatchlistCacheValid(state.watchlistCache)) {
      state.curatedEntries = normalizeEntriesFromApiRows(state.watchlistCache.rows);
      state.curatedSource = "cache";
      state.curatedLastRevalidateAt = state.watchlistCache.updatedAt;
      runtimeEvent("curated-cache-hydrated", {
        total: state.curatedEntries.length,
        updatedAt: state.watchlistCache.updatedAt
      });
    }

    runtimeEvent("state-load-done", {
      tab: state.settings.activeTab,
      cachedCurated: state.curatedEntries.length
    });
  }

  async function init() {
    runtimeEvent("init-start");
    exposeDebugApi();
    await loadInitialState();
    startRouteWatcher();
    syncRoute();

    runtimeEvent("init-done");
  }

  init().catch((error) => {
    runtimeEvent("init-error", {
      message: error?.message || "unknown"
    });
  });
})();
