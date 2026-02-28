(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type NativeActionBridgeContext = {
    documentRef: Document;
    runtimeEvent: (event: string, data?: unknown) => void;
  };

  type NativeActionBridgeOptions = {
    documentRef?: unknown;
    runtimeEvent?: unknown;
  };

  type NativeActionBridgeRuntime = {
    triggerNativeCardAction: (seriesId: unknown, actionType: unknown) => boolean;
    findNativeCardBySeriesId: (seriesId: unknown) => HTMLElement | null;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing native action bridge dependency: ${name}`);
    }
    return value as T;
  }

  function resolveDocumentRef(value: unknown): Document {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing native action bridge documentRef');
    }
    return value as Document;
  }

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  function createNativeActionBridgeContext(options: NativeActionBridgeOptions = {}): NativeActionBridgeContext {
    return {
      documentRef: resolveDocumentRef(options.documentRef),
      runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as NativeActionBridgeContext['runtimeEvent'],
    };
  }

  function extractSeriesIdFromHref(href: string): string | null {
    const match = href.match(/\/series\/([^/?#]+)/i);
    if (!match || !match[1]) {
      return null;
    }

    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  function getNativeCardSeriesId(card: HTMLElement): string | null {
    const links = Array.from(card.querySelectorAll('a[href*="/series/"]'));
    for (const link of links) {
      const seriesId = extractSeriesIdFromHref(link.getAttribute('href') || '');
      if (seriesId) {
        return seriesId;
      }
    }

    return null;
  }

  function findNativeCardBySeriesIdInternal(documentRef: Document, seriesId: string): HTMLElement | null {
    if (!seriesId) {
      return null;
    }

    const nativeCards = Array.from(documentRef.querySelectorAll('[data-t="watch-list-card"]'));
    for (const card of nativeCards) {
      if (!(card instanceof HTMLElement)) {
        continue;
      }

      if (getNativeCardSeriesId(card) === seriesId) {
        return card;
      }
    }

    return null;
  }

  function findNativeActionButton(card: HTMLElement, actionType: string): HTMLElement | null {
    const selectors =
      actionType === 'favorite'
        ? [
            '[data-cw-native-action="favorite"]',
            'button[aria-label*="favorite" i]',
            '[role="button"][aria-label*="favorite" i]',
            '[data-t*="favorite" i]',
            'button[class*="favorite" i]',
            'button[class*="heart" i]',
          ]
        : [
            '[data-cw-native-action="remove"]',
            'button[aria-label*="remove" i]',
            '[role="button"][aria-label*="remove" i]',
            'button[aria-label*="trash" i]',
            '[role="button"][aria-label*="trash" i]',
            'button[aria-label*="delete" i]',
            '[role="button"][aria-label*="delete" i]',
            '[data-t*="remove" i]',
            'button[class*="remove" i]',
            'button[class*="trash" i]',
            'button[class*="delete" i]',
          ];

    for (const selector of selectors) {
      const button = card.querySelector(selector);
      if (button instanceof HTMLElement) {
        return button;
      }
    }

    return null;
  }

  function triggerNativeCardActionInternal(
    context: NativeActionBridgeContext,
    seriesIdValue: unknown,
    actionTypeValue: unknown,
  ): boolean {
    const seriesId = getString(seriesIdValue);
    const actionType = getString(actionTypeValue).toLowerCase();
    if (!seriesId || (actionType !== 'favorite' && actionType !== 'remove')) {
      return false;
    }

    const nativeCard = findNativeCardBySeriesIdInternal(context.documentRef, seriesId);
    if (!nativeCard) {
      return false;
    }

    const nativeButton = findNativeActionButton(nativeCard, actionType);
    if (!nativeButton) {
      return false;
    }

    nativeButton.click();
    context.runtimeEvent('native-action-forwarded', {
      seriesId,
      actionType,
    });
    return true;
  }

  function createNativeActionBridgeRuntime(options: NativeActionBridgeOptions = {}): NativeActionBridgeRuntime {
    const context = createNativeActionBridgeContext(options);

    return {
      triggerNativeCardAction: (seriesId, actionType) => triggerNativeCardActionInternal(context, seriesId, actionType),
      findNativeCardBySeriesId: (seriesId) => {
        const resolvedSeriesId = getString(seriesId);
        return resolvedSeriesId ? findNativeCardBySeriesIdInternal(context.documentRef, resolvedSeriesId) : null;
      },
    };
  }

  moduleRegistry.runtimeNativeActionBridge = {
    createNativeActionBridgeRuntime,
  };
})();
