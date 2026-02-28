import { createNativeActionBridgeRuntime, type NativeActionBridgeRuntime } from './NativeActionBridge.js';
import { createNativeBridgePreviewRuntime, type NativeBridgePreviewRuntime } from './NativeBridgePreview.js';

type RuntimeModuleRegistry = Record<string, unknown>;

type RuntimeGlobal = typeof globalThis & {
  __CW_WATCHLIST_CURATOR_MODULES__?: RuntimeModuleRegistry;
};

type TokenEntry = {
  accountId?: unknown;
  accessToken?: unknown;
} & Record<string, unknown>;

type FetchWithResilience = (
  url: string,
  requestInit: RequestInit,
  options: {
    label: string;
    bearerToken?: string;
    refreshBearerToken?: unknown;
  },
) => Promise<Response>;

type NativeActionType = 'favorite' | 'remove';

type NativeBridgeContext = {
  documentRef: Document;
  windowRef: Window;
  runtimeEvent: (event: string, data?: unknown) => void;
  nativeActionBridgeRuntime: NativeActionBridgeRuntime;
  getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null>;
  fetchWithResilience: FetchWithResilience;
  createAuthRefreshHandler: (tokenEntry: TokenEntry | null) => unknown;
  resolveApiHref: (pathWithQuery: string) => string;
  normalizeImageUrlCandidate: (value: unknown) => string;
  fetchPreviewUrlForEntry: (entry: unknown) => Promise<unknown>;
  isLikelyVideoUrl: (url: unknown) => boolean;
  previewHoverDelayMs: number;
  previewRuntime: NativeBridgePreviewRuntime;
};

export type NativeBridgeOptions = {
  documentRef?: unknown;
  windowRef?: unknown;
  runtimeEvent?: unknown;
  getAccessToken?: unknown;
  fetchWithResilience?: unknown;
  createAuthRefreshHandler?: unknown;
  resolveApiHref?: unknown;
  normalizeImageUrlCandidate?: unknown;
  fetchPreviewUrlForEntry?: unknown;
  isLikelyVideoUrl?: unknown;
  previewHoverDelayMs?: unknown;
  nativeActionBridgeRuntime?: unknown;
  nativeBridgePreviewRuntime?: unknown;
};

export type NativeBridgeRuntime = {
  triggerNativeCardAction: (seriesId: unknown, actionType: unknown, favoriteValue?: unknown) => Promise<boolean>;
  installCuratedCardPreview: (
    thumbLink: unknown,
    entry: unknown,
    coverImageUrl: unknown,
    hoverPreviewImageUrl: unknown,
    thumbImage: unknown,
  ) => void;
};

function requireFunction<T>(name: string, value: unknown): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing native bridge dependency: ${name}`);
  }
  return value as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, unknown>;
}

function resolveDocumentRef(value: unknown): Document {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing native bridge documentRef');
  }
  return value as Document;
}

function resolveWindowRef(value: unknown): Window {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing native bridge windowRef');
  }
  return value as Window;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallback;
  }
  return Math.round(normalized);
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveNativeActionBridgeRuntime(
  documentRef: Document,
  runtimeEvent: (event: string, data?: unknown) => void,
  runtimeValue: unknown,
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
  normalizeImageUrlCandidate: (value: unknown) => string;
  fetchPreviewUrlForEntry: (entry: unknown) => Promise<unknown>;
  isLikelyVideoUrl: (url: unknown) => boolean;
  previewHoverDelayMs: number;
  runtimeValue: unknown;
}): NativeBridgePreviewRuntime {
  if (context.runtimeValue) {
    const runtimeRecord = asRecord(context.runtimeValue);
    return {
      installCuratedCardPreview: requireFunction<NativeBridgePreviewRuntime['installCuratedCardPreview']>(
        'nativeBridgePreviewRuntime.installCuratedCardPreview',
        runtimeRecord.installCuratedCardPreview,
      ),
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

function toTokenEntry(value: unknown): TokenEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as TokenEntry;
}

function toActionType(value: unknown): NativeActionType | null {
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
  refreshBearerToken?: unknown;
} {
  const requestOptions: {
    label: string;
    bearerToken?: string;
    refreshBearerToken?: unknown;
  } = {
    label: actionType === 'favorite' ? 'watchlist favorite request' : 'watchlist remove request',
    refreshBearerToken: context.createAuthRefreshHandler(tokenEntry),
  };

  if (typeof tokenEntry?.accessToken === 'string' && tokenEntry.accessToken) {
    requestOptions.bearerToken = tokenEntry.accessToken;
  }

  return requestOptions;
}

function createWatchlistActionRequestInit(actionType: NativeActionType, favoriteValue: unknown): RequestInit | null {
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
  seriesIdValue: unknown,
  actionTypeValue: unknown,
  favoriteValue: unknown,
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
      message: error instanceof Error ? error.message : 'unknown',
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
  };
}

function registerNativeBridgeRuntime(): void {
  const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeGlobal;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }

  root.__CW_WATCHLIST_CURATOR_MODULES__.runtimeNativeBridge = {
    createNativeBridgeRuntime,
  };
}

registerNativeBridgeRuntime();
