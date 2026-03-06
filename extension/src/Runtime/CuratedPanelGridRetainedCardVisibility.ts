const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
type RetainedCardHideBatch = {
  timeoutId: number | null;
  entriesByElement: Map<
    Element,
    {
      hiddenAt: number;
      onHidden: (() => void) | null;
    }
  >;
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

export function applyRetainedCardHiddenState(card: Element): void {
  const cardElement = card as Element & {
    className?: string;
    style?: Record<string, string>;
  };
  const style = cardElement.style;
  if (style) {
    if (style.display !== 'none') {
      style.display = 'none';
    }
    if (style.pointerEvents !== 'none') {
      style.pointerEvents = 'none';
    }
  }

  const className = cardElement.className || '';
  cardElement.className = toggleClassNameToken(
    toggleClassNameToken(
      toggleClassNameToken(className, 'cw-curated-card--leaving', false),
      'cw-curated-card--parked',
      true,
    ),
    'cw-curated-card',
    false,
  );
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
      batch.entriesByElement.delete(card);
      if (batch.entriesByElement.size === 0) {
        if (typeof batch.timeoutId === 'number') {
          root.clearTimeout(batch.timeoutId);
        }
        retainedCardHideBatchByDuration.delete(durationMs);
      }
    }
  }
  clearRetainedCardHideState(card);
}

function scheduleRetainedCardHideBatch(durationMs: number, batch: RetainedCardHideBatch): void {
  const now = Date.now();
  const dueEntries = Array.from(batch.entriesByElement.entries()).filter(([_card, entry]) => entry.hiddenAt <= now);

  dueEntries.forEach(([activeCard, entry]) => {
    retainedCardHideDurationByElement.delete(activeCard);
    batch.entriesByElement.delete(activeCard);
    applyRetainedCardHiddenState(activeCard);
    entry.onHidden?.();
  });

  if (batch.entriesByElement.size === 0) {
    batch.timeoutId = null;
    retainedCardHideBatchByDuration.delete(durationMs);
    return;
  }

  const nextHiddenAt = Math.min(...Array.from(batch.entriesByElement.values()).map((entry) => entry.hiddenAt));
  const nextDelayMs = Math.max(0, nextHiddenAt - now);
  batch.timeoutId = root.setTimeout(() => {
    const activeBatch = retainedCardHideBatchByDuration.get(durationMs);
    if (!activeBatch) {
      return;
    }
    scheduleRetainedCardHideBatch(durationMs, activeBatch);
  }, nextDelayMs);
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
      entriesByElement: new Map(),
    };
    retainedCardHideBatchByDuration.set(durationMs, batch);
  }

  batch.entriesByElement.set(card, {
    hiddenAt: Date.now() + durationMs,
    onHidden: onHidden || null,
  });

  if (typeof batch.timeoutId === 'number') {
    root.clearTimeout(batch.timeoutId);
  }
  scheduleRetainedCardHideBatch(durationMs, batch);
}
