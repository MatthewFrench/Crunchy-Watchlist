#!/usr/bin/env node

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { type CDPSession, chromium, type Page, type Request } from '@playwright/test';

type LiveSourceEntry = {
  file: string;
  source: string;
};

type LiveSourceSnapshot = {
  cssText: string;
  jsEntries: LiveSourceEntry[];
};

type ManifestAssets = {
  cssFiles: string[];
  jsFiles: string[];
};

type PerfDiagnostics = {
  routeObserverBatchesProcessed: number;
  routeObserverBatchesIgnored: number;
  routeStructureChecks: number;
  routeStructureSyncs: number;
  gridLayoutCacheHits: number;
  gridLayoutCacheMisses: number;
  retainedCardHideScheduled: number;
  retainedCardHideCompleted: number;
  localizedPreloadRenderRequestsQueued: number;
  localizedPreloadRenderRequestsDeduped: number;
};

type DomCounters = {
  created: number;
  patched: number;
  parked: number;
  unparked: number;
  disposed: number;
  renderPasses: number;
};

type DebugStats = {
  counters: DomCounters;
  activeSeriesIds?: string[];
  perfDiagnostics: PerfDiagnostics;
};

type BenchmarkSnapshot = {
  statsText: string;
  audioFilter: string;
  sortMode: string;
  genreFilter: string;
  watchReadyMode: string;
  cardCount: number;
  leavingCount: number;
  firstIds: string[];
  debugStats: DebugStats | null;
};

type BenchmarkMeasurement = {
  name: string;
  selector: string;
  targetValue: string;
  expectation: 'order' | 'count-or-order';
  firstChangeMs: number;
  settledMs: number;
  requestCount: number;
  before: BenchmarkSnapshot;
  after: BenchmarkSnapshot;
  countersDelta: Partial<DomCounters>;
  perfDelta: Partial<PerfDiagnostics>;
  enginePerfDelta: Partial<EnginePerfMetrics>;
  memoryDelta: Partial<EngineMemoryMetrics>;
  probeStats: BenchmarkProbeStats | null;
};

type EnginePerfMetrics = {
  ScriptDuration: number;
  LayoutDuration: number;
  RecalcStyleDuration: number;
  TaskDuration: number;
  LayoutCount: number;
  RecalcStyleCount: number;
};

type EngineMemoryMetrics = {
  JSHeapUsedSize: number;
  JSHeapTotalSize: number;
  Nodes: number;
  Documents: number;
  LayoutObjects: number;
};

type BenchmarkProbeBucket = {
  count: number;
  totalMs: number;
};

type BenchmarkProbeStats = Record<string, BenchmarkProbeBucket>;

type RelevantRequestTracker = {
  resetWindow: () => void;
  readWindowUrls: () => string[];
  isIdle: (quietMs: number) => boolean;
  hasInflightRequests: () => boolean;
  dispose: () => void;
};

