import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type FakeElement = {
  tagName: string;
  className: string;
  textContent: string;
  children: FakeElement[];
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  style: Record<string, string>;
  ownerDocument: {
    createElement: (tagName: string) => FakeElement;
    createTextNode: (text: string) => { textContent: string };
  };
  appendChild: (child: FakeElement | { textContent: string }) => FakeElement | { textContent: string };
  setAttribute: (name: string, value: string) => void;
};

type CardViewRuntime = {
  createCuratedCardBody: (entry: unknown, actions: FakeElement) => FakeElement;
  patchCuratedCardBody: (card: FakeElement, entry: unknown) => void;
};

type CardViewModule = {
  createCardView: (deps: Record<string, unknown>) => CardViewRuntime;
};

const cardViewModuleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Ui', 'CuratedCardView.ts')).href;

function createFakeDocument() {
  const createElement = (tagName: string): FakeElement => {
    const element: FakeElement = {
      tagName,
      className: '',
      textContent: '',
      children: [],
      dataset: {},
      attributes: {},
      style: {},
      ownerDocument: {
        createElement,
        createTextNode: (text: string) => ({ textContent: text }),
      },
      appendChild(child: FakeElement | { textContent: string }) {
        if ('tagName' in child) {
          this.children.push(child);
        } else {
          this.textContent += child.textContent;
        }
        return child;
      },
      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      },
    };
    return element;
  };

  return {
    createElement,
    createTextNode: (text: string) => ({ textContent: text }),
  };
}

function getCardViewModule(): CardViewModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    ui?: Record<string, unknown>;
  };
  return registry.ui?.cardView as CardViewModule;
}

function findByClassName(root: FakeElement, className: string): FakeElement | null {
  if (root.className === className) {
    return root;
  }

  for (const child of root.children) {
    const found = findByClassName(child, className);
    if (found) {
      return found;
    }
  }

  return null;
}

