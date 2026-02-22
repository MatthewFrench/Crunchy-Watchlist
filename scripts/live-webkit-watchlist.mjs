import { watch } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const profileDir = path.join(repoRoot, '.tmp', 'webkit-profile');
const cssPath = path.join(repoRoot, 'extension', 'content.css');
const jsPath = path.join(repoRoot, 'extension', 'content.js');
const hotReloadEnabled = !/^(0|false|no)$/i.test(String(process.env.CW_PW_HOT_RELOAD ?? '1'));

let latestSourceSnapshot = {
  cssText: '',
  jsText: ''
};

const context = await webkit.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1600, height: 960 }
});

const page = context.pages()[0] || (await context.newPage());

function isWatchlistUrl(urlString) {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length > 0 && segments[segments.length - 1] === 'watchlist';
  } catch (_) {
    return false;
  }
}

async function report(reason) {
  const summary = await page.evaluate(() => ({
    pathname: window.location.pathname,
    title: document.title,
    href: window.location.href,
    nativeCards: document.querySelectorAll('[data-t="watch-list-card"]').length,
    nativeRated: Array.from(document.querySelectorAll('[data-t="watch-list-card"]')).filter((card) => {
      const raw = (card.dataset.cwRating || '').trim();
      return !!raw && Number.isFinite(Number(raw));
    }).length,
    nativeHidden: Array.from(document.querySelectorAll('.erc-my-lists-item, [class*="my-lists-item"]')).filter((item) =>
      item.classList.contains('cw-hidden')
    ).length,
    curatedCards: document.querySelectorAll('.cw-curated-card').length,
    curatedRated: Array.from(document.querySelectorAll('.cw-curated-card .cw-rating-badge')).filter((badge) =>
      !badge.textContent?.includes('NR')
    ).length,
    controls: !!document.querySelector('.cw-controls'),
    root: !!document.querySelector('.erc-watchlist'),
    header: !!document.querySelector('.erc-watchlist .watchlist-header'),
    anyWatchlistClass: !!document.querySelector('[class*="watchlist"]'),
    loginForm: !!document.querySelector('input[type="password"], form[action*="login"], [data-t*="login"]'),
    runtimePhase: window.__CW_WATCHLIST_CURATOR_RUNTIME__?.phase || null,
    runtimeEvents: (window.__CW_WATCHLIST_CURATOR_RUNTIME__?.events || []).slice(-3)
  }));
  console.log(
    `[${reason}] ${summary.pathname} nativeCards=${summary.nativeCards} nativeRated=${summary.nativeRated} nativeHidden=${summary.nativeHidden} ` +
      `curatedCards=${summary.curatedCards} curatedRated=${summary.curatedRated} controls=${summary.controls ? 'yes' : 'no'} ` +
      `root=${summary.root ? 'yes' : 'no'} header=${summary.header ? 'yes' : 'no'} ` +
      `anyWatchlistClass=${summary.anyWatchlistClass ? 'yes' : 'no'} loginForm=${summary.loginForm ? 'yes' : 'no'} ` +
      `phase=${summary.runtimePhase || 'n/a'}`
  );
  console.log(`[${reason}] title="${summary.title}" url=${summary.href}`);
  if (summary.runtimeEvents?.length) {
    console.log(`[${reason}] runtimeEvents=${JSON.stringify(summary.runtimeEvents)}`);
  }
}

async function injectLatest(reason) {
  const [cssText, jsText] = await Promise.all([
    fs.readFile(cssPath, 'utf8'),
    fs.readFile(jsPath, 'utf8')
  ]);

  latestSourceSnapshot = { cssText, jsText };

  await page.evaluate((styles) => {
    const styleId = 'cw-live-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = styles;
  }, cssText);

  await page.evaluate((source) => {
    // Use eval in page context so this works even when site CSP blocks inline script tags.
    // eslint-disable-next-line no-eval
    eval(source);
  }, jsText);

  const markerLoaded = await page.evaluate(() => !!window.__CW_WATCHLIST_CURATOR_LOADED__);
  console.log(`[inject] markerLoaded=${markerLoaded ? 'yes' : 'no'}`);
  await page.waitForTimeout(3200);
  await report(reason);
}

let suppressNavInjection = false;

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
    await injectLatest('watchlist-nav');
  } catch (error) {
    console.error('Watchlist navigation check failed:', error?.message || error);
  }
});

await page.goto('https://www.crunchyroll.com/watchlist', {
  waitUntil: 'domcontentloaded'
});

await injectLatest('startup');

let hotReloadTimer = null;
let hotReloadInFlight = false;

async function runHotReload() {
  if (!hotReloadEnabled) {
    return;
  }

  if (hotReloadInFlight) {
    return;
  }

  if (!isWatchlistUrl(page.url())) {
    console.log('[hot-reload] Change detected, but current page is not /watchlist. Navigate back to /watchlist to apply.');
    return;
  }

  hotReloadInFlight = true;
  suppressNavInjection = true;

  try {
    const [nextCssText, nextJsText] = await Promise.all([
      fs.readFile(cssPath, 'utf8'),
      fs.readFile(jsPath, 'utf8')
    ]);

    if (nextCssText === latestSourceSnapshot.cssText && nextJsText === latestSourceSnapshot.jsText) {
      console.log('[hot-reload] Ignoring noisy file event (no content changes).');
      return;
    }

    console.log('[hot-reload] Reloading page and applying latest extension files...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await injectLatest('hot-reload');
  } catch (error) {
    console.error('Hot reload failed:', error?.message || error);
  } finally {
    suppressNavInjection = false;
    hotReloadInFlight = false;
  }
}

function scheduleHotReload(changedFile) {
  if (!hotReloadEnabled) {
    return;
  }

  console.log(`[hot-reload] Detected change in ${path.basename(changedFile)}.`);
  clearTimeout(hotReloadTimer);
  hotReloadTimer = setTimeout(() => {
    runHotReload().catch((error) => {
      console.error('Hot reload task failed:', error?.message || error);
    });
  }, 250);
}

const fileWatchers = hotReloadEnabled
  ? [
      watch(jsPath, () => scheduleHotReload(jsPath)),
      watch(cssPath, () => scheduleHotReload(cssPath))
    ]
  : [];

console.log('Live WebKit session started (init-script injection active on every navigation).');
console.log('If login redirects you away from /watchlist, complete login and return to /watchlist.');
console.log('Watch the terminal for [watchlist-nav] or [startup] status lines.');
if (hotReloadEnabled) {
  console.log('Hot reload enabled: edits to content.js/content.css trigger page reload + reinject.');
} else {
  console.log('Hot reload disabled (CW_PW_HOT_RELOAD=0).');
}
console.log('Press Ctrl+C in this terminal to stop this session.');

function cleanup() {
  fileWatchers.forEach((watcher) => {
    try {
      watcher.close();
    } catch (_) {
      // no-op
    }
  });
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

await new Promise(() => {});