type BenchmarkBaseline = {
  audioFilter: string;
  genreFilter: string;
  watchReadyMode: string;
  sortMode: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cdpUrl = String(process.env.CW_PW_CDP_URL || 'http://127.0.0.1:9222').trim();
const runtimeOutputRelativeDir = String(process.env.EXTENSION_RUNTIME_DIR || '.tmp/extension-runtime-dev').trim();
const runtimeOutputDir = path.resolve(repoRoot, runtimeOutputRelativeDir);
const manifestPath = path.join(runtimeOutputDir, 'manifest.json');
const execFileAsync = promisify(execFile);

function getErrorMessage(error: unknown): string {
  const maybeError = error as { message?: string; stderr?: unknown };
  const stderr = typeof maybeError?.stderr === 'string' ? maybeError.stderr.trim() : '';
  return stderr || maybeError?.message || String(error);
}

async function buildGeneratedRuntime(): Promise<void> {
  const buildScriptPath = path.join(repoRoot, 'scripts', 'build-extension-runtime.mts');
  try {
    await execFileAsync('tsx', [buildScriptPath, '--bundle-content-scripts', '--out', runtimeOutputDir], {
      cwd: repoRoot,
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`Failed to build generated runtime at ${runtimeOutputDir}: ${getErrorMessage(error)}`);
  }
}

function isWatchlistUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length > 0 && segments[segments.length - 1] === 'watchlist';
  } catch {
    return false;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

async function readManifestAssets(): Promise<ManifestAssets> {
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw) as {
    content_scripts?: Array<{
      css?: unknown;
      js?: unknown;
    }>;
  };
  const contentScript = manifest?.content_scripts?.[0];
  return {
    cssFiles: toStringArray(contentScript?.css),
    jsFiles: toStringArray(contentScript?.js),
  };
}

async function readRuntimeScriptSource(relativeScriptPath: string): Promise<string> {
  return fs.readFile(path.join(runtimeOutputDir, relativeScriptPath), 'utf8');
}

async function readLatestSourceSnapshot(): Promise<LiveSourceSnapshot> {
  const { cssFiles, jsFiles } = await readManifestAssets();
  const cssChunks: string[] = [];
  for (const cssFile of cssFiles) {
    cssChunks.push(`/* ${cssFile} */\n${await fs.readFile(path.join(runtimeOutputDir, cssFile), 'utf8')}`);
  }

  const jsEntries: LiveSourceEntry[] = [];
  for (const jsFile of jsFiles) {
    const source = await readRuntimeScriptSource(jsFile);
    jsEntries.push({
      file: jsFile,
      source: `${source}\n//# sourceURL=cw-bench/${jsFile.replace(/\s+/g, '_')}`,
    });
  }

  return {
    cssText: cssChunks.join('\n\n'),
    jsEntries,
  };
}

async function injectLatest(page: Page): Promise<void> {
  const snapshot = await readLatestSourceSnapshot();
  await page.evaluate(() => {
    (
      window as Window & {
        __CW_WATCHLIST_CURATOR_DEBUG_FLAGS__?: {
          perf?: boolean;
        };
      }
    ).__CW_WATCHLIST_CURATOR_DEBUG_FLAGS__ = {
      perf: true,
    };
  });

  await page.evaluate((styles) => {
    const styleId = 'cw-live-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = styles;
  }, snapshot.cssText);

  for (const entry of snapshot.jsEntries) {
    await page.evaluate((source) => {
      // biome-ignore lint/security/noGlobalEval: page-context injection is required for live benchmark tooling.
      eval(source);
    }, entry.source);
  }
}

function isRelevantExtensionRequest(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!url.hostname.includes('crunchyroll.com')) {
      return false;
    }
    return (
      url.pathname.startsWith('/auth/v1/token') ||
      url.pathname.startsWith('/content/v2/') ||
      url.pathname.startsWith('/content-reviews/v3/rating/series/') ||
      url.pathname.startsWith('/series/')
    );
  } catch {
    return false;
  }
}

function createRelevantRequestTracker(page: Page): RelevantRequestTracker {
  const inflightRequests = new Set<Request>();
  let lastRelevantActivityAt = Date.now();
  let windowRequestUrls: string[] = [];

  const onRequest = (request: Request): void => {
    if (!isRelevantExtensionRequest(request.url())) {
      return;
    }
    inflightRequests.add(request);
    windowRequestUrls.push(request.url());
    lastRelevantActivityAt = Date.now();
  };

  const onRequestFinished = (request: Request): void => {
    if (!isRelevantExtensionRequest(request.url())) {
      return;
    }
    inflightRequests.delete(request);
    lastRelevantActivityAt = Date.now();
  };

  const onRequestFailed = (request: Request): void => {
    if (!isRelevantExtensionRequest(request.url())) {
      return;
    }
    inflightRequests.delete(request);
    lastRelevantActivityAt = Date.now();
  };

  page.on('request', onRequest);
  page.on('requestfinished', onRequestFinished);
  page.on('requestfailed', onRequestFailed);

  return {
    resetWindow: () => {
      windowRequestUrls = [];
    },
    readWindowUrls: () => [...windowRequestUrls],
    isIdle: (quietMs: number) => inflightRequests.size === 0 && Date.now() - lastRelevantActivityAt >= quietMs,
    hasInflightRequests: () => inflightRequests.size > 0,
    dispose: () => {
      page.off('request', onRequest);
      page.off('requestfinished', onRequestFinished);
      page.off('requestfailed', onRequestFailed);
    },
  };
}

