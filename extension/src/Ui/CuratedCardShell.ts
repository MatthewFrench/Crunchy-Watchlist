(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type CuratedEntry = {
    seriesId?: unknown;
    fixtureTitle?: unknown;
    title?: unknown;
    href?: unknown;
    episodeHref?: unknown;
    rating?: unknown;
    votes?: unknown;
    dimNotWatchReady?: unknown;
    portraitImageUrl?: unknown;
    landscapeImageUrl?: unknown;
    imageUrl?: unknown;
    hoverPreviewImageUrl?: unknown;
  } & Record<string, unknown>;

  type CuratedActionsElement = CwCuratedActionsElement;

  type CardBodyRefs = CwCuratedCardBodyRefs;

  type CuratedCardThumbProgressRefs = {
    progress: HTMLElement;
    fill: HTMLElement;
  };

  type CuratedCardThumb = {
    thumbLink: HTMLAnchorElement;
    coverImageUrl: string;
    hoverPreviewImageUrl: string;
    thumbImage: HTMLImageElement | null;
    placeholder: HTMLElement | null;
    progressRefs: CuratedCardThumbProgressRefs | null;
    progressBar: HTMLElement | null;
  };

  type CuratedCardHeaderRefs = {
    header: HTMLElement;
    titleLink: HTMLAnchorElement;
    ratingBadge: HTMLElement;
  };

  type CuratedCardShellRefs = CwCuratedCardShellRefs;

  type CardShellContext = {
    documentRef: Document;
    windowRef: Window & typeof globalThis;
    getCardLayout: () => unknown;
    normalizeImageUrlCandidate: (value: unknown) => string;
    resolveApiHref: (href: unknown) => string;
    makeRatingBadge: (rating: unknown, votes: unknown) => HTMLElement;
    createCuratedCardActions: (entry: CuratedEntry) => HTMLElement;
    createCuratedCardBody: (entry: CuratedEntry, actions: HTMLElement) => HTMLElement;
    getCuratedCardBodyRefs: (value: unknown) => CardBodyRefs | null;
    patchCuratedCardBody: (card: Element, entry: CuratedEntry) => void;
    installCuratedCardPreview: (
      thumbLink: HTMLAnchorElement,
      entry: CuratedEntry,
      coverImageUrl: string,
      hoverPreviewImageUrl: string,
      thumbImage: HTMLImageElement | null,
    ) => void;
  };

  type CardShellDeps = {
    documentRef?: unknown;
    windowRef?: unknown;
    getCardLayout?: unknown;
    normalizeImageUrlCandidate?: unknown;
    resolveApiHref?: unknown;
    makeRatingBadge?: unknown;
    createCuratedCardActions?: unknown;
    createCuratedCardBody?: unknown;
    getCuratedCardBodyRefs?: unknown;
    patchCuratedCardBody?: unknown;
    installCuratedCardPreview?: unknown;
  };

  type MinimalEventTarget = {
    closest?: (selector: string) => Element | null;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;
  const cardShellRefsByElement = new WeakMap<Element, CuratedCardShellRefs>();

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing card shell dependency: ${name}`);
    }
    return value as T;
  }

  function requireDocumentRef(value: unknown): Document {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing card shell dependency: documentRef');
    }
    const candidate = value as { createElement?: unknown };
    if (typeof candidate.createElement !== 'function') {
      throw new Error('[CW] Missing card shell dependency: documentRef.createElement');
    }
    return value as Document;
  }

  function requireWindowRef(value: unknown): Window & typeof globalThis {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing card shell dependency: windowRef');
    }
    const candidate = value as { location?: { assign?: unknown } };
    if (!candidate.location || typeof candidate.location.assign !== 'function') {
      throw new Error('[CW] Missing card shell dependency: windowRef.location.assign');
    }
    return value as Window & typeof globalThis;
  }

  function toEntry(value: unknown): CuratedEntry {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return value as CuratedEntry;
  }

  function getEntryString(entry: CuratedEntry, key: keyof CuratedEntry): string {
    const value = entry[key];
    if (typeof value === 'string') {
      return value;
    }
    if (value == null) {
      return '';
    }
    return String(value);
  }

  function normalizeCardLayout(value: unknown): 'portrait' | 'landscape' {
    return value === 'landscape' ? 'landscape' : 'portrait';
  }

  function sanitizeEpisodeProgressRatio(value: unknown): number | null {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0 || normalized >= 1) {
      return null;
    }
    return normalized;
  }

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

  function setElementTextContent(element: unknown, nextValue: string): void {
    const target = element as Element & { textContent?: string | null };
    if (!target) {
      return;
    }
    if (target.textContent === nextValue) {
      return;
    }
    target.textContent = nextValue;
  }

  function setElementAttributeIfChanged(element: unknown, attributeName: string, nextValue: string): void {
    const target = element as Element & {
      getAttribute?: (name: string) => string | null;
      setAttribute?: (name: string, value: string) => void;
    };
    if (!target || typeof target.setAttribute !== 'function') {
      return;
    }

    const currentValue = typeof target.getAttribute === 'function' ? target.getAttribute(attributeName) || '' : '';
    if (currentValue === nextValue) {
      return;
    }
    target.setAttribute(attributeName, nextValue);
  }

  function setElementDatasetValue(element: unknown, datasetKey: string, nextValue: string): void {
    const target = element as Element & {
      dataset?: Record<string, string>;
      setAttribute?: (name: string, value: string) => void;
    };
    if (!target || typeof target !== 'object') {
      return;
    }

    if (target.dataset && typeof target.dataset === 'object') {
      if (target.dataset[datasetKey] !== nextValue) {
        target.dataset[datasetKey] = nextValue;
      }
      return;
    }

    if (typeof target.setAttribute === 'function') {
      const dashedKey = datasetKey.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
      target.setAttribute(`data-${dashedKey}`, nextValue);
    }
  }

  function removeElementDatasetValue(element: unknown, datasetKey: string): void {
    const target = element as Element & {
      dataset?: Record<string, string>;
      removeAttribute?: (name: string) => void;
    };
    if (!target || typeof target !== 'object') {
      return;
    }

    if (target.dataset && typeof target.dataset === 'object' && Object.hasOwn(target.dataset, datasetKey)) {
      delete target.dataset[datasetKey];
      return;
    }

    if (typeof target.removeAttribute === 'function') {
      const dashedKey = datasetKey.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
      target.removeAttribute(`data-${dashedKey}`);
    }
  }

  function resolveCardThumbHref(context: CardShellContext, entry: CuratedEntry): string {
    const directEpisodeHref = context.resolveApiHref(getEntryString(entry, 'episodeHref') || '');
    if (directEpisodeHref) {
      return directEpisodeHref;
    }

    const cardHref = context.resolveApiHref(getEntryString(entry, 'href') || '');
    return cardHref || '#';
  }

  function createCardShellContext(deps: CardShellDeps = {}): CardShellContext {
    return {
      documentRef: requireDocumentRef(deps.documentRef),
      windowRef: requireWindowRef(deps.windowRef),
      getCardLayout: requireFunction('getCardLayout', deps.getCardLayout),
      normalizeImageUrlCandidate: requireFunction(
        'normalizeImageUrlCandidate',
        deps.normalizeImageUrlCandidate,
      ) as CardShellContext['normalizeImageUrlCandidate'],
      resolveApiHref: requireFunction('resolveApiHref', deps.resolveApiHref) as CardShellContext['resolveApiHref'],
      makeRatingBadge: requireFunction('makeRatingBadge', deps.makeRatingBadge) as CardShellContext['makeRatingBadge'],
      createCuratedCardActions: requireFunction(
        'createCuratedCardActions',
        deps.createCuratedCardActions,
      ) as CardShellContext['createCuratedCardActions'],
      createCuratedCardBody: requireFunction(
        'createCuratedCardBody',
        deps.createCuratedCardBody,
      ) as CardShellContext['createCuratedCardBody'],
      getCuratedCardBodyRefs: requireFunction(
        'getCuratedCardBodyRefs',
        deps.getCuratedCardBodyRefs,
      ) as CardShellContext['getCuratedCardBodyRefs'],
      patchCuratedCardBody: requireFunction(
        'patchCuratedCardBody',
        deps.patchCuratedCardBody,
      ) as CardShellContext['patchCuratedCardBody'],
      installCuratedCardPreview: requireFunction(
        'installCuratedCardPreview',
        deps.installCuratedCardPreview,
      ) as CardShellContext['installCuratedCardPreview'],
    };
  }

  function getCardCoverImageInternal(
    context: CardShellContext,
    entry: CuratedEntry,
    layout = normalizeCardLayout(context.getCardLayout()),
  ): string {
    const portrait = context.normalizeImageUrlCandidate(entry.portraitImageUrl);
    const landscape = context.normalizeImageUrlCandidate(entry.landscapeImageUrl);
    const fallback = context.normalizeImageUrlCandidate(entry.imageUrl);

    if (layout === 'landscape') {
      return landscape || portrait || fallback;
    }

    return portrait || landscape || fallback;
  }

  function attachCuratedCardNavigationInternal(context: CardShellContext, item: HTMLElement, cardHref: string): void {
    if (!cardHref) {
      return;
    }

    item.classList.add('cw-curated-card--clickable');
    item.dataset.cwCardHref = cardHref;
    if (item.dataset.cwCardNavigationBound === 'true') {
      return;
    }
    item.dataset.cwCardNavigationBound = 'true';
    item.addEventListener('click', (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as MinimalEventTarget | null;
      if (!target || typeof target.closest !== 'function') {
        return;
      }
      if (target?.closest?.("a, button, input, select, textarea, label, [role='button']")) {
        return;
      }

      const selection = context.windowRef.getSelection?.();
      if (selection?.type === 'Range') {
        return;
      }

      const nextHref = item.dataset.cwCardHref || cardHref;
      if (!nextHref) {
        return;
      }
      context.windowRef.location.assign(nextHref);
    });
  }

  function createCuratedCardHeaderInternal(context: CardShellContext, entry: CuratedEntry): CuratedCardHeaderRefs {
    const title = getEntryString(entry, 'title');
    const titleLink = context.documentRef.createElement('a');
    titleLink.className = 'cw-curated-card__title';
    titleLink.href = getEntryString(entry, 'href') || '#';
    titleLink.textContent = title;

    const ratingBadge = context.makeRatingBadge(entry.rating, entry.votes);
    ratingBadge.classList.add('cw-rating-badge--headline');

    const header = context.documentRef.createElement('div');
    header.className = 'cw-curated-card__header';
    header.appendChild(titleLink);
    header.appendChild(ratingBadge);

    return {
      header,
      titleLink,
      ratingBadge,
    };
  }

  function createCuratedCardThumbImageInternal(
    context: CardShellContext,
    thumbLink: HTMLAnchorElement,
    coverImageUrl: string,
  ): HTMLImageElement {
    const loadingIndicator = context.documentRef.createElement('span');
    loadingIndicator.className = 'cw-curated-card__thumb-loading';
    thumbLink.appendChild(loadingIndicator);

    const image = context.documentRef.createElement('img');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = coverImageUrl;
    image.alt = '';

    // Keep thumbnail dimensions stable and show a spinner until decoding finishes.
    setClassToken(thumbLink, 'cw-curated-card__thumb--loading', true);
    const markThumbImageReady = () => {
      setClassToken(thumbLink, 'cw-curated-card__thumb--loading', false);
      setClassToken(thumbLink, 'cw-curated-card__thumb--failed', false);
      setClassToken(thumbLink, 'cw-curated-card__thumb--loaded', true);
    };
    const markThumbImageFailed = () => {
      setClassToken(thumbLink, 'cw-curated-card__thumb--loading', false);
      setClassToken(thumbLink, 'cw-curated-card__thumb--loaded', false);
      setClassToken(thumbLink, 'cw-curated-card__thumb--failed', true);
    };

    image.addEventListener('load', markThumbImageReady);
    image.addEventListener('error', markThumbImageFailed);
    thumbLink.appendChild(image);

    if (image.complete) {
      if (image.naturalWidth > 0 || image.naturalHeight > 0) {
        markThumbImageReady();
      } else {
        markThumbImageFailed();
      }
    }

    return image;
  }

  function createCuratedCardThumbProgressBarInternal(
    context: CardShellContext,
    episodeWatchProgressRatio: number | null,
  ): CuratedCardThumbProgressRefs | null {
    if (episodeWatchProgressRatio == null) {
      return null;
    }

    const progressTrack = context.documentRef.createElement('div');
    progressTrack.className = 'cw-curated-card__thumb-progress';
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute('aria-valuemax', '100');
    progressTrack.setAttribute('aria-valuenow', String(Math.round(episodeWatchProgressRatio * 100)));
    progressTrack.setAttribute(
      'aria-label',
      `${Math.round(episodeWatchProgressRatio * 100)}% of current episode watched`,
    );

    const progressFill = context.documentRef.createElement('span');
    progressFill.className = 'cw-curated-card__thumb-progress-fill';
    progressFill.style.width = `${Math.max(1, Math.round(episodeWatchProgressRatio * 1000) / 10)}%`;
    progressTrack.appendChild(progressFill);
    return {
      progress: progressTrack,
      fill: progressFill,
    };
  }

  function createCuratedCardThumbInternal(context: CardShellContext, entry: CuratedEntry): CuratedCardThumb {
    const title = getEntryString(entry, 'title');
    const thumbLink = context.documentRef.createElement('a');
    thumbLink.className = 'cw-curated-card__thumb';
    thumbLink.href = resolveCardThumbHref(context, entry);
    thumbLink.setAttribute('aria-label', title);
    thumbLink.dataset.cwSeriesId = getEntryString(entry, 'seriesId');

    const coverImageUrl = getCardCoverImageInternal(context, entry);
    const hoverPreviewImageUrl = context.normalizeImageUrlCandidate(entry.hoverPreviewImageUrl);

    let thumbImage: HTMLImageElement | null = null;
    let placeholder: HTMLElement | null = null;
    if (coverImageUrl) {
      thumbImage = createCuratedCardThumbImageInternal(context, thumbLink, coverImageUrl);
    } else {
      placeholder = context.documentRef.createElement('span');
      placeholder.className = 'cw-curated-card__placeholder';
      placeholder.textContent = 'No Image';
      thumbLink.appendChild(placeholder);
    }

    const episodeWatchProgressRatio = sanitizeEpisodeProgressRatio(entry.episodeWatchProgressRatio);
    const progressRefs = createCuratedCardThumbProgressBarInternal(context, episodeWatchProgressRatio);

    return {
      thumbLink,
      coverImageUrl,
      hoverPreviewImageUrl,
      thumbImage,
      placeholder,
      progressRefs,
      progressBar: progressRefs?.progress || null,
    };
  }

  function moveDescriptionIntoMediaInternal(media: HTMLElement, refs: CuratedCardShellRefs): void {
    const description = refs.bodyRefs?.descriptionElement || null;
    if (!description) {
      return;
    }

    media.appendChild(description);
  }

  function createCuratedCardInternal(context: CardShellContext, inputEntry: unknown): HTMLElement {
    const entry = toEntry(inputEntry);

    const item = context.documentRef.createElement('article');
    item.className = 'cw-curated-card';
    item.dataset.cwSeriesId = getEntryString(entry, 'seriesId');
    item.dataset.cwCuratedTitle = getEntryString(entry, 'fixtureTitle') || getEntryString(entry, 'title');

    if (entry.dimNotWatchReady) {
      item.classList.add('cw-curated-card--not-watch-ready');
    }

    const cardHref = context.resolveApiHref(getEntryString(entry, 'href') || '');
    attachCuratedCardNavigationInternal(context, item, cardHref);

    const headerRefs = createCuratedCardHeaderInternal(context, entry);
    const media = context.documentRef.createElement('div');
    media.className = 'cw-curated-card__media';

    const { thumbLink, coverImageUrl, hoverPreviewImageUrl, thumbImage, placeholder, progressRefs } =
      createCuratedCardThumbInternal(context, entry);
    context.installCuratedCardPreview(thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage);

    const actions = context.createCuratedCardActions(entry) as CuratedActionsElement;
    const body = context.createCuratedCardBody(entry, actions) as HTMLElement;
    const bodyRefs = context.getCuratedCardBodyRefs(body);

    media.appendChild(thumbLink);
    if (progressRefs?.progress) {
      media.appendChild(progressRefs.progress);
    }
    const refs: CuratedCardShellRefs = {
      card: item,
      header: headerRefs.header,
      titleLink: headerRefs.titleLink,
      ratingBadge: headerRefs.ratingBadge,
      media,
      thumbLink,
      thumbImage,
      thumbPlaceholder: placeholder,
      thumbProgress: progressRefs?.progress || null,
      thumbProgressFill: progressRefs?.fill || null,
      body,
      bodyRefs,
      actions,
      actionRefs: getOwnedCardActionRefs(actions),
    };
    cardShellRefsByElement.set(item, refs);

    moveDescriptionIntoMediaInternal(media, refs);
    item.appendChild(headerRefs.header);
    item.appendChild(media);
    item.appendChild(body);

    return item;
  }

  function copyDatasetKeyFromTemplate(targetValue: unknown, templateValue: unknown, datasetKey: string): void {
    const templateDataset = (templateValue as Element & { dataset?: Record<string, string> })?.dataset;
    if (!templateDataset || typeof templateDataset !== 'object') {
      return;
    }
    const templateValueForKey = templateDataset[datasetKey];
    if (typeof templateValueForKey === 'string') {
      setElementDatasetValue(targetValue, datasetKey, templateValueForKey);
      return;
    }
    removeElementDatasetValue(targetValue, datasetKey);
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

  function getCardShellRefsFromCard(cardValue: unknown): CuratedCardShellRefs | null {
    if (!cardValue || typeof cardValue !== 'object') {
      return null;
    }
    return cardShellRefsByElement.get(cardValue as Element) || null;
  }

  function removeElementFromParentNode(element: Element | null): void {
    if (!element) {
      return;
    }
    const parentNode = (element as Element & { parentNode?: Element | null }).parentNode;
    if (parentNode && typeof parentNode.removeChild === 'function') {
      parentNode.removeChild(element);
    }
  }

  function patchRatingBadgeFromEntryInternal(
    context: CardShellContext,
    refs: CuratedCardShellRefs,
    entry: CuratedEntry,
  ): void {
    const nextBadge = context.makeRatingBadge(entry.rating, entry.votes);
    setClassToken(nextBadge, 'cw-rating-badge--headline', true);
    const currentBadge = refs.ratingBadge;
    if (!currentBadge) {
      refs.header.appendChild(nextBadge);
      refs.ratingBadge = nextBadge;
      return;
    }

    currentBadge.className = nextBadge.className || 'cw-rating-badge cw-rating-badge--headline';
    setElementTextContent(currentBadge, nextBadge.textContent || '');

    const nextBadgeTitle = (nextBadge as HTMLElement).title || '';
    if (currentBadge.title !== nextBadgeTitle) {
      currentBadge.title = nextBadgeTitle;
    }
    copyDatasetKeyFromTemplate(currentBadge, nextBadge, 'cwRatingState');
  }

  function ensureThumbPlaceholderInternal(context: CardShellContext, refs: CuratedCardShellRefs): HTMLElement {
    if (refs.thumbPlaceholder) {
      setElementTextContent(refs.thumbPlaceholder, 'No Image');
      return refs.thumbPlaceholder;
    }

    const placeholder = context.documentRef.createElement('span');
    placeholder.className = 'cw-curated-card__placeholder';
    placeholder.textContent = 'No Image';
    refs.thumbLink.appendChild(placeholder);
    refs.thumbPlaceholder = placeholder;
    return placeholder;
  }

  function patchThumbProgressInternal(
    context: CardShellContext,
    refs: CuratedCardShellRefs,
    entry: CuratedEntry,
  ): void {
    const ratio = sanitizeEpisodeProgressRatio(entry.episodeWatchProgressRatio);
    if (ratio == null) {
      removeElementFromParentNode(refs.thumbProgress);
      refs.thumbProgress = null;
      refs.thumbProgressFill = null;
      return;
    }

    let progress = refs.thumbProgress;
    let fill = refs.thumbProgressFill;
    if (!progress || !fill) {
      const nextProgressRefs = createCuratedCardThumbProgressBarInternal(context, ratio);
      if (!nextProgressRefs) {
        return;
      }
      refs.media.appendChild(nextProgressRefs.progress);
      progress = nextProgressRefs.progress;
      fill = nextProgressRefs.fill;
      refs.thumbProgress = progress;
      refs.thumbProgressFill = fill;
    }

    setElementAttributeIfChanged(progress, 'role', 'progressbar');
    setElementAttributeIfChanged(progress, 'aria-valuemin', '0');
    setElementAttributeIfChanged(progress, 'aria-valuemax', '100');
    setElementAttributeIfChanged(progress, 'aria-valuenow', String(Math.round(ratio * 100)));
    setElementAttributeIfChanged(progress, 'aria-label', `${Math.round(ratio * 100)}% of current episode watched`);

    const width = `${Math.max(1, Math.round(ratio * 1000) / 10)}%`;
    if (fill.style.width !== width) {
      fill.style.width = width;
    }
  }

  function patchCardThumbInternal(context: CardShellContext, refs: CuratedCardShellRefs, entry: CuratedEntry): void {
    const thumbLink = refs.thumbLink;
    const title = getEntryString(entry, 'title');
    const thumbHref = resolveCardThumbHref(context, entry);
    if (thumbLink.href !== thumbHref) {
      thumbLink.href = thumbHref;
    }
    setElementAttributeIfChanged(thumbLink, 'aria-label', title);
    setElementDatasetValue(thumbLink, 'cwSeriesId', getEntryString(entry, 'seriesId'));

    const coverImageUrl = getCardCoverImageInternal(context, entry);
    const hoverPreviewImageUrl = context.normalizeImageUrlCandidate(entry.hoverPreviewImageUrl);
    setElementDatasetValue(thumbLink, 'cwCoverImageUrl', coverImageUrl);
    setElementDatasetValue(thumbLink, 'cwHoverPreviewImageUrl', hoverPreviewImageUrl);

    if (coverImageUrl) {
      removeElementFromParentNode(refs.thumbPlaceholder);
      refs.thumbPlaceholder = null;

      if (refs.thumbImage) {
        if (refs.thumbImage.src !== coverImageUrl) {
          refs.thumbImage.src = coverImageUrl;
          setClassToken(thumbLink, 'cw-curated-card__thumb--loading', true);
          setClassToken(thumbLink, 'cw-curated-card__thumb--failed', false);
          setClassToken(thumbLink, 'cw-curated-card__thumb--loaded', false);
        }
      } else {
        refs.thumbImage = createCuratedCardThumbImageInternal(context, thumbLink, coverImageUrl);
      }
    } else {
      removeElementFromParentNode(refs.thumbImage);
      refs.thumbImage = null;
      setClassToken(thumbLink, 'cw-curated-card__thumb--loading', false);
      setClassToken(thumbLink, 'cw-curated-card__thumb--failed', false);
      setClassToken(thumbLink, 'cw-curated-card__thumb--loaded', false);
      ensureThumbPlaceholderInternal(context, refs);
    }

    context.installCuratedCardPreview(thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, refs.thumbImage);
    patchThumbProgressInternal(context, refs, entry);
  }

  function patchCardBodyInternal(context: CardShellContext, bodyElement: Element, entry: CuratedEntry): void {
    context.patchCuratedCardBody(bodyElement, entry);
  }

  function patchActionButtonsInternal(refs: CuratedCardShellRefs, entry: CuratedEntry): void {
    const actionRefs = refs.actionRefs || getOwnedCardActionRefs(refs.actions);
    if (!actionRefs) {
      return;
    }

    refs.actionRefs = actionRefs;
    const isFavorite = Boolean(entry.isFavorite);
    const favoriteButton = actionRefs.favoriteButton;
    setClassToken(favoriteButton, 'is-active', isFavorite);
    setElementAttributeIfChanged(favoriteButton, 'aria-label', isFavorite ? 'Unfavorite' : 'Favorite');
    setElementAttributeIfChanged(favoriteButton, 'aria-pressed', isFavorite ? 'true' : 'false');

    const nextTitle = isFavorite ? 'Unfavorite' : 'Favorite';
    if (favoriteButton.title !== nextTitle) {
      favoriteButton.title = nextTitle;
    }
    setElementTextContent(favoriteButton, isFavorite ? '♥' : '♡');
  }

  function patchCuratedCardInternal(context: CardShellContext, cardValue: unknown, entryValue: unknown): void {
    const card = cardValue && typeof cardValue === 'object' ? (cardValue as Element) : null;
    if (!card) {
      return;
    }
    const refs = getCardShellRefsFromCard(card);
    if (!refs) {
      return;
    }

    const entry = toEntry(entryValue);
    const seriesId = getEntryString(entry, 'seriesId');
    const curatedTitle = getEntryString(entry, 'fixtureTitle') || getEntryString(entry, 'title');
    setElementDatasetValue(card, 'cwSeriesId', seriesId);
    setElementDatasetValue(card, 'cwCuratedTitle', curatedTitle);

    const cardHref = context.resolveApiHref(getEntryString(entry, 'href') || '');
    if (cardHref) {
      setElementDatasetValue(card, 'cwCardHref', cardHref);
    } else {
      removeElementDatasetValue(card, 'cwCardHref');
    }
    setClassToken(card as Element & { className?: string }, 'cw-curated-card--clickable', Boolean(cardHref));
    setClassToken(
      card as Element & { className?: string },
      'cw-curated-card--not-watch-ready',
      Boolean(entry.dimNotWatchReady),
    );

    refs.actionRefs = getOwnedCardActionRefs(refs.actions) || refs.actionRefs;
    refs.bodyRefs = context.getCuratedCardBodyRefs(refs.body) || refs.bodyRefs;

    const title = getEntryString(entry, 'title');
    setElementTextContent(refs.titleLink, title);
    const titleHref = getEntryString(entry, 'href') || '#';
    if (refs.titleLink.href !== titleHref) {
      refs.titleLink.href = titleHref;
    }

    patchRatingBadgeFromEntryInternal(context, refs, entry);
    patchCardThumbInternal(context, refs, entry);
    patchCardBodyInternal(context, refs.body, entry);
    patchActionButtonsInternal(refs, entry);
  }

  function createCardShell(deps: CardShellDeps = {}) {
    const context = createCardShellContext(deps);
    return {
      getCardCoverImage: (entry: unknown, layout: unknown = context.getCardLayout()) =>
        getCardCoverImageInternal(context, toEntry(entry), normalizeCardLayout(layout)),
      attachCuratedCardNavigation: (item: HTMLElement, cardHref: string) =>
        attachCuratedCardNavigationInternal(context, item, cardHref),
      createCuratedCardHeader: (entry: unknown) => createCuratedCardHeaderInternal(context, toEntry(entry)).header,
      createCuratedCardThumb: (entry: unknown) => createCuratedCardThumbInternal(context, toEntry(entry)),
      createCuratedCard: (entry: unknown) => createCuratedCardInternal(context, entry),
      patchCuratedCard: (card: unknown, entry: unknown) => patchCuratedCardInternal(context, card, entry),
    };
  }

  let uiRegistry = moduleRegistry.ui;
  if (!uiRegistry || typeof uiRegistry !== 'object') {
    uiRegistry = {};
    moduleRegistry.ui = uiRegistry;
  }

  (uiRegistry as Record<string, unknown>).cardShell = {
    createCardShell,
  };
})();
