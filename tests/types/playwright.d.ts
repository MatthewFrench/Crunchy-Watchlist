/// <reference types="@playwright/test" />

declare global {
  interface Window {
    __CW_WATCHLIST_CURATOR_RUNTIME__?: {
      phase?: string;
      events?: Array<{
        at: number;
        event: string;
        data: unknown;
      }>;
    };
    __cwFixtureActionLog?: Array<{
      action?: string;
      seriesId?: string;
      [key: string]: unknown;
    }>;
  }
}

export {};