async function readBenchmarkSnapshot(page: Page): Promise<BenchmarkSnapshot> {
  return page.evaluate(`(() => {
    const query = (selector) => document.querySelector(selector);
    const cards = Array.from(document.querySelectorAll('.cw-curated-card'));
    const debugApi = window.__CW_WATCHLIST_CURATOR_DEBUG__;
    const debugStats = debugApi && typeof debugApi.getCuratedDomStats === 'function' ? debugApi.getCuratedDomStats() : null;
    const statsTextElement = query('.cw-controls__stats');
    const audioFilterElement = query('#cw-audio-filter');
    const sortModeElement = query('#cw-sort-mode');
    const genreFilterElement = query('#cw-genre-filter');
    const watchReadyModeElement = query('#cw-watch-ready-mode');

    return {
      statsText: statsTextElement instanceof HTMLElement ? (statsTextElement.textContent || '').trim() : '',
      audioFilter: audioFilterElement instanceof HTMLSelectElement ? audioFilterElement.value : '',
      sortMode: sortModeElement instanceof HTMLSelectElement ? sortModeElement.value : '',
      genreFilter: genreFilterElement instanceof HTMLSelectElement ? genreFilterElement.value : '',
      watchReadyMode: watchReadyModeElement instanceof HTMLSelectElement ? watchReadyModeElement.value : '',
      cardCount: cards.length,
      leavingCount: document.querySelectorAll('.cw-curated-card--leaving').length,
      firstIds:
        Array.isArray(debugStats?.activeSeriesIds) && debugStats.activeSeriesIds.length > 0
          ? debugStats.activeSeriesIds.slice(0, 12).map((seriesId) => String(seriesId || ''))
          : cards.slice(0, 12).map((card) => (card instanceof HTMLElement ? String(card.dataset.cwSeriesId || '') : '')),
      debugStats: debugStats || null,
    };
  })()`);
}

function snapshotSignature(snapshot: BenchmarkSnapshot): string {
  return [
    snapshot.statsText,
    snapshot.audioFilter,
    snapshot.cardCount,
    snapshot.leavingCount,
    snapshot.sortMode,
    snapshot.genreFilter,
    snapshot.watchReadyMode,
    snapshot.firstIds.join('|'),
  ].join('||');
}

function diffNumericRecord<T extends Record<string, number>>(before: T, after: T): Partial<T> {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const delta: Partial<T> = {};
  keys.forEach((key) => {
    const beforeValue = Number(before[key as keyof T] || 0);
    const afterValue = Number(after[key as keyof T] || 0);
    const difference = afterValue - beforeValue;
    if (difference !== 0) {
      delta[key as keyof T] = difference as T[keyof T];
    }
  });
  return delta;
}

function toMetricRecord(metrics: Array<{ name: string; value: number }>): Record<string, number> {
  const record: Record<string, number> = {};
  metrics.forEach((metric) => {
    record[metric.name] = Number(metric.value) || 0;
  });
  return record;
}

function pickEnginePerfMetrics(record: Record<string, number>): EnginePerfMetrics {
  return {
    ScriptDuration: Number(record.ScriptDuration) || 0,
    LayoutDuration: Number(record.LayoutDuration) || 0,
    RecalcStyleDuration: Number(record.RecalcStyleDuration) || 0,
    TaskDuration: Number(record.TaskDuration) || 0,
    LayoutCount: Number(record.LayoutCount) || 0,
    RecalcStyleCount: Number(record.RecalcStyleCount) || 0,
  };
}

function pickEngineMemoryMetrics(record: Record<string, number>): EngineMemoryMetrics {
  return {
    JSHeapUsedSize: Number(record.JSHeapUsedSize) || 0,
    JSHeapTotalSize: Number(record.JSHeapTotalSize) || 0,
    Nodes: Number(record.Nodes) || 0,
    Documents: Number(record.Documents) || 0,
    LayoutObjects: Number(record.LayoutObjects) || 0,
  };
}

