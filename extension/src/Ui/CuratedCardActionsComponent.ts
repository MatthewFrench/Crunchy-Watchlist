type RuntimeModuleRegistry = Record<string, unknown>;

type RuntimeGlobal = typeof globalThis & {
  __CW_WATCHLIST_CURATOR_MODULES__?: RuntimeModuleRegistry;
};

export type CuratedCardActionEntry = {
  isFavorite?: boolean | null;
} & Record<string, unknown>;

export type CuratedCardActionsComponentRefs = {
  actions: CwCuratedActionsElement;
  actionRefs: CwCuratedCardActionRefs | null;
};

export type CuratedCardActionsComponent = {
  root: CwCuratedActionsElement;
  refs: CuratedCardActionsComponentRefs;
  patch: (entry: CuratedCardActionEntry) => void;
};

export type CuratedCardActionsComponentOptions = {
  actionsRoot?: CwCuratedActionsElement;
  entry?: CuratedCardActionEntry;
};

function toggleClassToken(className: string, token: string, enabled: boolean): string {
  const tokens = className
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);
  const hasToken = tokens.includes(token);
  if (enabled && !hasToken) {
    tokens.push(token);
  }
  if (!enabled && hasToken) {
    return tokens.filter((item) => item !== token).join(' ');
  }

  return tokens.join(' ');
}

function setClassToken(element: { className?: string }, token: string, enabled: boolean): void {
  element.className = toggleClassToken(element.className || '', token, enabled);
}

function setElementTextContent(element: Element, nextValue: string): void {
  if (element.textContent === nextValue) {
    return;
  }
  element.textContent = nextValue;
}

function setElementAttributeIfChanged(element: Element, attributeName: string, nextValue: string): void {
  if (typeof element.setAttribute !== 'function') {
    return;
  }

  const currentValue = typeof element.getAttribute === 'function' ? element.getAttribute(attributeName) || '' : '';
  if (currentValue === nextValue) {
    return;
  }
  element.setAttribute(attributeName, nextValue);
}

function asCardActionButton(value: unknown, expectedAction: string): HTMLButtonElement | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<HTMLButtonElement> & {
    dataset?: Record<string, unknown>;
  };
  const action = typeof candidate.dataset?.cwAction === 'string' ? candidate.dataset.cwAction : '';
  if (action && action !== expectedAction) {
    return null;
  }
  if (typeof candidate.setAttribute !== 'function') {
    return null;
  }

  return candidate as HTMLButtonElement;
}

function getOwnedCardActionRefs(actions: Element): CwCuratedCardActionRefs | null {
  const children = (actions as Element & { children?: ArrayLike<unknown> }).children;
  if (!children || typeof children.length !== 'number') {
    return null;
  }

  const favoriteButton = asCardActionButton(children[0], 'favorite');
  const removeButton = asCardActionButton(children[1], 'remove');
  if (!favoriteButton || !removeButton) {
    return null;
  }

  return {
    favoriteButton,
    removeButton,
  };
}

function requireActionsRoot(value: CwCuratedActionsElement | undefined): CwCuratedActionsElement {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing card actions component dependency: actionsRoot');
  }

  return value;
}

export function createCuratedCardActionsComponent(
  options: CuratedCardActionsComponentOptions = {},
): CuratedCardActionsComponent {
  const actionsRoot = requireActionsRoot(options.actionsRoot);
  const refs: CuratedCardActionsComponentRefs = {
    actions: actionsRoot,
    actionRefs: getOwnedCardActionRefs(actionsRoot),
  };

  const patch = (entry: CuratedCardActionEntry): void => {
    refs.actionRefs = getOwnedCardActionRefs(refs.actions) || refs.actionRefs;
    if (!refs.actionRefs) {
      return;
    }

    const isFavorite = Boolean(entry.isFavorite);
    const favoriteButton = refs.actionRefs.favoriteButton;
    setClassToken(favoriteButton, 'is-active', isFavorite);
    setElementAttributeIfChanged(favoriteButton, 'aria-label', isFavorite ? 'Unfavorite' : 'Favorite');
    setElementAttributeIfChanged(favoriteButton, 'aria-pressed', isFavorite ? 'true' : 'false');

    const nextTitle = isFavorite ? 'Unfavorite' : 'Favorite';
    if (favoriteButton.title !== nextTitle) {
      favoriteButton.title = nextTitle;
    }
    setElementTextContent(favoriteButton, isFavorite ? '♥' : '♡');
  };

  patch(options.entry || {});

  return {
    root: actionsRoot,
    refs,
    patch,
  };
}

function registerCardActionsComponentRuntime(): void {
  const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeGlobal;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }

  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__;
  let uiRegistry = moduleRegistry.ui;
  if (!uiRegistry || typeof uiRegistry !== 'object') {
    uiRegistry = {};
    moduleRegistry.ui = uiRegistry;
  }

  (uiRegistry as Record<string, unknown>).cardActionsComponent = {
    createCuratedCardActionsComponent,
  };
}

registerCardActionsComponentRuntime();
