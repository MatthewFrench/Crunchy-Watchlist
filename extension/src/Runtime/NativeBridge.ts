import { createNativeActionBridgeRuntime, type NativeActionBridgeRuntime } from './NativeActionBridge.js';
import { createNativeBridgePreviewRuntime, type NativeBridgePreviewRuntime } from './NativeBridgePreview.js';

type NativeBridgeBoundaryValue = CwBoundaryValue;
type NativeBridgeBoundaryRecord = Record<string, NativeBridgeBoundaryValue>;
type NativeBridgeRuntimeEvent = (event: string, data?: NativeBridgeBoundaryValue) => void;

type TokenEntry = {
  accountId?: NativeBridgeBoundaryValue;
  accessToken?: NativeBridgeBoundaryValue;
} & NativeBridgeBoundaryRecord;

type FetchWithResilience = (
  url: string,
  requestInit: RequestInit,
  options: {
    label: string;
    bearerToken?: string;
    refreshBearerToken?: NativeBridgeBoundaryValue;
  },
) => Promise<Response>;

type NativeActionType = 'favorite' | 'remove';

type NativeBridgeContext = {
  documentRef: Document;
  windowRef: Window;
  runtimeEvent: NativeBridgeRuntimeEvent;
  nativeActionBridgeRuntime: NativeActionBridgeRuntime;
  getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null>;
  fetchWithResilience: FetchWithResilience;
  createAuthRefreshHandler: (tokenEntry: TokenEntry | null) => NativeBridgeBoundaryValue;
  resolveApiHref: (pathWithQuery: string) => string;
  normalizeImageUrlCandidate: (value: NativeBridgeBoundaryValue) => string;
  fetchPreviewUrlForEntry: (entry: NativeBridgeBoundaryValue) => Promise<NativeBridgeBoundaryValue>;
  isLikelyVideoUrl: (url: NativeBridgeBoundaryValue) => boolean;
  previewHoverDelayMs: number;
  previewRuntime: NativeBridgePreviewRuntime;
};

export type NativeBridgeOptions = {
  documentRef?: NativeBridgeBoundaryValue;
  windowRef?: NativeBridgeBoundaryValue;
  runtimeEvent?: NativeBridgeBoundaryValue;
  getAccessToken?: NativeBridgeBoundaryValue;
  fetchWithResilience?: NativeBridgeBoundaryValue;
  createAuthRefreshHandler?: NativeBridgeBoundaryValue;
  resolveApiHref?: NativeBridgeBoundaryValue;
  normalizeImageUrlCandidate?: NativeBridgeBoundaryValue;
  fetchPreviewUrlForEntry?: NativeBridgeBoundaryValue;
  isLikelyVideoUrl?: NativeBridgeBoundaryValue;
  previewHoverDelayMs?: NativeBridgeBoundaryValue;
  nativeActionBridgeRuntime?: NativeBridgeBoundaryValue;
  nativeBridgePreviewRuntime?: NativeBridgeBoundaryValue;
};

export type NativeBridgeRuntime = {
  triggerNativeCardAction: (
    seriesId: NativeBridgeBoundaryValue,
    actionType: NativeBridgeBoundaryValue,
    favoriteValue?: NativeBridgeBoundaryValue,
  ) => Promise<boolean>;
  installCuratedCardPreview: (
    thumbLink: NativeBridgeBoundaryValue,
    entry: NativeBridgeBoundaryValue,
    coverImageUrl: NativeBridgeBoundaryValue,
    hoverPreviewImageUrl: NativeBridgeBoundaryValue,
    thumbImage: NativeBridgeBoundaryValue,
  ) => void;
  dispose: () => void;
};

