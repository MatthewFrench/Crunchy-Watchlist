#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { type FSWatcher, watch } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { type BrowserContext, chromium, type Page } from '@playwright/test';

type LiveSourceEntry = {
  file: string;
  source: string;
};

type LiveSourceSnapshot = {
  signature: string;
  cssText: string;
  jsEntries: LiveSourceEntry[];
};

type ManifestAssets = {
  cssFiles: string[];
  jsFiles: string[];
};

type ReportSummary = {
  pathname: string;
  title: string;
  href: string;
  nativeCards: number;
  nativeRated: number;
  nativeHidden: number;
  curatedCards: number;
  curatedRated: number;
  controls: boolean;
  root: boolean;
  header: boolean;
  anyWatchlistClass: boolean;
  loginForm: boolean;
  runtimePhase: string | null;
  runtimeEvents: unknown[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const rawProfileDir = String(process.env.CW_PW_PROFILE_DIR || '').trim();
const profileDir = rawProfileDir
  ? path.isAbsolute(rawProfileDir)
    ? rawProfileDir
    : path.resolve(repoRoot, rawProfileDir)
  : path.join(repoRoot, '.tmp', 'chromium-profile');
const executablePath = String(process.env.CW_PW_EXECUTABLE_PATH || '').trim();
const sourceExtensionDir = path.join(repoRoot, 'extension');
const runtimeOutputRelativeDir = String(process.env.EXTENSION_RUNTIME_DIR || '.tmp/extension-runtime-dev').trim();
const runtimeOutputDir = path.resolve(repoRoot, runtimeOutputRelativeDir);
const manifestPath = path.join(runtimeOutputDir, 'manifest.json');
const bundleContentScripts = !/^(0|false|no)$/i.test(String(process.env.CW_BUNDLE_CONTENT_SCRIPTS ?? '1').trim());
const hotReloadEnabled = !/^(0|false|no)$/i.test(String(process.env.CW_PW_HOT_RELOAD ?? '1'));
const runtimeInjectionEnabled = !/^(0|false|no)$/i.test(String(process.env.CW_PW_LIVE_RUNTIME_INJECTION ?? '1'));
const slowMoMs = Math.max(0, Number.parseInt(String(process.env.CW_PW_SLOW_MO_MS ?? '0').trim(), 10) || 0);
const execFileAsync = promisify(execFile);

let latestSourceSnapshot: LiveSourceSnapshot = {
  signature: '',
  cssText: '',
  jsEntries: [],
};

let hotReloadTimer: NodeJS.Timeout | null = null;
let hotReloadInFlight = false;
let suppressNavInjection = false;
let shutdownInFlight = false;

function getErrorMessage(error: unknown): string {
  const maybeError = error as { message?: string; stderr?: unknown };
  const stderr = typeof maybeError?.stderr === 'string' ? maybeError.stderr.trim() : '';
  return stderr || maybeError?.message || String(error);
}

async function buildGeneratedRuntime(): Promise<void> {
  if (!bundleContentScripts) {
    throw new Error('CW_BUNDLE_CONTENT_SCRIPTS=0 is no longer supported; bundled content scripts are required.');
  }

  const buildScriptPath = path.join(repoRoot, 'scripts', 'build-extension-runtime.mts');
  const bundleFlag = '--bundle-content-scripts';
  try {
    await execFileAsync('tsx', [buildScriptPath, bundleFlag, '--out', runtimeOutputDir], {
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
  const scriptPath = path.join(runtimeOutputDir, relativeScriptPath);

  try {
    return await fs.readFile(scriptPath, 'utf8');
  } catch (error) {
    if ((error as { code?: string })?.code !== 'ENOENT') {
      throw error;
    }

    throw new Error(`Missing generated extension script asset: ${scriptPath}`);
  }
}

async function readLatestSourceSnapshot(): Promise<LiveSourceSnapshot> {
  const { cssFiles, jsFiles } = await readManifestAssets();

  const cssChunks: string[] = [];
  for (const cssFile of cssFiles) {
    const cssPath = path.join(runtimeOutputDir, cssFile);
    cssChunks.push(`/* ${cssFile} */\n${await fs.readFile(cssPath, 'utf8')}`);
  }

  const jsEntries: LiveSourceEntry[] = [];
  for (const jsFile of jsFiles) {
    const source = await readRuntimeScriptSource(jsFile);
    jsEntries.push({
      file: jsFile,
      source: `${source}\n//# sourceURL=cw-live/${jsFile.replace(/\s+/g, '_')}`,
    });
  }

  const cssText = cssChunks.join('\n\n');
  const signature = `${cssText}__CW_SPLIT__${jsEntries.map((entry) => entry.source).join('__CW_SCRIPT__')}`;

  return {
    signature,
    cssText,
    jsEntries,
  };
}

async function report(page: Page, reason: string): Promise<void> {
  const summary = await page.evaluate<ReportSummary>(() => ({
    pathname: window.location.pathname,
    title: document.title,
    href: window.location.href,
    nativeCards: document.querySelectorAll('[data-t="watch-list-card"]').length,
    nativeRated: Array.from(document.querySelectorAll('[data-t="watch-list-card"]')).filter((card) => {
      const raw = ((card as HTMLElement).dataset.cwRating || '').trim();
      return !!raw && Number.isFinite(Number(raw));
    }).length,
    nativeHidden: Array.from(document.querySelectorAll('.erc-my-lists-item, [class*="my-lists-item"]')).filter((item) =>
      item.classList.contains('cw-hidden'),
    ).length,
    curatedCards: document.querySelectorAll('.cw-curated-card').length,
    curatedRated: Array.from(document.querySelectorAll('.cw-curated-card .cw-rating-badge')).filter(
      (badge) => !badge.textContent?.includes('NR'),
    ).length,
    controls: !!document.querySelector('.cw-controls'),
    root: !!document.querySelector('.erc-watchlist'),
    header: !!document.querySelector('.erc-watchlist .watchlist-header'),
    anyWatchlistClass: !!document.querySelector('[class*="watchlist"]'),
    loginForm: !!document.querySelector('input[type="password"], form[action*="login"], [data-t*="login"]'),
    runtimePhase:
      (window as Window & { __CW_WATCHLIST_CURATOR_RUNTIME__?: { phase?: string } }).__CW_WATCHLIST_CURATOR_RUNTIME__
        ?.phase || null,
    runtimeEvents:
      (
        window as Window & {
          __CW_WATCHLIST_CURATOR_RUNTIME__?: {
            events?: unknown[];
          };
        }
      ).__CW_WATCHLIST_CURATOR_RUNTIME__?.events?.slice(-3) || [],
  }));

  console.log(
    `[${reason}] ${summary.pathname} nativeCards=${summary.nativeCards} nativeRated=${summary.nativeRated} nativeHidden=${summary.nativeHidden} ` +
      `curatedCards=${summary.curatedCards} curatedRated=${summary.curatedRated} controls=${summary.controls ? 'yes' : 'no'} ` +
      `root=${summary.root ? 'yes' : 'no'} header=${summary.header ? 'yes' : 'no'} ` +
      `anyWatchlistClass=${summary.anyWatchlistClass ? 'yes' : 'no'} loginForm=${summary.loginForm ? 'yes' : 'no'} ` +
      `phase=${summary.runtimePhase || 'n/a'}`,
  );
  console.log(`[${reason}] title="${summary.title}" url=${summary.href}`);
  if (summary.runtimeEvents.length) {
    console.log(`[${reason}] runtimeEvents=${JSON.stringify(summary.runtimeEvents)}`);
  }
}

async function injectLatest(page: Page, reason: string): Promise<void> {
  const snapshot = await readLatestSourceSnapshot();
  latestSourceSnapshot = snapshot;

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
      // Use eval in page context so this works even when site CSP blocks inline script tags.
      // biome-ignore lint/security/noGlobalEval: page-context injection is required for this live-debug script.
      eval(source);
    }, entry.source);
  }

  const markerLoaded = await page.evaluate(() => {
    return !!(window as Window & { __CW_WATCHLIST_CURATOR_LOADED__?: unknown }).__CW_WATCHLIST_CURATOR_LOADED__;
  });
  console.log(`[inject] markerLoaded=${markerLoaded ? 'yes' : 'no'}`);
  await page.waitForTimeout(3200);
  await report(page, reason);
}

async function runHotReload(page: Page): Promise<void> {
  if (!runtimeInjectionEnabled || !hotReloadEnabled || hotReloadInFlight) {
    return;
  }

  if (!isWatchlistUrl(page.url())) {
    console.log(
      '[hot-reload] Change detected, but current page is not /watchlist. Navigate back to /watchlist to apply.',
    );
    return;
  }

  hotReloadInFlight = true;
  suppressNavInjection = true;

  try {
    console.log('[hot-reload] Rebuilding generated runtime...');
    await buildGeneratedRuntime();
    const nextSnapshot = await readLatestSourceSnapshot();

    if (nextSnapshot.signature === latestSourceSnapshot.signature) {
      console.log('[hot-reload] Ignoring noisy file event (no content changes).');
      return;
    }

    console.log('[hot-reload] Reloading page and applying latest extension files...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await injectLatest(page, 'hot-reload');
  } catch (error) {
    console.error('Hot reload failed:', getErrorMessage(error));
  } finally {
    suppressNavInjection = false;
    hotReloadInFlight = false;
  }
}

function scheduleHotReload(page: Page, changedFile: string): void {
  if (!hotReloadEnabled) {
    return;
  }

  console.log(`[hot-reload] Detected change in ${path.basename(changedFile)}.`);
  if (hotReloadTimer) {
    clearTimeout(hotReloadTimer);
  }

  hotReloadTimer = setTimeout(() => {
    runHotReload(page).catch((error) => {
      console.error('Hot reload task failed:', getErrorMessage(error));
    });
  }, 250);
}

function createFileWatchers(page: Page): FSWatcher[] {
  if (!hotReloadEnabled) {
    return [];
  }

  return [
    watch(sourceExtensionDir, { recursive: true }, (_eventType, changedFile) => {
      if (typeof changedFile !== 'string') {
        return;
      }

      if (!/\.(css|js|ts|json)$/i.test(changedFile)) {
        return;
      }

      scheduleHotReload(page, changedFile);
    }),
  ];
}

function cleanup(watchers: FSWatcher[]): void {
  for (const watcher of watchers) {
    try {
      watcher.close();
    } catch {
      // no-op
    }
  }
}

async function shutdownSession(context: BrowserContext, watchers: FSWatcher[], signal: NodeJS.Signals): Promise<void> {
  if (shutdownInFlight) {
    return;
  }
  shutdownInFlight = true;
  cleanup(watchers);
  if (hotReloadTimer) {
    clearTimeout(hotReloadTimer);
    hotReloadTimer = null;
  }
  try {
    await context.close();
  } catch (error) {
    console.error(`[shutdown] Failed to close browser context after ${signal}:`, getErrorMessage(error));
  }
  console.log(`[shutdown] ${signal} received. Live Chromium session stopped.`);
}

if (runtimeInjectionEnabled) {
  console.log(`[runtime-build] Building generated runtime at ${runtimeOutputDir}...`);
  await buildGeneratedRuntime();
  console.log('[runtime-build] Build complete.');
} else {
  console.log('[runtime-build] Skipped (CW_PW_LIVE_RUNTIME_INJECTION=0).');
}

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1600, height: 960 },
  slowMo: slowMoMs,
  ...(executablePath ? { executablePath } : {}),
});
const page = context.pages()[0] || (await context.newPage());
console.log(`[browser] profileDir=${profileDir}`);
if (executablePath) {
  console.log(`[browser] executablePath=${executablePath}`);
}