async function installBenchmarkProbe(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    if (window.__cwBenchProbe__) {
      return;
    }

    const createBucket = () => ({ count: 0, totalMs: 0 });
    const counts = {
      getBoundingClientRect: createBucket(),
      getComputedStyle: createBucket(),
      appendChild: createBucket(),
      insertBefore: createBucket(),
      removeChild: createBucket(),
      clientWidth: createBucket(),
      clientHeight: createBucket(),
      offsetHeight: createBucket(),
      offsetWidth: createBucket(),
      scrollHeight: createBucket(),
    };

    const bump = (key, startedAt) => {
      if (!counts[key]) {
        return;
      }
      counts[key].count += 1;
      counts[key].totalMs += performance.now() - startedAt;
    };

    const isOwnedNode = (value) => {
      if (!value) {
        return false;
      }
      const element =
        value instanceof Element
          ? value
          : value instanceof Node && value.parentElement instanceof Element
            ? value.parentElement
            : null;
      return element instanceof Element ? Boolean(element.closest('.cw-host')) : false;
    };

    const wrapMethod = (target, key, bucketKey) => {
      const original = target[key];
      if (typeof original !== 'function') {
        return;
      }
      target[key] = function(...args) {
        const shouldTrack = isOwnedNode(this) || args.some((arg) => isOwnedNode(arg));
        if (!shouldTrack) {
          return original.apply(this, args);
        }
        const startedAt = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          bump(bucketKey, startedAt);
        }
      };
    };

    const wrapGetter = (target, key, bucketKey) => {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (!descriptor || typeof descriptor.get !== 'function' || descriptor.configurable !== true) {
        return;
      }
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: descriptor.enumerable ?? false,
        get() {
          if (!isOwnedNode(this)) {
            return descriptor.get.call(this);
          }
          const startedAt = performance.now();
          try {
            return descriptor.get.call(this);
          } finally {
            bump(bucketKey, startedAt);
          }
        },
        set: descriptor.set
          ? function(value) {
              return descriptor.set.call(this, value);
            }
          : undefined,
      });
    };

    wrapMethod(Element.prototype, 'getBoundingClientRect', 'getBoundingClientRect');
    wrapMethod(window, 'getComputedStyle', 'getComputedStyle');
    wrapMethod(Node.prototype, 'appendChild', 'appendChild');
    wrapMethod(Node.prototype, 'insertBefore', 'insertBefore');
    wrapMethod(Node.prototype, 'removeChild', 'removeChild');
    wrapGetter(Element.prototype, 'clientWidth', 'clientWidth');
    wrapGetter(Element.prototype, 'clientHeight', 'clientHeight');
    wrapGetter(HTMLElement.prototype, 'offsetHeight', 'offsetHeight');
    wrapGetter(HTMLElement.prototype, 'offsetWidth', 'offsetWidth');
    wrapGetter(Element.prototype, 'scrollHeight', 'scrollHeight');

    window.__cwBenchProbe__ = {
      reset() {
        Object.keys(counts).forEach((key) => {
          counts[key].count = 0;
          counts[key].totalMs = 0;
        });
      },
      read() {
        return JSON.parse(JSON.stringify(counts));
      },
    };
  })()`);
}

async function resetBenchmarkProbe(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    window.__cwBenchProbe__?.reset?.();
  })()`);
}

async function readBenchmarkProbe(page: Page): Promise<BenchmarkProbeStats | null> {
  return page.evaluate(`(() => {
    return window.__cwBenchProbe__?.read?.() ?? null;
  })()`);
}

async function waitForFirstRelevantChange(
  page: Page,
  baseline: BenchmarkSnapshot,
  expectation: 'order' | 'count-or-order',
): Promise<{ snapshot: BenchmarkSnapshot; elapsedMs: number }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 6_000) {
    const current = await readBenchmarkSnapshot(page);
    const changed =
      expectation === 'order'
        ? current.firstIds.join('|') !== baseline.firstIds.join('|')
        : current.cardCount !== baseline.cardCount || current.firstIds.join('|') !== baseline.firstIds.join('|');
    if (changed) {
      return {
        snapshot: current,
        elapsedMs: Date.now() - startedAt,
      };
    }
    await page.waitForTimeout(16);
  }

  throw new Error('Timed out waiting for first relevant benchmark change.');
}

