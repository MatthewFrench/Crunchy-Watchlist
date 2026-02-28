(() => {
  type CuratedCardLayout = 'portrait' | 'landscape';

  type CuratedPanelGridSignatureRuntime = {
    normalizeCardLayout: (value: unknown) => CuratedCardLayout;
    buildCuratedCardContentSignature: (entry: Record<string, unknown>, cardLayout: unknown) => string;
    parseCardLayoutFromContentSignature: (signature: string) => CuratedCardLayout | null;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function normalizeCardLayout(value: unknown): CuratedCardLayout {
    return value === 'landscape' ? 'landscape' : 'portrait';
  }

  function updateRevisionHash(hash: number, value: string): number {
    let next = hash >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      next ^= value.charCodeAt(index);
      next = Math.imul(next, 16777619) >>> 0;
    }

    return next >>> 0;
  }

  function hashRevisionToken(hash: number, value: unknown, seen: Set<unknown>): number {
    if (value == null) {
      return updateRevisionHash(hash, 'null');
    }

    if (typeof value === 'string') {
      return updateRevisionHash(hash, `str:${value}`);
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return updateRevisionHash(hash, `${typeof value}:${String(value)}`);
    }

    if (Array.isArray(value)) {
      let next = updateRevisionHash(hash, `arr:${value.length}`);
      value.forEach((item) => {
        next = hashRevisionToken(next, item, seen);
      });
      return next;
    }

    if (typeof value === 'object') {
      if (seen.has(value)) {
        return updateRevisionHash(hash, 'circular');
      }
      seen.add(value);
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      let next = updateRevisionHash(hash, `obj:${keys.length}`);
      keys.forEach((key) => {
        next = updateRevisionHash(next, `key:${key}`);
        next = hashRevisionToken(next, record[key], seen);
      });
      seen.delete(value);
      return next;
    }

    return updateRevisionHash(hash, `${typeof value}:${String(value)}`);
  }

  function buildEntryRevisionToken(entry: Record<string, unknown>): string {
    return hashRevisionToken(2166136261, entry, new Set<unknown>()).toString(16);
  }

  function buildCuratedCardContentSignature(entry: Record<string, unknown>, cardLayout: unknown): string {
    const normalizedCardLayout = normalizeCardLayout(cardLayout);
    return `l:${normalizedCardLayout}|r:${buildEntryRevisionToken(entry)}`;
  }

  function parseCardLayoutFromContentSignature(signature: string): CuratedCardLayout | null {
    if (!signature) {
      return null;
    }

    if (signature.startsWith('l:landscape|')) {
      return 'landscape';
    }
    if (signature.startsWith('l:portrait|')) {
      return 'portrait';
    }

    return null;
  }

  function createCuratedPanelGridSignatureRuntime(): CuratedPanelGridSignatureRuntime {
    return {
      normalizeCardLayout,
      buildCuratedCardContentSignature,
      parseCardLayoutFromContentSignature,
    };
  }

  moduleRegistry.runtimeCuratedPanelGridSignature = {
    createCuratedPanelGridSignatureRuntime,
  };
})();
