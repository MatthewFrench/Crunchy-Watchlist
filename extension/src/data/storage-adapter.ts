;(() => {
  type StorageGetPromise = (key: string) => Promise<unknown>
  type StorageGetCallback = (keys: string[], callback: (result: Record<string, unknown>) => void) => void
  type StorageSetPromise = (items: Record<string, unknown>) => Promise<void>
  type StorageSetCallback = (items: Record<string, unknown>, callback: () => void) => void

  type StorageAreaLike = {
    get?: StorageGetPromise | StorageGetCallback
    set?: StorageSetPromise | StorageSetCallback
  }

  type LocalStorageLike = {
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => void
  }

  type ParseJson = <T>(value: string, fallback: T) => T

  type StorageAdapterOptions = {
    storageArea?: StorageAreaLike | null
    localStorageRef?: LocalStorageLike
    timeoutMs?: unknown
    parseJson?: ParseJson
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function readResultValue(result: unknown, key: string): unknown {
    if (!result || typeof result !== 'object') {
      return undefined
    }

    return (result as Record<string, unknown>)[key]
  }

  async function storageAreaGet<T>(
    storageArea: StorageAreaLike | null | undefined,
    key: string,
    fallback: T,
    timeoutMs = 1500,
  ): Promise<T | unknown> {
    const getFn = storageArea?.get
    if (typeof getFn !== 'function') {
      return fallback
    }

    if (getFn.length <= 1) {
      try {
        const result = await (getFn as StorageGetPromise)(key)
        const value = readResultValue(result, key)
        return value != null ? value : fallback
      } catch (_error) {
        return fallback
      }
    }

    return new Promise((resolve) => {
      let resolved = false

      const timer = root.setTimeout(() => {
        if (!resolved) {
          resolved = true
          resolve(fallback)
        }
      }, timeoutMs)

      try {
        ;(getFn as StorageGetCallback)([key], (result) => {
          if (resolved) {
            return
          }

          resolved = true
          root.clearTimeout(timer)
          const value = readResultValue(result, key)
          resolve(value != null ? value : fallback)
        })
      } catch (_error) {
        if (!resolved) {
          resolved = true
          root.clearTimeout(timer)
          resolve(fallback)
        }
      }
    })
  }

  async function storageAreaSet(
    storageArea: StorageAreaLike | null | undefined,
    key: string,
    value: unknown,
  ): Promise<void> {
    const setFn = storageArea?.set
    if (typeof setFn !== 'function') {
      return
    }

    if (setFn.length <= 1) {
      try {
        await (setFn as StorageSetPromise)({ [key]: value })
      } catch (_error) {
        // no-op
      }
      return
    }

    await new Promise<void>((resolve) => {
      try {
        ;(setFn as StorageSetCallback)({ [key]: value }, () => resolve())
      } catch (_error) {
        resolve()
      }
    })
  }

  function localStorageGet<T>(localStorageRef: LocalStorageLike, parseJson: ParseJson, key: string, fallback: T): T {
    let raw: string | null = null
    try {
      raw = localStorageRef.getItem(key)
    } catch (_error) {
      return fallback
    }

    if (raw == null) {
      return fallback
    }

    return parseJson(raw, fallback)
  }

  function localStorageSet(localStorageRef: LocalStorageLike, key: string, value: unknown): void {
    try {
      localStorageRef.setItem(key, JSON.stringify(value))
    } catch (_error) {
      // no-op
    }
  }

  function createStorageAdapter(options: StorageAdapterOptions = {}) {
    const storageArea = options.storageArea || null
    const localStorageRef = options.localStorageRef || root.localStorage
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 1500
    const parseJson: ParseJson =
      typeof options.parseJson === 'function'
        ? options.parseJson
        : (value, fallback) => {
            try {
              return JSON.parse(value) as typeof fallback
            } catch (_error) {
              return fallback
            }
          }

    return {
      async get<T>(key: string, fallback: T): Promise<T | unknown> {
        if (storageArea) {
          return storageAreaGet(storageArea, key, fallback, timeoutMs)
        }

        return localStorageGet(localStorageRef, parseJson, key, fallback)
      },
      async set(key: string, value: unknown): Promise<void> {
        if (storageArea) {
          await storageAreaSet(storageArea, key, value)
          return
        }

        localStorageSet(localStorageRef, key, value)
      },
    }
  }

  moduleRegistry.storage = {
    createStorageAdapter,
  }
})()
