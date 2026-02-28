import {
  createNativeCardSelectorAdapterRuntime,
  type NativeActionType,
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
  'findNativeCardMatches' | 'findNativeActionButton'
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
    findNativeCardMatches: requireFunction<NativeActionSelectorAdapterRuntime['findNativeCardMatches']>(
      `${sourceLabel}.findNativeCardMatches`,
      runtimeRecord.findNativeCardMatches,
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
function findNativeCardBySeriesIdInternal(context: NativeActionBridgeContext, seriesId: string): HTMLElement | null {
  if (!seriesId) {
    return null;
  }

  const nativeCardMatches = context.selectorAdapterRuntime.findNativeCardMatches(context.documentRef);
  for (const nativeCardMatch of nativeCardMatches) {
    if (nativeCardMatch.seriesId === seriesId) {
      return nativeCardMatch.card;
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

  const nativeButton = context.selectorAdapterRuntime.findNativeActionButton(
    nativeCard,
    actionType as NativeActionType,
  );
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