async function waitForSteadySnapshot(
  page: Page,
  requestTracker: RelevantRequestTracker,
  options: {
    quietMs?: number;
    stableMs?: number;
    timeoutMs?: number;
    allowBackgroundActivityAfterMs?: number;
  } = {},
): Promise<{ snapshot: BenchmarkSnapshot; elapsedMs: number }> {
  const quietMs = options.quietMs ?? 450;
  const stableMs = options.stableMs ?? 300;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const allowBackgroundActivityAfterMs = options.allowBackgroundActivityAfterMs ?? Number.POSITIVE_INFINITY;
  const startedAt = Date.now();
  let lastSnapshot = await readBenchmarkSnapshot(page);
  let lastSignature = snapshotSignature(lastSnapshot);
  let stableSince = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await page.waitForTimeout(50);
    const nextSnapshot = await readBenchmarkSnapshot(page);
    const nextSignature = snapshotSignature(nextSnapshot);
    if (nextSignature !== lastSignature) {
      lastSnapshot = nextSnapshot;
      lastSignature = nextSignature;
      stableSince = Date.now();
      continue;
    }
    const stableDurationMs = Date.now() - stableSince;
    const hasNoInflightRequests = !requestTracker.hasInflightRequests();
    const settledWithQuietIdle =
      stableDurationMs >= stableMs && nextSnapshot.leavingCount === 0 && requestTracker.isIdle(quietMs);
    const settledWithRelaxedIdle =
      stableDurationMs >= Math.max(stableMs, quietMs) && nextSnapshot.leavingCount === 0 && hasNoInflightRequests;
    const settledWithBackgroundActivityAllowance =
      stableDurationMs >= allowBackgroundActivityAfterMs && nextSnapshot.leavingCount === 0;
    if (settledWithQuietIdle || settledWithRelaxedIdle || settledWithBackgroundActivityAllowance) {
      return {
        snapshot: nextSnapshot,
        elapsedMs: Date.now() - startedAt,
      };
    }
  }

  throw new Error('Timed out waiting for benchmark steady-state.');
}

async function readSelectValue(page: Page, selector: string): Promise<string> {
  return page.evaluate((nextSelector) => {
    const element = document.querySelector(nextSelector);
    return element instanceof HTMLSelectElement ? element.value : '';
  }, selector);
}

async function selectOptionIfNeeded(page: Page, selector: string, value: string): Promise<void> {
  const currentValue = await readSelectValue(page, selector);
  if (currentValue === value) {
    return;
  }
  await page.selectOption(selector, value);
}

async function applyBenchmarkBaseline(page: Page, baseline: BenchmarkBaseline): Promise<void> {
  await selectOptionIfNeeded(page, '#cw-audio-filter', baseline.audioFilter);
  await selectOptionIfNeeded(page, '#cw-genre-filter', baseline.genreFilter);
  await selectOptionIfNeeded(page, '#cw-watch-ready-mode', baseline.watchReadyMode);
  await selectOptionIfNeeded(page, '#cw-sort-mode', baseline.sortMode);
}

async function settleBenchmarkBaseline(
  page: Page,
  requestTracker: RelevantRequestTracker,
  baseline: BenchmarkBaseline,
): Promise<BenchmarkSnapshot> {
  await applyBenchmarkBaseline(page, baseline);
  return (await waitForSteadySnapshot(page, requestTracker)).snapshot;
}

