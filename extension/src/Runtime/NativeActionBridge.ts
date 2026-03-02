import {
  createNativeCardSelectorAdapterRuntime,
  type NativeActionType,
  type NativeCardSelectorAdapterRuntime,
} from './NativeCardSelectorAdapter.js';

type NativeActionBridgeBoundaryValue = CwBoundaryValue;
type NativeActionBridgeBoundaryRecord = Record<string, NativeActionBridgeBoundaryValue>;
type NativeActionBridgeRuntimeEvent = (event: string, data?: NativeActionBridgeBoundaryValue) => void;

export type NativeActionBridgeRuntime = {
  triggerNativeCardAction: (
    seriesId: NativeActionBridgeBoundaryValue,
    actionType: NativeActionBridgeBoundaryValue,
  ) => boolean;
  findNativeCardBySeriesId: (seriesId: NativeActionBridgeBoundaryValue) => HTMLElement | null;
};

type NativeActionSelectorAdapterRuntime = Pick<
  NativeCardSelectorAdapterRuntime,
  'findNativeCardMatches' | 'findNativeActionButton'
>;

type NativeActionBridgeContext = {
  documentRef: Document;
  runtimeEvent: NativeActionBridgeRuntimeEvent;
  selectorAdapterRuntime: NativeActionSelectorAdapterRuntime;
};

export type NativeActionBridgeOptions = {
  documentRef?: NativeActionBridgeBoundaryValue;
  runtimeEvent?: NativeActionBridgeBoundaryValue;
  selectorAdapterRuntime?: NativeActionBridgeBoundaryValue;
};

function requireFunction<T>(name: string, value: NativeActionBridgeBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing native action bridge dependency: ${name}`);
  }

  return value as T;
}

function resolveDocumentRef(value: NativeActionBridgeBoundaryValue): Document {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing native action bridge documentRef');
  }

  return value as Document;
}

function asRecord(value: NativeActionBridgeBoundaryValue): NativeActionBridgeBoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as NativeActionBridgeBoundaryRecord;
}

function getString(value: NativeActionBridgeBoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveSelectorAdapterRuntime(
  runtimeValue: NativeActionBridgeBoundaryValue,
  sourceLabel: string,
): NativeActionSelectorAdapterRuntime {
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
  seriesIdValue: NativeActionBridgeBoundaryValue,
  actionTypeValue: NativeActionBridgeBoundaryValue,
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
