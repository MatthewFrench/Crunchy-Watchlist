type BoundaryValue = CwBoundaryValue;
type StorageRecord = Record<string, BoundaryValue>;
type StorageGetPromise = (key: string) => Promise<BoundaryValue>;
type StorageGetCallback = (keys: string[], callback: (result: StorageRecord) => void) => void;
type StorageSetPromise = (items: StorageRecord) => Promise<void>;
type StorageSetCallback = (items: StorageRecord, callback: () => void) => void;
type StorageAdapter = {
  get: <T>(key: string, fallback: T) => Promise<T | BoundaryValue>;
  set: (key: string, value: BoundaryValue) => Promise<void>;
};
type StorageRuntime = {
  createStorageAdapter: (options?: StorageAdapterOptions) => StorageAdapter;
};

type StorageAreaLike = {
  get?: StorageGetPromise | StorageGetCallback;
  set?: StorageSetPromise | StorageSetCallback;
};

type LocalStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type ParseJson = <T>(value: string, fallback: T) => T;

type StorageAdapterOptions = {
  storageArea?: StorageAreaLike | null;
  localStorageRef?: LocalStorageLike;
  timeoutMs?: BoundaryValue;
  parseJson?: BoundaryValue;
};

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;

function readResultValue(result: BoundaryValue, key: string): BoundaryValue {
  if (!result || typeof result !== 'object') {
    return undefined;
  }

  const record = result as StorageRecord;
  if (!Object.hasOwn(record, key)) {
    return undefined;
  }

  return record[key];
}

type StorageAreaReadResult = {
  ok: boolean;
  found: boolean;
  value: BoundaryValue;
};

type LocalStorageReadResult<T> = {
  found: boolean;
  value: T;
};

function makeStorageAreaReadResult(
  ok: boolean,
  found: boolean,
  value: BoundaryValue = undefined,
): StorageAreaReadResult {
  return {
    ok,
    found,
    value,
  };
}

function mapStorageAreaReadValue(result: BoundaryValue, key: string): StorageAreaReadResult {
  const value = readResultValue(result, key);
  if (value == null) {
    return makeStorageAreaReadResult(true, false);
  }
  return makeStorageAreaReadResult(true, true, value);
}

async function storageAreaGetPromise(getFn: StorageGetPromise, key: string): Promise<StorageAreaReadResult> {
  try {
    const result = await getFn(key);
    return mapStorageAreaReadValue(result, key);
  } catch (_error) {
    return makeStorageAreaReadResult(false, false);
  }
}

async function storageAreaGetCallback(
  getFn: StorageGetCallback,
  key: string,
  timeoutMs: number,
): Promise<StorageAreaReadResult> {
  return new Promise((resolve) => {
    let resolved = false;

    const timer = root.setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(makeStorageAreaReadResult(false, false));
      }
    }, timeoutMs);

    try {
      getFn([key], (result) => {
        if (resolved) {
          return;
        }

        resolved = true;
        root.clearTimeout(timer);
        resolve(mapStorageAreaReadValue(result, key));
      });
    } catch (_error) {
      if (!resolved) {
        resolved = true;
        root.clearTimeout(timer);
        resolve(makeStorageAreaReadResult(false, false));
      }
    }
  });
}

async function storageAreaGet(
  storageArea: StorageAreaLike | null | undefined,
  key: string,
  timeoutMs = 1500,
): Promise<StorageAreaReadResult> {
  const getFn = storageArea?.get;
  if (typeof getFn !== 'function') {
    return makeStorageAreaReadResult(false, false);
  }

  if (getFn.length <= 1) {
    return storageAreaGetPromise(getFn as StorageGetPromise, key);
  }

  return storageAreaGetCallback(getFn as StorageGetCallback, key, timeoutMs);
}

async function storageAreaSet(
  storageArea: StorageAreaLike | null | undefined,
  key: string,
  value: BoundaryValue,
): Promise<boolean> {
  const setFn = storageArea?.set;
  if (typeof setFn !== 'function') {
    return false;
  }

  if (setFn.length <= 1) {
    try {
      await (setFn as StorageSetPromise)({ [key]: value });
      return true;
    } catch (_error) {
      return false;
    }
  }

  return new Promise<boolean>((resolve) => {
    try {
      (setFn as StorageSetCallback)({ [key]: value }, () => resolve(true));
    } catch (_error) {
      resolve(false);
    }
  });
}

