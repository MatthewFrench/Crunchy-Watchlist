const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
type RetainedCardHideBatch = {
  timeoutId: number | null;
  onHiddenByElement: Map<Element, (() => void) | null>;
};

const retainedCardHideDurationByElement = new Map<Element, number>();
const retainedCardHideBatchByDuration = new Map<number, RetainedCardHideBatch>();

function toggleClassNameToken(className: string, token: string, enabled: boolean): string {
  const classTokens = className
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);
  const hasToken = classTokens.includes(token);
  if (enabled && !hasToken) {
    classTokens.push(token);
  }
  if (!enabled && hasToken) {
    return classTokens.filter((item) => item !== token).join(' ');
  }
  return classTokens.join(' ');
}

function hasClassNameToken(className: string, token: string): boolean {
  return className
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(token);
}

function setCardClassToken(card: Element, token: string, enabled: boolean): void {
  const cardElement = card as Element & { className?: string };
  cardElement.className = toggleClassNameToken(cardElement.className || '', token, enabled);
}

function clearRetainedCardHideState(card: Element): void {
  setCardClassToken(card, 'cw-curated-card--leaving', false);
}

export function isRetainedCardHiding(value: Element): boolean {
  return retainedCardHideDurationByElement.has(value);
}

export function isParkedCardElement(value: Element): boolean {
  const className = (value as Element & { className?: string }).className || '';
  return hasClassNameToken(className, 'cw-curated-card--parked');
}

export function cancelRetainedCardHideIfNeeded(card: Element): void {
  const durationMs = retainedCardHideDurationByElement.get(card);
  if (typeof durationMs === 'number') {
    retainedCardHideDurationByElement.delete(card);
    const batch = retainedCardHideBatchByDuration.get(durationMs);
    if (batch) {
      batch.onHiddenByElement.delete(card);
      if (batch.onHiddenByElement.size === 0) {
        if (typeof batch.timeoutId === 'number') {
          root.clearTimeout(batch.timeoutId);
        }
        retainedCardHideBatchByDuration.delete(durationMs);
      }
    }
  }
  clearRetainedCardHideState(card);
}

export function scheduleRetainedCardHide(card: Element, durationMs: number, onHidden?: (() => void) | null): void {
  if (retainedCardHideDurationByElement.has(card)) {
    return;
  }

  setCardClassToken(card, 'cw-curated-card--parked', false);
  setCardClassToken(card, 'cw-curated-card--leaving', true);
  retainedCardHideDurationByElement.set(card, durationMs);

  let batch = retainedCardHideBatchByDuration.get(durationMs);
  if (!batch) {
    batch = {
      timeoutId: null,
      onHiddenByElement: new Map<Element, (() => void) | null>(),
    };
    retainedCardHideBatchByDuration.set(durationMs, batch);
  }

  batch.onHiddenByElement.set(card, onHidden || null);
  if (typeof batch.timeoutId === 'number') {
    return;
  }

  batch.timeoutId = root.setTimeout(() => {
    const activeBatch = retainedCardHideBatchByDuration.get(durationMs);
    if (!activeBatch) {
      return;
    }
    retainedCardHideBatchByDuration.delete(durationMs);
    activeBatch.onHiddenByElement.forEach((callback, activeCard) => {
      retainedCardHideDurationByElement.delete(activeCard);
      setCardClassToken(activeCard, 'cw-curated-card--leaving', false);
      setCardClassToken(activeCard, 'cw-curated-card--parked', true);
      callback?.();
    });
  }, durationMs);
}
