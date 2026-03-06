import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page, type Request, type Route } from '@playwright/test';

const defaultFixturePort = 4173;
const fixturePort = Math.max(
  1,
  Number.parseInt(String(process.env.PW_FIXTURE_SERVER_PORT || `${defaultFixturePort}`), 10) || defaultFixturePort,
);

export const FIXTURE_URL = `http://127.0.0.1:${fixturePort}/watchlist`;
export const NON_WATCHLIST_URL = `http://127.0.0.1:${fixturePort}/browse`;

function resolveExtensionRootDir(): string {
  const configuredRuntimeDir = String(process.env.EXTENSION_RUNTIME_DIR || '').trim();
  if (!configuredRuntimeDir) {
    throw new Error(
      'Missing EXTENSION_RUNTIME_DIR. Use npm run test:e2e* (wrapper-managed) or set EXTENSION_RUNTIME_DIR explicitly to generated runtime output.',
    );
  }
  const resolvedRuntimeDir = path.resolve(process.cwd(), configuredRuntimeDir);
  const manifestPath = path.join(resolvedRuntimeDir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing generated runtime manifest at ${resolvedRuntimeDir}. Run npm run test:e2e or generate runtime output and set EXTENSION_RUNTIME_DIR.`,
    );
  }

  return resolvedRuntimeDir;
}

export async function gotoFixture(page: Page): Promise<void> {
  await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
}

export async function loadExtensionAssets(page: Page): Promise<void> {
  const extensionRootDir = resolveExtensionRootDir();
  const manifestPath = path.join(extensionRootDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    content_scripts?: Array<{
      css?: string[];
      js?: string[];
    }>;
  };
  const contentScript = manifest.content_scripts?.[0] || {};
  const cssFiles = Array.isArray(contentScript.css) ? contentScript.css : [];
  const jsFiles = Array.isArray(contentScript.js) ? contentScript.js : [];

  for (const cssPath of cssFiles) {
    const stylePath = path.join(extensionRootDir, cssPath);
    await page.addStyleTag({ content: fs.readFileSync(stylePath, 'utf8') });
  }

  for (const jsPath of jsFiles) {
    const scriptPath = path.join(extensionRootDir, jsPath);
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Missing generated extension script asset: ${scriptPath}`);
    }

    await page.addScriptTag({ content: fs.readFileSync(scriptPath, 'utf8') });
  }
}

type InjectExtensionOptions = {
  waitForLoaded?: boolean;
  expectCuratedVisible?: boolean;
  preserveCaches?: boolean;
};

export async function injectExtension(
  page: Page,
  settingsOverride: Record<string, unknown> = {},
  options: InjectExtensionOptions = {},
): Promise<void> {
  const settings = {
    activeTab: 'curated',
    watchReadyFilterMode: 'hide',
    audioLocaleFilter: 'any',
    genreFilter: 'any',
    cardLayout: 'portrait',
    sortMode: 'none',
    ...settingsOverride,
  };
  const waitForLoaded = options.waitForLoaded !== false;
  const expectCuratedVisible =
    typeof options.expectCuratedVisible === 'boolean' ? options.expectCuratedVisible : settings.activeTab === 'curated';
  const preserveCaches = options.preserveCaches === true;

  await page.evaluate(
    ({ nextSettings, keepCaches }) => {
      localStorage.setItem('cw_settings_v1', JSON.stringify(nextSettings));
      if (!keepCaches) {
        localStorage.removeItem('cw_rating_cache_v2');
        localStorage.removeItem('cw_watch_history_cache_v1');
        localStorage.removeItem('cw_watchlist_cache_v1');
      }
    },
    { nextSettings: settings, keepCaches: preserveCaches },
  );

  await loadExtensionAssets(page);
  await expect(page.locator('.cw-host')).toBeVisible();
  await expect(page.locator('.cw-curated-grid')).toHaveCount(1);

  if (expectCuratedVisible) {
    await expect(page.locator('.cw-panel')).toBeVisible();
  } else {
    await expect(page.locator('.cw-panel')).toBeHidden();
  }

  if (waitForLoaded) {
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
  }
}

export async function visibleFixtureOrder(page: Page): Promise<Array<string | null>> {
  return page.evaluate(() => {
    type DebugApiShape = {
      getCuratedDomStats?: () => {
        activeSeriesIds?: string[];
      };
    };

    const debugApi = (window as Window & typeof globalThis & { __CW_WATCHLIST_CURATOR_DEBUG__?: DebugApiShape })
      .__CW_WATCHLIST_CURATOR_DEBUG__;
    const activeSeriesIds = debugApi?.getCuratedDomStats?.()?.activeSeriesIds;
    if (Array.isArray(activeSeriesIds) && activeSeriesIds.length > 0) {
      const titleBySeriesId = new Map(
        Array.from(document.querySelectorAll('.cw-curated-card')).map((card) => [
          card.getAttribute('data-cw-series-id') || '',
          card.getAttribute('data-cw-curated-title'),
        ]),
      );
      return activeSeriesIds.map((seriesId) => titleBySeriesId.get(String(seriesId || '').trim()) ?? null);
    }

    return Array.from(document.querySelectorAll('.cw-curated-card')).map((card) =>
      card.getAttribute('data-cw-curated-title'),
    );
  });
}

function isBenignRouteLifecycleError(error: unknown): boolean {
  const errorText = String(error || '');
  return (
    errorText.includes('Target page, context or browser has been closed') ||
    errorText.includes('Response has been disposed')
  );
}

type JsonTransform = (payload: unknown, request: Request) => unknown | Promise<unknown>;

export async function fulfillJsonWithTransform(route: Route, transform: JsonTransform): Promise<void> {
  try {
    const response = await route.fetch();
    const payload = await response.json();
    const nextPayload = await transform(payload, route.request());

    await route.fulfill({
      response,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(nextPayload),
    });
  } catch (error) {
    if (isBenignRouteLifecycleError(error)) {
      return;
    }

    throw error;
  }
}
