import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedPanelGridOrderPlannerOwner = {
  buildOrderPlan: (options: {
    visible: Array<Record<string, unknown>>;
    metadataLoading: boolean;
    createOrReuseCuratedCard: (
      entry: Record<string, unknown>,
      detailsLoading: boolean,
      visibleSeriesIds: Set<string>,
    ) => Element;
    getEntrySeriesId: (entry: Record<string, unknown>) => string;
    markCardControllerActive: (seriesId: string) => void;
    setCardParkedState: (card: Element, parked: boolean) => void;
    isRenderableEntryMetadataLoading: (entry: Record<string, unknown>) => boolean;
  }) => {
    visibleSeriesIds: Set<string>;
    nextCards: Element[];
  };
};

type OrderPlannerModule = {
  CuratedPanelGridOrderPlannerOwner: new () => CuratedPanelGridOrderPlannerOwner;
};

const moduleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridOrderPlanner.ts'),
).href;

let OwnerCtor: OrderPlannerModule['CuratedPanelGridOrderPlannerOwner'] | null = null;

function getOwnerCtor(): OrderPlannerModule['CuratedPanelGridOrderPlannerOwner'] {
  if (!OwnerCtor) {
    throw new Error('CuratedPanelGridOrderPlannerOwner module was not initialized for test');
  }
  return OwnerCtor;
}

describe('curated-panel-grid order planner owner', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(moduleUrl)) as OrderPlannerModule;
    OwnerCtor = module.CuratedPanelGridOrderPlannerOwner;
  });

  it('builds next card order and forwards visibility/loading signals', () => {
    const planner = new (getOwnerCtor())();
    const cardA = {} as Element;
    const cardB = {} as Element;
    const detailsLoadingArgs: Array<{ seriesId: string; detailsLoading: boolean; visibleSeriesIdsSize: number }> = [];
    const markCalls: string[] = [];
    const parkedCalls: Array<{ card: Element; parked: boolean }> = [];

    const plan = planner.buildOrderPlan({
      visible: [
        { seriesId: 'SERIES-A', metadataReady: false },
        { seriesId: 'SERIES-B', metadataReady: true },
      ],
      metadataLoading: true,
      createOrReuseCuratedCard: (entry, detailsLoading, visibleSeriesIds) => {
        const seriesId = String(entry.seriesId || '');
        visibleSeriesIds.add(seriesId);
        detailsLoadingArgs.push({
          seriesId,
          detailsLoading,
          visibleSeriesIdsSize: visibleSeriesIds.size,
        });
        return seriesId === 'SERIES-A' ? cardA : cardB;
      },
      getEntrySeriesId: (entry) => String(entry.seriesId || ''),
      markCardControllerActive: (seriesId) => {
        markCalls.push(seriesId);
      },
      setCardParkedState: (card, parked) => {
        parkedCalls.push({ card, parked });
      },
      isRenderableEntryMetadataLoading: (entry) => Boolean(entry.metadataReady !== true),
    });

    expect(plan.nextCards).toEqual([cardA, cardB]);
    expect(Array.from(plan.visibleSeriesIds)).toEqual(['SERIES-A', 'SERIES-B']);
    expect(detailsLoadingArgs).toEqual([
      { seriesId: 'SERIES-A', detailsLoading: true, visibleSeriesIdsSize: 1 },
      { seriesId: 'SERIES-B', detailsLoading: false, visibleSeriesIdsSize: 2 },
    ]);
    expect(markCalls).toEqual(['SERIES-A', 'SERIES-B']);
    expect(parkedCalls).toEqual([
      { card: cardA, parked: false },
      { card: cardB, parked: false },
    ]);
  });
});