async function storageAreaSetAndVerify(
  storageArea: StorageAreaLike | null | undefined,
  key: string,
  value: BoundaryValue,
  timeoutMs: number,
): Promise<boolean> {
  const stored = await storageAreaSet(storageArea, key, value);
  if (!stored) {
    return false;
  }

  const verification = await storageAreaGet(storageArea, key, timeoutMs);
  return verification.ok && verification.found;
}

function localStorageRead<T>(
  localStorageRef: LocalStorageLike,
  parseJson: ParseJson,
  key: string,
  fallback: T,
): LocalStorageReadResult<T> {
  let raw: string | null = null;
  try {
    raw = localStorageRef.getItem(key);
  } catch (_error) {
    return { found: false, value: fallback };
  }

  if (raw == null) {
    return { found: false, value: fallback };
  }

  return { found: true, value: parseJson(raw, fallback) };
}

function localStorageSet(localStorageRef: LocalStorageLike, key: string, value: BoundaryValue): void {
  try {
    localStorageRef.setItem(key, JSON.stringify(value));
  } catch (_error) {
    // no-op
  }
}

function enqueueStorageWriteByKey<T>(
  queueByKey: Map<string, Promise<void>>,
  key: string,
  task: () => Promise<T>,
): Promise<T> {
  const previousQueue = queueByKey.get(key) ?? Promise.resolve();
  const taskRun = previousQueue.catch(() => undefined).then(task);
  const nextQueue = taskRun.then(
    () => undefined,
    () => undefined,
  );
  queueByKey.set(key, nextQueue);

  return taskRun.finally(() => {
    if (queueByKey.get(key) === nextQueue) {
      queueByKey.delete(key);
    }
  });
}

function createStorageAdapter(options: StorageAdapterOptions = {}): StorageAdapter {
  const storageArea = options.storageArea || null;
  const localStorageRef = options.localStorageRef || root.localStorage;
  const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 1500;
  const storageWriteQueueByKey = new Map<string, Promise<void>>();
  const storageWriteRevisionByKey = new Map<string, number>();
  const parseJson: ParseJson =
    typeof options.parseJson === 'function'
      ? (options.parseJson as ParseJson)
      : (value, fallback) => {
          try {
            return JSON.parse(value) as typeof fallback;
          } catch (_error) {
            return fallback;
          }
        };
  const readStorageWriteRevision = (key: string): number => {
    return storageWriteRevisionByKey.get(key) ?? 0;
  };
  const bumpStorageWriteRevision = (key: string): number => {
    const nextRevision = readStorageWriteRevision(key) + 1;
    storageWriteRevisionByKey.set(key, nextRevision);
    return nextRevision;
  };

  return {
    async get<T>(key: string, fallback: T): Promise<T | BoundaryValue> {
      let storageReadResult: StorageAreaReadResult | null = null;
      if (storageArea) {
        storageReadResult = await storageAreaGet(storageArea, key, timeoutMs);
        if (storageReadResult.ok && storageReadResult.found) {
          return storageReadResult.value;
        }
      }

      const localStorageResult = localStorageRead(localStorageRef, parseJson, key, fallback);
      if (
        storageArea &&
        localStorageResult.found &&
        (!storageReadResult || (storageReadResult.ok && !storageReadResult.found))
      ) {
        const migrationRevision = readStorageWriteRevision(key);
        void enqueueStorageWriteByKey(storageWriteQueueByKey, key, async () => {
          // Do not write stale local values if a newer explicit write has been scheduled.
          if (readStorageWriteRevision(key) !== migrationRevision) {
            return false;
          }
          // Re-check extension storage at commit-time so cross-tab writes do not get clobbered.
          const migrationPreflight = await storageAreaGet(storageArea, key, timeoutMs);
          if (!migrationPreflight.ok || migrationPreflight.found) {
            return false;
          }
          return storageAreaSetAndVerify(storageArea, key, localStorageResult.value, timeoutMs);
        }).catch(() => {
          // no-op
        });
      }

      return localStorageResult.value;
    },
    async set(key: string, value: BoundaryValue): Promise<void> {
      bumpStorageWriteRevision(key);
      if (storageArea) {
        const storedInExtensionStorage = await enqueueStorageWriteByKey(storageWriteQueueByKey, key, async () => {
          return storageAreaSetAndVerify(storageArea, key, value, timeoutMs);
        });
        if (storedInExtensionStorage) {
          return;
        }
      }

      localStorageSet(localStorageRef, key, value);
    },
  };
}

const storageRuntime: StorageRuntime = {
  createStorageAdapter,
};

export function createStorageRuntime(): object {
  return storageRuntime;
}