describe('curated-card-view ui module', () => {
  const originalDocument = (globalThis as Record<string, unknown>).document;

  beforeEach(async () => {
    (globalThis as Record<string, unknown>).document = createFakeDocument();
    await loadRuntimeModules([cardViewModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
    (globalThis as Record<string, unknown>).document = originalDocument;
  });

  it('merges next episode into the status line and removes next-unwatched row', () => {
    const setLabeledValue = vi.fn((element: FakeElement, label: string, value: string) => {
      element.textContent = `${label}: ${value}`;
    });

    const runtime = getCardViewModule().createCardView({
      getLastWatchedPresentation: () => ({ state: 'dated', text: '2026-02-24' }),
      setLabeledValue,
      getSeriesScopePairs: () => [],
      setLabeledValuePairs: vi.fn(),
      appendLabeledValue: vi.fn(),
      getGenreValue: () => '',
      makeRatingHistogram: () => (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
      formatVotes: () => '0',
      sanitizePercentage: () => 0,
      getStarCountFromDistribution: () => 0,
    });

    const body = runtime.createCuratedCardBody(
      {
        statusBase: 'Up Next',
        nextEpisodeLabel: 'S1 E3',
        description: 'Show description',
      },
      (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
    );

    const status = findByClassName(body, 'cw-curated-card__status');
    expect(status?.textContent).toBe('Up Next: S1 E3');
    expect(findByClassName(body, 'cw-curated-card__next')).toBeNull();
    expect(setLabeledValue).not.toHaveBeenCalledWith(expect.anything(), 'Next unwatched', expect.anything());
  });

  it('keeps plain status text when next episode is unavailable', () => {
    const runtime = getCardViewModule().createCardView({
      getLastWatchedPresentation: () => ({ state: 'unknown', text: 'unknown' }),
      setLabeledValue: (element: FakeElement, label: string, value: string) => {
        element.textContent = `${label}: ${value}`;
      },
      getSeriesScopePairs: () => [],
      setLabeledValuePairs: vi.fn(),
      appendLabeledValue: vi.fn(),
      getGenreValue: () => '',
      makeRatingHistogram: () => (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
      formatVotes: () => '0',
      sanitizePercentage: () => 0,
      getStarCountFromDistribution: () => 0,
    });

    const body = runtime.createCuratedCardBody(
      {
        statusBase: 'Continue',
        nextEpisodeLabel: '',
      },
      (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
    );

    const status = findByClassName(body, 'cw-curated-card__status');
    expect(status?.textContent).toBe('Continue');
    expect(findByClassName(body, 'cw-curated-card__next')).toBeNull();
  });

  it('merges continue status with the next episode label', () => {
    const runtime = getCardViewModule().createCardView({
      getLastWatchedPresentation: () => ({ state: 'dated', text: '2026-02-24' }),
      setLabeledValue: (element: FakeElement, label: string, value: string) => {
        element.textContent = `${label}: ${value}`;
      },
      getSeriesScopePairs: () => [],
      setLabeledValuePairs: vi.fn(),
      appendLabeledValue: vi.fn(),
      getGenreValue: () => '',
      makeRatingHistogram: () => (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
      formatVotes: () => '0',
      sanitizePercentage: () => 0,
      getStarCountFromDistribution: () => 0,
    });

    const body = runtime.createCuratedCardBody(
      {
        statusBase: 'Continue',
        nextEpisodeLabel: 'S1 E4',
      },
      (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
    );

    const status = findByClassName(body, 'cw-curated-card__status');
    expect(status?.textContent).toBe('Continue: S1 E4');
    expect(findByClassName(body, 'cw-curated-card__next')).toBeNull();
  });

  it('renders a hidden empty-genre row and a dedicated details skeleton container', () => {
    const runtime = getCardViewModule().createCardView({
      getLastWatchedPresentation: () => ({ state: 'unknown', text: 'unknown' }),
      setLabeledValue: (element: FakeElement, label: string, value: string) => {
        element.textContent = `${label}: ${value}`;
      },
      getSeriesScopePairs: () => [],
      setLabeledValuePairs: vi.fn(),
      appendLabeledValue: vi.fn(),
      getGenreValue: () => '',
      makeRatingHistogram: () => (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
      formatVotes: () => '0',
      sanitizePercentage: () => 0,
      getStarCountFromDistribution: () => 0,
    });

    const body = runtime.createCuratedCardBody(
      {
        statusBase: 'Continue',
        nextEpisodeLabel: '',
      },
      (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
    );

    const genres = findByClassName(body, 'cw-curated-card__genres');
    expect(genres?.dataset.cwEmpty).toBe('true');
    const detailsSkeleton = findByClassName(body, 'cw-curated-card__details-skeleton');
    expect(detailsSkeleton).not.toBeNull();
    const starSkeletonRows = detailsSkeleton?.children.filter((child) =>
      child.className.includes('cw-curated-card__details-skeleton-line--star-row'),
    );
    expect(starSkeletonRows).toHaveLength(5);
  });

  it('patches existing body fields in place without recreating field nodes', () => {
    const runtime = getCardViewModule().createCardView({
      getLastWatchedPresentation: (entry: Record<string, unknown>) => ({
        state: String(entry.lastWatchedState || 'unknown'),
        text: String(entry.lastWatchedText || 'unknown'),
      }),
      setLabeledValue: (element: FakeElement, label: string, value: string) => {
        element.textContent = `${label}: ${value}`;
      },
      getSeriesScopePairs: (entry: Record<string, unknown>) =>
        (entry.scopePairs as Array<{ label: string; value: string }>) || [],
      setLabeledValuePairs: (element: FakeElement, pairs: Array<{ label: string; value: string }>) => {
        element.textContent = pairs.map(({ label, value }) => `${label}:${value}`).join(' | ');
      },
      appendLabeledValue: (element: FakeElement, label: string, value: string) => {
        element.textContent += `${element.textContent ? ' | ' : ''}${label}:${value}`;
      },
      getGenreValue: (entry: Record<string, unknown>) => String(entry.genreValue || ''),
      makeRatingHistogram: () => {
        const histogram = (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div');
        histogram.className = 'cw-rating-histogram';
        return histogram;
      },
      formatVotes: (votes: number) => String(votes),
      sanitizePercentage: (value: unknown) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      },
      getStarCountFromDistribution: (votes: unknown, distribution: unknown, star: unknown) => {
        const votesNumber = Number(votes);
        const distributionValue = Number((distribution as Record<string, unknown>)?.[String(star)]);
        if (!Number.isFinite(votesNumber) || !Number.isFinite(distributionValue)) {
          return null;
        }
        return Math.round((votesNumber * distributionValue) / 100);
      },
    });

    const actions = (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div');
    const body = runtime.createCuratedCardBody(
      {
        description: 'Initial description',
        statusBase: 'Continue',
        nextEpisodeLabel: 'S1 E2',
        lastWatchedState: 'dated',
        lastWatchedText: '2026-02-20',
        scopePairs: [
          { label: 'Seasons', value: '1' },
          { label: 'Episodes', value: '12' },
        ],
        genreValue: 'Action',
        votes: 100,
      },
      actions,
    );

    const card = (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('article');
    card.className = 'cw-curated-card';
    card.appendChild(body);

    const statusBefore = findByClassName(card, 'cw-curated-card__status');
    const genresBefore = findByClassName(card, 'cw-curated-card__genres');
    const histogramBefore = findByClassName(card, 'cw-rating-histogram');
    const ratingMetaBefore = findByClassName(card, 'cw-curated-card__rating-meta');

    runtime.patchCuratedCardBody(card, {
      description: 'Updated description',
      statusBase: 'Up Next',
      nextEpisodeLabel: 'S1 E5',
      lastWatchedState: 'dated',
      lastWatchedText: '2026-02-26',
      scopePairs: [
        { label: 'Seasons', value: '2' },
        { label: 'Episodes', value: '24' },
        { label: 'Unwatched left', value: '7' },
      ],
      genreValue: 'Comedy',
      distribution: { 5: 40, 4: 25, 3: 20, 2: 10, 1: 5 },
      votes: 200,
    });

    const statusAfter = findByClassName(card, 'cw-curated-card__status');
    const genresAfter = findByClassName(card, 'cw-curated-card__genres');
    const histogramAfter = findByClassName(card, 'cw-rating-histogram');
    const ratingMetaAfter = findByClassName(card, 'cw-curated-card__rating-meta');
    const descriptionAfter = findByClassName(card, 'cw-curated-card__description');

    expect(statusAfter).toBe(statusBefore);
    expect(genresAfter).toBe(genresBefore);
    expect(histogramAfter).toBe(histogramBefore);
    expect(ratingMetaAfter).toBe(ratingMetaBefore);
    expect(descriptionAfter?.textContent).toBe('Updated description');
    expect(statusAfter?.textContent).toBe('Up Next: S1 E5');
    expect(genresAfter?.textContent).toBe('Genres: Comedy');
    expect(ratingMetaAfter?.textContent).toBe('Ratings: 200');
  });
});