async function measureInteraction(options: {
  page: Page;
  cdpSession: CDPSession;
  requestTracker: RelevantRequestTracker;
  name: string;
  selector: string;
  targetValue: string;
  expectation: 'order' | 'count-or-order';
  before: BenchmarkSnapshot;
}): Promise<BenchmarkMeasurement> {
  const { page, cdpSession, requestTracker, name, selector, targetValue, expectation, before } = options;
  await resetBenchmarkProbe(page);
  requestTracker.resetWindow();
  const metricsBeforeRecord = toMetricRecord(
    (await cdpSession.send('Performance.getMetrics')).metrics as Array<{ name: string; value: number }>,
  );
  const metricsBefore = pickEnginePerfMetrics(metricsBeforeRecord);
  const memoryBefore = pickEngineMemoryMetrics(metricsBeforeRecord);
  await page.selectOption(selector, targetValue);
  const firstChange = await waitForFirstRelevantChange(page, before, expectation);
  const settled = await waitForSteadySnapshot(page, requestTracker);
  const after = settled.snapshot;
  const metricsAfterRecord = toMetricRecord(
    (await cdpSession.send('Performance.getMetrics')).metrics as Array<{ name: string; value: number }>,
  );
  const metricsAfter = pickEnginePerfMetrics(metricsAfterRecord);
  const memoryAfter = pickEngineMemoryMetrics(metricsAfterRecord);
  const probeStats = await readBenchmarkProbe(page);
  const requestUrls = requestTracker.readWindowUrls();

  return {
    name,
    selector,
    targetValue,
    expectation,
    firstChangeMs: firstChange.elapsedMs,
    settledMs: firstChange.elapsedMs + settled.elapsedMs,
    requestCount: requestUrls.length,
    before,
    after,
    countersDelta: diffNumericRecord(
      before.debugStats?.counters || {
        created: 0,
        patched: 0,
        parked: 0,
        unparked: 0,
        disposed: 0,
        renderPasses: 0,
      },
      after.debugStats?.counters || {
        created: 0,
        patched: 0,
        parked: 0,
        unparked: 0,
        disposed: 0,
        renderPasses: 0,
      },
    ),
    perfDelta: diffNumericRecord(
      before.debugStats?.perfDiagnostics || {
        routeObserverBatchesProcessed: 0,
        routeObserverBatchesIgnored: 0,
        routeStructureChecks: 0,
        routeStructureSyncs: 0,
        gridLayoutCacheHits: 0,
        gridLayoutCacheMisses: 0,
        retainedCardHideScheduled: 0,
        retainedCardHideCompleted: 0,
        localizedPreloadRenderRequestsQueued: 0,
        localizedPreloadRenderRequestsDeduped: 0,
      },
      after.debugStats?.perfDiagnostics || {
        routeObserverBatchesProcessed: 0,
        routeObserverBatchesIgnored: 0,
        routeStructureChecks: 0,
        routeStructureSyncs: 0,
        gridLayoutCacheHits: 0,
        gridLayoutCacheMisses: 0,
        retainedCardHideScheduled: 0,
        retainedCardHideCompleted: 0,
        localizedPreloadRenderRequestsQueued: 0,
        localizedPreloadRenderRequestsDeduped: 0,
      },
    ),
    enginePerfDelta: diffNumericRecord(metricsBefore, metricsAfter),
    memoryDelta: diffNumericRecord(memoryBefore, memoryAfter),
    probeStats,
  };
}

async function measureSteadyInteraction(options: {
  page: Page;
  cdpSession: CDPSession;
  requestTracker: RelevantRequestTracker;
  baseline: BenchmarkBaseline;
  name: string;
  selector: string;
  targetValue: string;
  expectation: 'order' | 'count-or-order';
}): Promise<BenchmarkMeasurement> {
  const { page, cdpSession, requestTracker, baseline, name, selector, targetValue, expectation } = options;
  let lastMeasurement: BenchmarkMeasurement | null = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const before = await settleBenchmarkBaseline(page, requestTracker, baseline);
    const measurement = await measureInteraction({
      page,
      cdpSession,
      requestTracker,
      name,
      selector,
      targetValue,
      expectation,
      before,
    });
    if (measurement.requestCount === 0) {
      return measurement;
    }
    lastMeasurement = measurement;
    console.log(
      `[bench] ${name} attempt=${attempt} observed ${measurement.requestCount} relevant request(s); retrying after idle.`,
    );
    await page.waitForTimeout(750);
  }

  if (!lastMeasurement) {
    throw new Error(`Benchmark measurement for ${name} did not produce a result.`);
  }
  return lastMeasurement;
}

