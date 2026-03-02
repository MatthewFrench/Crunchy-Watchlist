import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type NativeBridgeRuntime = {
  triggerNativeCardAction: (seriesId: unknown, actionType: unknown, favoriteValue?: unknown) => Promise<boolean>;
  installCuratedCardPreview: (
    thumbLink: unknown,
    entry: unknown,
    coverImageUrl: unknown,
    hoverPreviewImageUrl: unknown,
    thumbImage: unknown,
  ) => void;
};

type NativeBridgeModule = {
  createNativeBridgeRuntime: (options: Record<string, unknown>) => NativeBridgeRuntime;
};

type RuntimeEventRecord = {
  event: string;
  data?: unknown;
};

const nativeBridgeModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'NativeBridge.ts'),
).href;
let nativeBridgeModule: NativeBridgeModule | null = null;

class FakeElement {
  private readonly selectorAllMap = new Map<string, FakeElement[]>();
  private readonly selectorMap = new Map<string, FakeElement | null>();
  private readonly attributes = new Map<string, string>();
  clickCount = 0;

  setQuerySelectorAll(selector: string, results: FakeElement[]): void {
    this.selectorAllMap.set(selector, results);
  }

  setQuerySelector(selector: string, result: FakeElement | null): void {
    this.selectorMap.set(selector, result);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorAllMap.get(selector) ?? [];
  }

