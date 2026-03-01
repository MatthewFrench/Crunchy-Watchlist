type CuratedCardLayout = 'portrait' | 'landscape';
type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type CuratedPanelGridSignatureRuntime = {
  normalizeCardLayout: (value: BoundaryValue) => CuratedCardLayout;
  buildCuratedCardContentSignature: (entry: BoundaryRecord, cardLayout: BoundaryValue) => string;
  parseCardLayoutFromContentSignature: (signature: string) => CuratedCardLayout | null;
};

function normalizeCardLayout(value: BoundaryValue): CuratedCardLayout {
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

function hashRevisionToken(hash: number, value: BoundaryValue, seen: Set<BoundaryValue>): number {
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
    const record = value as BoundaryRecord;
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

function buildEntryRevisionToken(entry: BoundaryRecord): string {
  return hashRevisionToken(2166136261, entry, new Set<BoundaryValue>()).toString(16);
}

function buildCuratedCardContentSignature(entry: BoundaryRecord, cardLayout: BoundaryValue): string {
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

export function createCuratedPanelGridSignatureRuntime(): CuratedPanelGridSignatureRuntime {
  return {
    normalizeCardLayout,
    buildCuratedCardContentSignature,
    parseCardLayoutFromContentSignature,
  };
}