function requireFunction<T>(name: string, value: NativeBridgeBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing native bridge dependency: ${name}`);
  }
  return value as T;
}

function asRecord(value: NativeBridgeBoundaryValue): NativeBridgeBoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as NativeBridgeBoundaryRecord;
}

function resolveDocumentRef(value: NativeBridgeBoundaryValue): Document {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing native bridge documentRef');
  }
  return value as Document;
}

function resolveWindowRef(value: NativeBridgeBoundaryValue): Window {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing native bridge windowRef');
  }
  return value as Window;
}

function normalizePositiveNumber(value: NativeBridgeBoundaryValue, fallback: number): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallback;
  }
  return Math.round(normalized);
}

function getString(value: NativeBridgeBoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveNativeActionBridgeRuntime(
  documentRef: Document,
  runtimeEvent: NativeBridgeRuntimeEvent,
  runtimeValue: NativeBridgeBoundaryValue,
): NativeActionBridgeRuntime {
  if (runtimeValue) {
    const runtimeRecord = asRecord(runtimeValue);
    return {
      findNativeCardBySeriesId: requireFunction<NativeActionBridgeRuntime['findNativeCardBySeriesId']>(
        'nativeActionBridgeRuntime.findNativeCardBySeriesId',
        runtimeRecord.findNativeCardBySeriesId,
      ),
      triggerNativeCardAction: requireFunction<NativeActionBridgeRuntime['triggerNativeCardAction']>(
        'nativeActionBridgeRuntime.triggerNativeCardAction',
        runtimeRecord.triggerNativeCardAction,
      ),
    };
  }

  return createNativeActionBridgeRuntime({
    documentRef,
    runtimeEvent,
  });
}

function resolveNativeBridgePreviewRuntime(context: {
  windowRef: Window;
  nativeActionBridgeRuntime: NativeActionBridgeRuntime;
  normalizeImageUrlCandidate: (value: NativeBridgeBoundaryValue) => string;
  fetchPreviewUrlForEntry: (entry: NativeBridgeBoundaryValue) => Promise<NativeBridgeBoundaryValue>;
  isLikelyVideoUrl: (url: NativeBridgeBoundaryValue) => boolean;
  previewHoverDelayMs: number;
  runtimeValue: NativeBridgeBoundaryValue;
}): NativeBridgePreviewRuntime {
  if (context.runtimeValue) {
    const runtimeRecord = asRecord(context.runtimeValue);
    return {
      installCuratedCardPreview: requireFunction<NativeBridgePreviewRuntime['installCuratedCardPreview']>(
        'nativeBridgePreviewRuntime.installCuratedCardPreview',
        runtimeRecord.installCuratedCardPreview,
      ),
      dispose:
        typeof runtimeRecord.dispose === 'function'
          ? (runtimeRecord.dispose as NativeBridgePreviewRuntime['dispose'])
          : () => {},
    };
  }

  return createNativeBridgePreviewRuntime({
    windowRef: context.windowRef,
    nativeActionBridgeRuntime: context.nativeActionBridgeRuntime,
    normalizeImageUrlCandidate: context.normalizeImageUrlCandidate,
    fetchPreviewUrlForEntry: context.fetchPreviewUrlForEntry,
    isLikelyVideoUrl: context.isLikelyVideoUrl,
    previewHoverDelayMs: context.previewHoverDelayMs,
  });
}

function createNativeBridgeContext(options: NativeBridgeOptions = {}): NativeBridgeContext {
  const documentRef = resolveDocumentRef(options.documentRef);
  const runtimeEvent = requireFunction<NativeBridgeContext['runtimeEvent']>('runtimeEvent', options.runtimeEvent);
  const windowRef = resolveWindowRef(options.windowRef);
  const normalizeImageUrlCandidate = requireFunction<NativeBridgeContext['normalizeImageUrlCandidate']>(
    'normalizeImageUrlCandidate',
    options.normalizeImageUrlCandidate,
  );
  const fetchPreviewUrlForEntry = requireFunction<NativeBridgeContext['fetchPreviewUrlForEntry']>(
    'fetchPreviewUrlForEntry',
    options.fetchPreviewUrlForEntry,
  );
  const isLikelyVideoUrl = requireFunction<NativeBridgeContext['isLikelyVideoUrl']>(
    'isLikelyVideoUrl',
    options.isLikelyVideoUrl,
  );
  const previewHoverDelayMs = normalizePositiveNumber(options.previewHoverDelayMs, 220);

  const nativeActionBridgeRuntime = resolveNativeActionBridgeRuntime(
    documentRef,
    runtimeEvent,
    options.nativeActionBridgeRuntime,
  );

  const previewRuntime = resolveNativeBridgePreviewRuntime({
    windowRef,
    nativeActionBridgeRuntime,
    normalizeImageUrlCandidate,
    fetchPreviewUrlForEntry,
    isLikelyVideoUrl,
    previewHoverDelayMs,
    runtimeValue: options.nativeBridgePreviewRuntime,
  });

  return {
    documentRef,
    windowRef,
    runtimeEvent,
    nativeActionBridgeRuntime,
    getAccessToken: requireFunction<NativeBridgeContext['getAccessToken']>('getAccessToken', options.getAccessToken),
    fetchWithResilience: requireFunction<NativeBridgeContext['fetchWithResilience']>(
      'fetchWithResilience',
      options.fetchWithResilience,
    ),
    createAuthRefreshHandler: requireFunction<NativeBridgeContext['createAuthRefreshHandler']>(
      'createAuthRefreshHandler',
      options.createAuthRefreshHandler,
    ),
    resolveApiHref: requireFunction<NativeBridgeContext['resolveApiHref']>('resolveApiHref', options.resolveApiHref),
    normalizeImageUrlCandidate,
    fetchPreviewUrlForEntry,
    isLikelyVideoUrl,
    previewHoverDelayMs,
    previewRuntime,
  };
}

function toTokenEntry(value: NativeBridgeBoundaryValue): TokenEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as TokenEntry;
}

function toActionType(value: NativeBridgeBoundaryValue): NativeActionType | null {
  const actionType = getString(value).toLowerCase();
  if (actionType === 'favorite' || actionType === 'remove') {
    return actionType;
  }
  return null;
}

function createWatchlistActionUrl(context: NativeBridgeContext, accountId: string, seriesId: string): string {
  return context.resolveApiHref(
    `/content/v2/${encodeURIComponent(accountId)}/watchlist/${encodeURIComponent(seriesId)}`,
  );
}

function createWatchlistActionRequestOptions(
  context: NativeBridgeContext,
  tokenEntry: TokenEntry | null,
  actionType: NativeActionType,
): {
  label: string;
  bearerToken?: string;
  refreshBearerToken?: NativeBridgeBoundaryValue;
} {
  const requestOptions: {
    label: string;
    bearerToken?: string;
    refreshBearerToken?: NativeBridgeBoundaryValue;
  } = {
    label: actionType === 'favorite' ? 'watchlist favorite request' : 'watchlist remove request',
    refreshBearerToken: context.createAuthRefreshHandler(tokenEntry),
  };

  if (typeof tokenEntry?.accessToken === 'string' && tokenEntry.accessToken) {
    requestOptions.bearerToken = tokenEntry.accessToken;
  }

  return requestOptions;
}

function createWatchlistActionRequestInit(
  actionType: NativeActionType,
  favoriteValue: NativeBridgeBoundaryValue,
): RequestInit | null {
  if (actionType === 'favorite') {
    if (typeof favoriteValue !== 'boolean') {
      return null;
    }

    return {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        is_favorite: favoriteValue,
      }),
    };
  }

  return {
    method: 'DELETE',
    credentials: 'include',
  };
}

async function triggerNativeCardActionInternal(
  context: NativeBridgeContext,
  seriesIdValue: NativeBridgeBoundaryValue,
  actionTypeValue: NativeBridgeBoundaryValue,
  favoriteValue: NativeBridgeBoundaryValue,
): Promise<boolean> {
  const seriesId = getString(seriesIdValue);
  const actionType = toActionType(actionTypeValue);
  if (!seriesId || !actionType) {
    return false;
  }

  const requestInit = createWatchlistActionRequestInit(actionType, favoriteValue);
  if (!requestInit) {
    context.runtimeEvent('watchlist-action-invalid-request', {
      seriesId,
      actionType,
    });
    return false;
  }

  const tokenEntry = toTokenEntry(await context.getAccessToken(false));
  const accountId = getString(tokenEntry?.accountId);
  if (!accountId) {
    context.runtimeEvent('watchlist-action-missing-account-id', {
      seriesId,
      actionType,
    });
    return false;
  }

  const requestUrl = createWatchlistActionUrl(context, accountId, seriesId);
  const requestOptions = createWatchlistActionRequestOptions(context, tokenEntry, actionType);

  try {
    const response = await context.fetchWithResilience(requestUrl, requestInit, requestOptions);
    if (!response.ok) {
      context.runtimeEvent('watchlist-action-failed', {
        seriesId,
        actionType,
        status: response.status,
      });
      return false;
    }

    context.runtimeEvent('watchlist-action-complete', {
      seriesId,
      actionType,
    });
    return true;
  } catch (error) {
    context.runtimeEvent('watchlist-action-failed', {
      seriesId,
      actionType,
      message: error instanceof Error ? error.message : 'unavailable',
    });
    return false;
  }
}

export function createNativeBridgeRuntime(options: NativeBridgeOptions = {}): NativeBridgeRuntime {
  const context = createNativeBridgeContext(options);

  return {
    triggerNativeCardAction: (seriesId, actionType, favoriteValue) =>
      triggerNativeCardActionInternal(context, seriesId, actionType, favoriteValue),
    installCuratedCardPreview: (thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage) => {
      context.previewRuntime.installCuratedCardPreview(
        thumbLink,
        entry,
        coverImageUrl,
        hoverPreviewImageUrl,
        thumbImage,
      );
    },
    dispose: () => {
      context.previewRuntime.dispose();
    },
  };
}
