declare const browser:
  | {
      runtime?: {
        getManifest?: () => { version?: string };
      };
      storage?: {
        local?: {
          get?: (...args: unknown[]) => unknown;
          set?: (...args: unknown[]) => unknown;
        };
      };
    }
  | undefined;

declare const chrome:
  | {
      runtime?: {
        getManifest?: () => { version?: string };
      };
      storage?: {
        local?: {
          get?: (...args: unknown[]) => unknown;
          set?: (...args: unknown[]) => unknown;
        };
      };
    }
  | undefined;

declare global {
  interface Window {
    __CW_WATCHLIST_CURATOR_MODULES__?: Record<string, unknown>;
    __CW_WATCHLIST_CURATOR_LOADED__?: {
      version?: string;
    };
    __CW_WATCHLIST_CURATOR_RUNTIME__?: {
      phase?: string;
      events?: Array<{
        at: number;
        event: string;
        data: unknown;
      }>;
    };
  }
}

export {};