  querySelector(selector: string): FakeElement | null {
    return this.selectorMap.get(selector) ?? null;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  click(): void {
    this.clickCount += 1;
  }
}

function getNativeBridgeModule() {
  if (!nativeBridgeModule) {
    throw new Error('Native bridge module was not initialized for test');
  }
  return nativeBridgeModule;
}

function createNativeBridgeRuntime(
  cards: FakeElement[],
  overrides: {
    getAccessToken?: (forceRefresh?: boolean) => Promise<unknown>;
    fetchWithResilience?: ReturnType<typeof vi.fn>;
    createAuthRefreshHandler?: ReturnType<typeof vi.fn>;
    resolveApiHref?: (pathWithQuery: string) => string;
    installCuratedCardPreview?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const runtimeEvents: RuntimeEventRecord[] = [];
  const getAccessToken =
    overrides.getAccessToken ?? vi.fn(async () => ({ accountId: 'account-1', accessToken: 'token' }));
  const fetchWithResilience = (overrides.fetchWithResilience ??
    vi.fn(async () => {
      return new Response(null, { status: 200 });
    })) as ReturnType<typeof vi.fn>;
  const createAuthRefreshHandler = (overrides.createAuthRefreshHandler ?? vi.fn(() => 'refresh-handler')) as ReturnType<
    typeof vi.fn
  >;
  const resolveApiHref =
    overrides.resolveApiHref ?? ((pathWithQuery: string) => `https://api.crunchyroll.test${pathWithQuery}`);

  const runtime = getNativeBridgeModule().createNativeBridgeRuntime({
    documentRef: {
      querySelectorAll: (selector: string) => (selector === '[data-t="watch-list-card"]' ? cards : []),
    },
    windowRef: {
      location: { origin: 'https://www.crunchyroll.com' },
      getComputedStyle: () => ({ backgroundImage: '' }),
      setTimeout: () => 0,
      clearTimeout: () => {},
    },
    runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
    getAccessToken,
    fetchWithResilience,
    createAuthRefreshHandler,
    resolveApiHref,
    normalizeImageUrlCandidate: (value: unknown) => (typeof value === 'string' ? value.trim() : ''),
    fetchPreviewUrlForEntry: async () => '',
    isLikelyVideoUrl: () => false,
    previewHoverDelayMs: 220,
    nativeBridgePreviewRuntime: overrides.installCuratedCardPreview
      ? {
          installCuratedCardPreview: overrides.installCuratedCardPreview,
        }
      : undefined,
  });

  return {
    runtime,
    runtimeEvents,
    getAccessToken,
    fetchWithResilience,
    createAuthRefreshHandler,
  };
}

describe('native-bridge runtime', () => {
  const runtimeGlobal = globalThis as Record<string, unknown>;
  let originalHTMLElement: unknown;
  let originalHTMLAnchorElement: unknown;

  beforeEach(async () => {
    vi.resetModules();
    originalHTMLElement = runtimeGlobal.HTMLElement;
    originalHTMLAnchorElement = runtimeGlobal.HTMLAnchorElement;
    runtimeGlobal.HTMLElement = FakeElement;
    runtimeGlobal.HTMLAnchorElement = FakeElement;
    nativeBridgeModule = (await import(nativeBridgeModuleUrl)) as NativeBridgeModule;
  });

  afterEach(() => {
    runtimeGlobal.HTMLElement = originalHTMLElement;
    runtimeGlobal.HTMLAnchorElement = originalHTMLAnchorElement;
    nativeBridgeModule = null;
  });

  it('returns false for unsupported or missing native action requests', async () => {
    const { runtime, fetchWithResilience } = createNativeBridgeRuntime([]);
    await expect(runtime.triggerNativeCardAction('', 'favorite', true)).resolves.toBe(false);
    await expect(runtime.triggerNativeCardAction('series-1', 'unknown')).resolves.toBe(false);
    await expect(runtime.triggerNativeCardAction('series-1', 'favorite')).resolves.toBe(false);
    expect(fetchWithResilience).not.toHaveBeenCalled();
  });

  it('sends favorite updates through the watchlist api without native forwarding', async () => {
    const nativeCard = new FakeElement();
    const seriesLink = new FakeElement();
    seriesLink.setAttribute('href', '/series/series-42');
    nativeCard.setQuerySelectorAll('a[href*="/series/"]', [seriesLink]);

    const favoriteButton = new FakeElement();
    nativeCard.setQuerySelector('[data-cw-native-action="favorite"]', favoriteButton);

    const { runtime, runtimeEvents, fetchWithResilience, createAuthRefreshHandler } = createNativeBridgeRuntime(
      [nativeCard],
      {
        getAccessToken: vi.fn(async () => ({ accountId: 'account-123', accessToken: 'token-abc' })),
      },
    );
    const didApply = await runtime.triggerNativeCardAction('series-42', 'favorite', false);

    expect(didApply).toBe(true);
    expect(favoriteButton.clickCount).toBe(0);
    expect(createAuthRefreshHandler).toHaveBeenCalledWith({
      accountId: 'account-123',
      accessToken: 'token-abc',
    });
    expect(fetchWithResilience).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit, requestOptions] = fetchWithResilience.mock.calls[0] ?? [];
    expect(requestUrl).toBe('https://api.crunchyroll.test/content/v2/account-123/watchlist/series-42');
    expect(requestInit).toMatchObject({
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
      },
    });
    expect(requestInit.body).toBe(JSON.stringify({ is_favorite: false }));
    expect(requestOptions).toMatchObject({
      label: 'watchlist favorite request',
      bearerToken: 'token-abc',
      refreshBearerToken: 'refresh-handler',
    });
    expect(runtimeEvents).toEqual([
      {
        event: 'watchlist-action-complete',
        data: {
          seriesId: 'series-42',
          actionType: 'favorite',
        },
      },
    ]);
  });

  it('sends remove actions through the watchlist delete endpoint', async () => {
    const { runtime, fetchWithResilience } = createNativeBridgeRuntime([], {
      getAccessToken: vi.fn(async () => ({ accountId: 'account-123', accessToken: 'token-abc' })),
    });

    const didApply = await runtime.triggerNativeCardAction('series-404', 'remove');
    expect(didApply).toBe(true);
    expect(fetchWithResilience).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchWithResilience.mock.calls[0] ?? [];
    expect(requestUrl).toBe('https://api.crunchyroll.test/content/v2/account-123/watchlist/series-404');
    expect(requestInit).toMatchObject({
      method: 'DELETE',
      credentials: 'include',
    });
    expect(requestInit.body).toBeUndefined();
  });

  it('returns false when account id is unavailable', async () => {
    const { runtime, fetchWithResilience, runtimeEvents } = createNativeBridgeRuntime([], {
      getAccessToken: vi.fn(async () => ({ accessToken: 'token-only' })),
    });

    const didApply = await runtime.triggerNativeCardAction('series-404', 'remove');
    expect(didApply).toBe(false);
    expect(fetchWithResilience).not.toHaveBeenCalled();
    expect(runtimeEvents).toEqual([
      {
        event: 'watchlist-action-missing-account-id',
        data: {
          seriesId: 'series-404',
          actionType: 'remove',
        },
      },
    ]);
  });

  it('returns false when the watchlist request fails', async () => {
    const { runtime, runtimeEvents } = createNativeBridgeRuntime([], {
      fetchWithResilience: vi.fn(async () => {
        throw new Error('request failed');
      }),
    });

    const didApply = await runtime.triggerNativeCardAction('series-505', 'remove');
    expect(didApply).toBe(false);
    expect(runtimeEvents).toEqual([
      {
        event: 'watchlist-action-failed',
        data: {
          seriesId: 'series-505',
          actionType: 'remove',
          message: 'request failed',
        },
      },
    ]);
  });

  it('delegates curated preview installs to the preview runtime module', () => {
    const installCuratedCardPreview = vi.fn();
    const { runtime } = createNativeBridgeRuntime([], {
      installCuratedCardPreview,
    });

    runtime.installCuratedCardPreview('thumb-link', { seriesId: 'series-1' }, 'cover.jpg', 'hover.jpg', 'thumb-image');

    expect(installCuratedCardPreview).toHaveBeenCalledTimes(1);
    expect(installCuratedCardPreview).toHaveBeenCalledWith(
      'thumb-link',
      { seriesId: 'series-1' },
      'cover.jpg',
      'hover.jpg',
      'thumb-image',
    );
  });
});
