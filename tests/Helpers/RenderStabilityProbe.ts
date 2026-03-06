import type { Page } from '@playwright/test';

export type CuratedDomLifecycleCounters = {
  created: number;
  patched: number;
  parked: number;
  unparked: number;
  disposed: number;
  renderPasses: number;
};

export type CuratedDomLifecycleStats = {
  counters: CuratedDomLifecycleCounters;
  totalLifecycleMutations: number;
  identityChurnRate: number;
  activeSeriesIds?: string[];
};

export async function readCuratedDomLifecycleStats(page: Page): Promise<CuratedDomLifecycleStats> {
  return page.evaluate(() => {
    type DebugApiShape = {
      getCuratedDomStats?: () => CuratedDomLifecycleStats;
    };

    const debugApi = (window as Window & typeof globalThis & { __CW_WATCHLIST_CURATOR_DEBUG__?: DebugApiShape })
      .__CW_WATCHLIST_CURATOR_DEBUG__;
    if (!debugApi || typeof debugApi.getCuratedDomStats !== 'function') {
      throw new Error('Missing debug API getCuratedDomStats()');
    }

    return debugApi.getCuratedDomStats();
  });
}

export async function installCardContentMutationProbe(page: Page, probeKey: string): Promise<boolean> {
  return page.evaluate((nextProbeKey) => {
    type MutationProbeState = {
      contentMutationCount: number;
      observers: MutationObserver[];
    };
    type ProbeWindow = Window &
      typeof globalThis & {
        __cwCardContentMutationProbes__?: Record<string, MutationProbeState>;
      };

    const cards = Array.from(document.querySelectorAll('.cw-curated-card'));
    if (!cards.length) {
      return false;
    }

    const shouldIgnoreAttributeMutation = (mutation: MutationRecord): boolean => {
      const attributeName = String(mutation.attributeName || '')
        .trim()
        .toLowerCase();
      if (!attributeName) {
        return false;
      }

      if (attributeName === 'class' || attributeName === 'style') {
        return true;
      }
      if (attributeName === 'data-cw-loading-details' || attributeName === 'data-cw-card-content-signature') {
        return true;
      }
      return false;
    };

    const state: MutationProbeState = {
      contentMutationCount: 0,
      observers: [],
    };
    for (const card of cards) {
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === 'attributes' && shouldIgnoreAttributeMutation(record)) {
            continue;
          }
          state.contentMutationCount += 1;
        }
      });
      observer.observe(card, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
      state.observers.push(observer);
    }

    const windowWithProbe = window as ProbeWindow;
    const existingMap = windowWithProbe.__cwCardContentMutationProbes__;
    const mutationProbes =
      existingMap && typeof existingMap === 'object' && !Array.isArray(existingMap) ? existingMap : {};
    mutationProbes[nextProbeKey] = state;
    windowWithProbe.__cwCardContentMutationProbes__ = mutationProbes;
    return true;
  }, probeKey);
}

export async function readAndDisposeCardContentMutationProbe(page: Page, probeKey: string): Promise<number> {
  return page.evaluate((nextProbeKey) => {
    type MutationProbeState = {
      contentMutationCount: number;
      observers: MutationObserver[];
    };
    type ProbeWindow = Window &
      typeof globalThis & {
        __cwCardContentMutationProbes__?: Record<string, MutationProbeState>;
      };

    const mutationProbesRaw = (window as ProbeWindow).__cwCardContentMutationProbes__;
    const mutationProbes =
      mutationProbesRaw && typeof mutationProbesRaw === 'object' && !Array.isArray(mutationProbesRaw)
        ? mutationProbesRaw
        : null;
    if (!mutationProbes) {
      return -1;
    }
    const state = mutationProbes ? mutationProbes[nextProbeKey] : null;
    if (!state) {
      return -1;
    }

    state.observers.forEach((observer) => {
      observer.disconnect();
    });
    delete mutationProbes[nextProbeKey];

    return state.contentMutationCount;
  }, probeKey);
}