async function main(): Promise<void> {
  console.log(`[bench] Building generated runtime at ${runtimeOutputDir}...`);
  await buildGeneratedRuntime();
  console.log('[bench] Build complete.');

  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error(`No browser context available over CDP at ${cdpUrl}.`);
  }

  const page =
    context.pages().find((candidate) => isWatchlistUrl(candidate.url())) ||
    context.pages().find((candidate) => candidate.url().includes('crunchyroll.com')) ||
    context.pages()[0];
  if (!page) {
    throw new Error('No Crunchyroll page available in attached browser session.');
  }

  await page.bringToFront();
  if (!isWatchlistUrl(page.url())) {
    await page.goto('https://www.crunchyroll.com/watchlist', {
      waitUntil: 'domcontentloaded',
    });
  } else {
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
  }

  const requestTracker = createRelevantRequestTracker(page);
  await injectLatest(page);
  await page.waitForTimeout(3_200);
  await page.waitForSelector('#cw-audio-filter', { timeout: 20_000 });
  await page.waitForSelector('#cw-sort-mode', { timeout: 20_000 });
  await page.waitForSelector('#cw-genre-filter', { timeout: 20_000 });
  await page.waitForSelector('#cw-watch-ready-mode', { timeout: 20_000 });
  const cdpSession = await context.newCDPSession(page);
  await cdpSession.send('Performance.enable');
  await installBenchmarkProbe(page);

  const baseline = await waitForSteadySnapshot(page, requestTracker, {
    timeoutMs: 20_000,
    allowBackgroundActivityAfterMs: 2_500,
  });
  const originalAudio = baseline.snapshot.audioFilter || 'any';
  const originalSort = baseline.snapshot.sortMode || 'consensus_quality_desc';
  const originalGenre = baseline.snapshot.genreFilter || 'any';
  const originalWatchReady = baseline.snapshot.watchReadyMode || 'hide';
  const normalizedBaselineControls: BenchmarkBaseline = {
    audioFilter: 'any',
    genreFilter: 'any',
    watchReadyMode: 'hide',
    sortMode: 'consensus_quality_desc',
  };

  const normalizedBaseline = await settleBenchmarkBaseline(page, requestTracker, normalizedBaselineControls);
  console.log('[bench] baseline', JSON.stringify(normalizedBaseline));

  const genreOptions = (await page.evaluate(`(() => {
    const genreFilterElement = document.querySelector('#cw-genre-filter');
    if (!(genreFilterElement instanceof HTMLSelectElement)) {
      return [];
    }
    return Array.from(genreFilterElement.options).map((option) => option.value);
  })()`)) as string[];

  const sortTarget = 'rating_desc';
  const genreTarget = genreOptions.find((value: string) => value === '__favorites__') || 'any';
  const watchReadyTarget = 'dim';

  const measurements: BenchmarkMeasurement[] = [];
  measurements.push(
    await measureSteadyInteraction({
      page,
      cdpSession,
      requestTracker,
      baseline: normalizedBaselineControls,
      name: 'sort-change',
      selector: '#cw-sort-mode',
      targetValue: sortTarget,
      expectation: 'order',
    }),
  );

  if (genreTarget !== originalGenre) {
    measurements.push(
      await measureSteadyInteraction({
        page,
        cdpSession,
        requestTracker,
        baseline: normalizedBaselineControls,
        name: 'genre-favorites',
        selector: '#cw-genre-filter',
        targetValue: genreTarget,
        expectation: 'count-or-order',
      }),
    );
  }

  measurements.push(
    await measureSteadyInteraction({
      page,
      cdpSession,
      requestTracker,
      baseline: normalizedBaselineControls,
      name: 'watch-ready-toggle',
      selector: '#cw-watch-ready-mode',
      targetValue: watchReadyTarget,
      expectation: 'count-or-order',
    }),
  );

  await applyBenchmarkBaseline(page, {
    audioFilter: originalAudio,
    genreFilter: originalGenre,
    watchReadyMode: originalWatchReady,
    sortMode: originalSort,
  });
  await waitForSteadySnapshot(page, requestTracker, { allowBackgroundActivityAfterMs: 2_500 });
  console.log('[bench] restored', JSON.stringify(await readBenchmarkSnapshot(page)));

  console.log('[bench] client-only measurements');
  measurements.forEach((measurement) => {
    console.log(
      `[bench] ${measurement.name} target=${measurement.targetValue} first=${measurement.firstChangeMs}ms settled=${measurement.settledMs}ms requests=${measurement.requestCount}`,
    );
    console.log(`[bench] ${measurement.name} countersDelta=${JSON.stringify(measurement.countersDelta)}`);
    console.log(`[bench] ${measurement.name} perfDelta=${JSON.stringify(measurement.perfDelta)}`);
    console.log(`[bench] ${measurement.name} enginePerfDelta=${JSON.stringify(measurement.enginePerfDelta)}`);
    console.log(`[bench] ${measurement.name} memoryDelta=${JSON.stringify(measurement.memoryDelta)}`);
    console.log(`[bench] ${measurement.name} probeStats=${JSON.stringify(measurement.probeStats)}`);
  });

  const noisyMeasurements = measurements.filter((measurement) => measurement.requestCount > 0);
  if (noisyMeasurements.length) {
    console.log(
      `[bench] warning: ${noisyMeasurements.length} interaction(s) triggered relevant requests and are not purely client-only.`,
    );
  } else {
    console.log('[bench] all measured interactions were client-only (no relevant extension/API requests observed).');
  }

  await cdpSession.send('Performance.disable');
  requestTracker.dispose();
  await browser.close();
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
});