page.on('framenavigated', async (frame) => {
  if (frame !== page.mainFrame()) {
    return;
  }

  if (!isWatchlistUrl(frame.url())) {
    return;
  }

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
    if (suppressNavInjection) {
      return;
    }
    if (runtimeInjectionEnabled) {
      await injectLatest(page, 'watchlist-nav');
    } else {
      await report(page, 'watchlist-nav');
    }
  } catch (error) {
    console.error('Watchlist navigation check failed:', getErrorMessage(error));
  }
});

if (runtimeInjectionEnabled) {
  suppressNavInjection = true;
}
try {
  await page.goto('https://www.crunchyroll.com/watchlist', {
    waitUntil: 'domcontentloaded',
  });
  if (runtimeInjectionEnabled) {
    await injectLatest(page, 'startup');
  } else {
    await report(page, 'startup');
  }
} finally {
  suppressNavInjection = false;
}

const fileWatchers = runtimeInjectionEnabled ? createFileWatchers(page) : [];

if (runtimeInjectionEnabled) {
  console.log(
    `Live Chromium session started (generated runtime injection from ${runtimeOutputDir} on every watchlist navigation).`,
  );
} else {
  console.log('Live Chromium native-site session started (no extension runtime injection).');
}
console.log('If login redirects you away from /watchlist, complete login and return to /watchlist.');
console.log('Watch the terminal for [watchlist-nav] or [startup] status lines.');
if (!runtimeInjectionEnabled) {
  console.log('Runtime injection disabled; this session only observes native Crunchyroll UI.');
} else if (hotReloadEnabled) {
  console.log(
    'Hot reload enabled: edits under extension/**/*.(js|ts|css|json) trigger runtime rebuild + page reload + reinject.',
  );
} else {
  console.log('Hot reload disabled (CW_PW_HOT_RELOAD=0).');
}
if (slowMoMs > 0) {
  console.log(`Slow motion enabled (${slowMoMs}ms/action).`);
}
console.log('Press Ctrl+C in this terminal to stop this session.');

await new Promise<void>((resolve) => {
  const handleSignal = (signal: NodeJS.Signals): void => {
    void shutdownSession(context, fileWatchers, signal).finally(resolve);
  };
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
});
