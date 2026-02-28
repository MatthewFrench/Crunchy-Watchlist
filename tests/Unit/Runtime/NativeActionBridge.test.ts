import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type NativeActionBridgeRuntime = {
  triggerNativeCardAction: (seriesId: unknown, actionType: unknown) => boolean;
  findNativeCardBySeriesId: (seriesId: unknown) => FakeElement | null;
};

type NativeActionBridgeModule = {
  runtimeNativeActionBridge: {
    createNativeActionBridgeRuntime: (options: Record<string, unknown>) => NativeActionBridgeRuntime;
  };
};

const nativeActionBridgeModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'NativeActionBridge.ts'),
).href;
const nativeCardSelectorAdapterModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'NativeCardSelectorAdapter.ts'),
).href;

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

function getNativeActionBridgeModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as NativeActionBridgeModule;
  return registry.runtimeNativeActionBridge;
}

function createNativeActionBridgeRuntime(cards: FakeElement[]) {
  const runtimeEvents: Array<{ event: string; data?: unknown }> = [];
  const runtime = getNativeActionBridgeModule().createNativeActionBridgeRuntime({
    documentRef: {
      querySelectorAll: (selector: string) => (selector === '[data-t="watch-list-card"]' ? cards : []),
    },
    runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
  });

  return {
    runtime,
    runtimeEvents,
  };
}

describe('native-action-bridge runtime', () => {
  const runtimeGlobal = globalThis as Record<string, unknown>;
  let originalHTMLElement: unknown;
  let originalHTMLAnchorElement: unknown;

  beforeEach(async () => {
    originalHTMLElement = runtimeGlobal.HTMLElement;
    originalHTMLAnchorElement = runtimeGlobal.HTMLAnchorElement;
    runtimeGlobal.HTMLElement = FakeElement;
    runtimeGlobal.HTMLAnchorElement = FakeElement;
    await loadRuntimeModules([nativeCardSelectorAdapterModuleUrl, nativeActionBridgeModuleUrl]);
  });

  afterEach(() => {
    runtimeGlobal.HTMLElement = originalHTMLElement;
    runtimeGlobal.HTMLAnchorElement = originalHTMLAnchorElement;
    clearRuntimeModulesRegistry();
  });

  it('returns false for missing series id or unsupported action', () => {
    const { runtime } = createNativeActionBridgeRuntime([]);

    expect(runtime.triggerNativeCardAction('', 'favorite')).toBe(false);
    expect(runtime.triggerNativeCardAction('series-1', 'unknown')).toBe(false);
  });

  it('forwards favorite action and emits runtime event for matching native card', () => {
    const nativeCard = new FakeElement();
    const seriesLink = new FakeElement();
    seriesLink.setAttribute('href', '/series/series-42');
    nativeCard.setQuerySelectorAll('a[href*="/series/"]', [seriesLink]);

    const favoriteButton = new FakeElement();
    nativeCard.setQuerySelector('[data-cw-native-action="favorite"]', favoriteButton);

    const { runtime, runtimeEvents } = createNativeActionBridgeRuntime([nativeCard]);
    expect(runtime.triggerNativeCardAction('series-42', 'favorite')).toBe(true);
    expect(runtime.findNativeCardBySeriesId('series-42')).toBe(nativeCard);
    expect(favoriteButton.clickCount).toBe(1);
    expect(runtimeEvents).toEqual([
      {
        event: 'native-action-forwarded',
        data: {
          seriesId: 'series-42',
          actionType: 'favorite',
        },
      },
    ]);
  });

  it('returns null when no matching card exists for find-native-card lookup', () => {
    const { runtime } = createNativeActionBridgeRuntime([]);
    expect(runtime.findNativeCardBySeriesId('missing-series')).toBe(null);
  });
});
