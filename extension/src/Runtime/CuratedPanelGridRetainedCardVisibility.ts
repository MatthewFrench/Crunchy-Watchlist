const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
const retainedCardHideTimeoutByElement = new Map<Element, number>();

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
  return retainedCardHideTimeoutByElement.has(value);
}

export function isParkedCardElement(value: Element): boolean {
  const className = (value as Element & { className?: string }).className || '';
  return hasClassNameToken(className, 'cw-curated-card--parked');
}

export function cancelRetainedCardHideIfNeeded(card: Element): void {
  const timeoutId = retainedCardHideTimeoutByElement.get(card);
  if (typeof timeoutId === 'number') {
    root.clearTimeout(timeoutId);
    retainedCardHideTimeoutByElement.delete(card);
  }
  clearRetainedCardHideState(card);
}

export function scheduleRetainedCardHide(card: Element, durationMs: number): void {
  const existingTimeoutId = retainedCardHideTimeoutByElement.get(card);
  if (typeof existingTimeoutId === 'number') {
    return;
  }

  setCardClassToken(card, 'cw-curated-card--parked', false);
  setCardClassToken(card, 'cw-curated-card--leaving', true);
  const timeoutId = root.setTimeout(() => {
    retainedCardHideTimeoutByElement.delete(card);
    setCardClassToken(card, 'cw-curated-card--leaving', false);
    setCardClassToken(card, 'cw-curated-card--parked', true);
  }, durationMs);
  retainedCardHideTimeoutByElement.set(card, timeoutId);
}
