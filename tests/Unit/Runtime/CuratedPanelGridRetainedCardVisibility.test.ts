import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedPanelGridRetainedCardVisibilityModule = {
  scheduleRetainedCardHide: (card: Element, durationMs: number, onHidden?: (() => void) | null) => void;
  isRetainedCardHiding: (card: Element) => boolean;
};

type FakeElement = {
  className: string;
  style: Record<string, string>;
};

const moduleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridRetainedCardVisibility.ts'),
).href;

let retainedCardVisibilityModule: CuratedPanelGridRetainedCardVisibilityModule | null = null;

function getModule(): CuratedPanelGridRetainedCardVisibilityModule {
  if (!retainedCardVisibilityModule) {
    throw new Error('Retained card visibility module not initialized');
  }
  return retainedCardVisibilityModule;
}

function createFakeCard(): FakeElement {
  return {
    className: 'cw-curated-card',
    style: {},
  };
}

function hasClassToken(card: FakeElement, token: string): boolean {
  return card.className
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(token);
}

describe('CuratedPanelGridRetainedCardVisibility', () => {
  beforeEach(async () => {
    vi.resetModules();
    retainedCardVisibilityModule = (await import(moduleUrl)) as CuratedPanelGridRetainedCardVisibilityModule;
  });

  afterEach(() => {
    vi.useRealTimers();
    retainedCardVisibilityModule = null;
  });

  it('honors each card hide delay even when cards share the same batched duration', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const firstCard = createFakeCard();
    const secondCard = createFakeCard();
    let firstHiddenCount = 0;
    let secondHiddenCount = 0;

    getModule().scheduleRetainedCardHide(firstCard as unknown as Element, 320, () => {
      firstHiddenCount += 1;
    });

    vi.advanceTimersByTime(200);
    vi.setSystemTime(200);

    getModule().scheduleRetainedCardHide(secondCard as unknown as Element, 320, () => {
      secondHiddenCount += 1;
    });

    vi.advanceTimersByTime(119);
    vi.setSystemTime(319);

    expect(firstHiddenCount).toBe(0);
    expect(secondHiddenCount).toBe(0);
    expect(getModule().isRetainedCardHiding(firstCard as unknown as Element)).toBe(true);
    expect(getModule().isRetainedCardHiding(secondCard as unknown as Element)).toBe(true);

    vi.advanceTimersByTime(1);
    vi.setSystemTime(320);

    expect(firstHiddenCount).toBe(1);
    expect(secondHiddenCount).toBe(0);
    expect(firstCard.style.display).toBe('none');
    expect(hasClassToken(firstCard, 'cw-curated-card--parked')).toBe(true);
    expect(getModule().isRetainedCardHiding(secondCard as unknown as Element)).toBe(true);

    vi.advanceTimersByTime(199);
    vi.setSystemTime(519);

    expect(secondHiddenCount).toBe(0);
    expect(getModule().isRetainedCardHiding(secondCard as unknown as Element)).toBe(true);

    vi.advanceTimersByTime(1);
    vi.setSystemTime(520);

    expect(secondHiddenCount).toBe(1);
    expect(secondCard.style.display).toBe('none');
    expect(hasClassToken(secondCard, 'cw-curated-card--parked')).toBe(true);
    expect(getModule().isRetainedCardHiding(secondCard as unknown as Element)).toBe(false);
  });
});
