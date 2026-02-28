import {
  createNativeCardSelectorAdapterRuntime,
  type NativeCardSelectorAdapterRuntime,
} from './NativeCardSelectorAdapter.js';

type RuntimeModuleRegistry = Record<string, unknown>;

type RuntimeGlobal = typeof globalThis & {
  __CW_WATCHLIST_CURATOR_MODULES__?: RuntimeModuleRegistry;
};

export type NativeActionBridgeRuntime = {
  triggerNativeCardAction: (seriesId: unknown, actionType: unknown) => boolean;
  findNativeCardBySeriesId: (seriesId: unknown) => HTMLElement | null;
};

type NativeActionSelectorAdapterRuntime = Pick<
  NativeCardSelectorAdapterRuntime,
  'findNativeCards' | 'findSeriesLinks' | 'findNativeActionButton'
>;

type NativeActionBridgeContext = {
  documentRef: Document;
  runtimeEvent: (event: string, data?: unknown) => void;
  selectorAdapterRuntime: NativeActionSelectorAdapterRuntime;
};

export type NativeActionBridgeOptions = {
  documentRef?: unknown;
  runtimeEvent?: unknown;
  selectorAdapterRuntime?: unknown;
};

function requireFunction<T>(name: string, value: unknown): T {
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

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, unknown>;
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveSelectorAdapterRuntime(runtimeValue: unknown, sourceLabel: string): NativeActionSelectorAdapterRuntime {
  const runtimeRecord = asRecord(runtimeValue);
  return {
    findNativeCards: requireFunction<NativeActionSelectorAdapterRuntime['findNativeCards']>(
      `${sourceLabel}.findNativeCards`,
      runtimeRecord.findNativeCards,
    ),
    findSeriesLinks: requireFunction<NativeActionSelectorAdapterRuntime['findSeriesLinks']>(
      `${sourceLabel}.findSeriesLinks`,
      runtimeRecord.findSeriesLinks,
    ),
    findNativeActionButton: requireFunction<NativeActionSelectorAdapterRuntime['findNativeActionButton']>(
      `${sourceLabel}.findNativeActionButton`,
      runtimeRecord.findNativeActionButton,
    ),
  };
}

function createNativeActionBridgeContext(options: NativeActionBridgeOptions = {}): NativeActionBridgeContext {
  return {
    documentRef: resolveDocumentRef(options.documentRef),
    runtimeEvent: requireFunction<NativeActionBridgeContext['runtimeEvent']>('runtimeEvent', options.runtimeEvent),
    selectorAdapterRuntime: options.selectorAdapterRuntime
      ? resolveSelectorAdapterRuntime(options.selectorAdapterRuntime, 'selectorAdapterRuntime')
      : createNativeCardSelectorAdapterRuntime({}),
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

function getNativeCardSeriesId(context: NativeActionBridgeContext, card: HTMLElement): string | null {
  const links = context.selectorAdapterRuntime.findSeriesLinks(card);
  for (const link of links) {
    const href = typeof link.getAttribute === 'function' ? link.getAttribute('href') || '' : '';
    const seriesId = extractSeriesIdFromHref(href);
    if (seriesId) {
      return seriesId;
    }
  }

  return null;
}

function findNativeCardBySeriesIdInternal(context: NativeActionBridgeContext, seriesId: string): HTMLElement | null {
  if (!seriesId) {
    return null;
  }

  const nativeCards = context.selectorAdapterRuntime.findNativeCards(context.documentRef);
  for (const card of nativeCards) {
    if (getNativeCardSeriesId(context, card) === seriesId) {
      return card;
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

  const nativeCard = findNativeCardBySeriesIdInternal(context, seriesId);
  if (!nativeCard) {
    return false;
  }

  const nativeButton = context.selectorAdapterRuntime.findNativeActionButton(nativeCard, actionType);
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

export function createNativeActionBridgeRuntime(options: NativeActionBridgeOptions = {}): NativeActionBridgeRuntime {
  const context = createNativeActionBridgeContext(options);

  return {
    triggerNativeCardAction: (seriesId, actionType) => triggerNativeCardActionInternal(context, seriesId, actionType),
    findNativeCardBySeriesId: (seriesId) => {
      const resolvedSeriesId = getString(seriesId);
      return resolvedSeriesId ? findNativeCardBySeriesIdInternal(context, resolvedSeriesId) : null;
    },
  };
}

function registerNativeActionBridgeRuntime(): void {
  const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeGlobal;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }

  root.__CW_WATCHLIST_CURATOR_MODULES__.runtimeNativeActionBridge = {
    createNativeActionBridgeRuntime,
  };
}

registerNativeActionBridgeRuntime();
