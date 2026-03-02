let createControlsViewRuntimeFactory: (() => object) | null = null;

type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type SelectOption = {
  optionValue: string;
  title: string;
};

type SelectFieldResult = {
  field: HTMLElement;
} & BoundaryRecord;

type CheckboxFieldResult = {
  field: HTMLElement;
} & BoundaryRecord;

type ControlsSettings = {
  watchReadyFilterMode?: string | null;
  cardLayout?: string | null;
  audioLocaleFilter?: string | null;
  genreFilter?: string | null;
  sortMode?: string | null;
  secondarySortMode?: string | null;
};

type ControlsParts = {
  watchReadyFilterControl: SelectFieldResult;
  cardLayoutControl: CheckboxFieldResult;
  audioFilterControl: SelectFieldResult;
  genreFilterControl: SelectFieldResult;
  sortControl: SelectFieldResult;
  secondarySortControl: SelectFieldResult;
  refreshButton: HTMLButtonElement;
  topLoadingIndicator: HTMLElement;
  loadingIndicator: HTMLElement;
  stats: HTMLSpanElement;
};

type ControlsViewContext = {
  documentRef: Document;
};

type ControlsViewOptions = {
  documentRef?: BoundaryValue;
};

function getString(value: BoundaryValue, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function resolveDocumentRef(value: BoundaryValue): Document {
  if (value && typeof value === 'object' && typeof (value as Document).createElement === 'function') {
    return value as Document;
  }
  throw new Error('[CW] Missing controls-view dependency: documentRef');
}

function createCheckboxFieldInternal(
  context: ControlsViewContext,
  id: string,
  label: string,
  checked: boolean,
): CheckboxFieldResult {
  const field = context.documentRef.createElement('label');
  field.className = 'cw-controls__field';

  const input = context.documentRef.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;

  const text = context.documentRef.createElement('span');
  text.textContent = label;

  field.appendChild(input);
  field.appendChild(text);

  return { field, input };
}

function createSelectFieldInternal(
  context: ControlsViewContext,
  id: string,
  label: string,
  value: BoundaryValue,
  options: SelectOption[],
): SelectFieldResult {
  const field = context.documentRef.createElement('label');
  field.className = 'cw-controls__field';

  const text = context.documentRef.createElement('span');
  text.textContent = label;

  const select = context.documentRef.createElement('select');
  select.id = id;

  options.forEach(({ optionValue, title }) => {
    const option = context.documentRef.createElement('option');
    option.value = optionValue;
    option.textContent = title;
    option.selected = optionValue === value;
    select.appendChild(option);
  });

  field.appendChild(text);
  field.appendChild(select);

  return { field, select };
}

function createLoadingIndicatorInternal(context: ControlsViewContext, text: string): HTMLElement {
  const loading = context.documentRef.createElement('span');
  loading.className = 'cw-loading';

  const heading = context.documentRef.createElement('span');
  heading.className = 'cw-loading__heading';

  const spinner = context.documentRef.createElement('span');
  spinner.className = 'cw-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const label = context.documentRef.createElement('span');
  label.className = 'cw-loading__label';
  label.textContent = text;

  heading.appendChild(spinner);
  heading.appendChild(label);
  loading.appendChild(heading);
  return loading;
}

function createWatchReadyFilterControlInternal(
  context: ControlsViewContext,
  settings: ControlsSettings,
): SelectFieldResult {
  return createSelectFieldInternal(
    context,
    'cw-watch-ready-mode',
    'Watch-ready filter:',
    getString(settings.watchReadyFilterMode, 'none'),
    [
      { optionValue: 'none', title: 'None' },
      { optionValue: 'dim', title: 'Dim not watch-ready' },
      { optionValue: 'hide', title: 'Hide not watch-ready' },
      { optionValue: 'hide_not_started', title: 'Hide not watch-ready / not started' },
    ],
  );
}

function createCardLayoutControlInternal(
  context: ControlsViewContext,
  settings: ControlsSettings,
): CheckboxFieldResult {
  return createCheckboxFieldInternal(
    context,
    'cw-landscape-cards',
    'Landscape cards',
    getString(settings.cardLayout, 'portrait') === 'landscape',
  );
}

function createAudioFilterControlInternal(context: ControlsViewContext, settings: ControlsSettings): SelectFieldResult {
  return createSelectFieldInternal(context, 'cw-audio-filter', 'Audio:', getString(settings.audioLocaleFilter, 'any'), [
    { optionValue: 'any', title: 'Any language' },
  ]);
}

function createGenreFilterControlInternal(context: ControlsViewContext, settings: ControlsSettings): SelectFieldResult {
  return createSelectFieldInternal(context, 'cw-genre-filter', 'Genre:', getString(settings.genreFilter, 'any'), [
    { optionValue: 'any', title: 'Any genre' },
    { optionValue: '__favorites__', title: 'Favorites' },
  ]);
}

function createSortControlInternal(
  context: ControlsViewContext,
  settings: ControlsSettings,
  options: SelectOption[],
): SelectFieldResult {
  return createSelectFieldInternal(context, 'cw-sort-mode', 'Sort:', getString(settings.sortMode, 'none'), options);
}

function createSecondarySortControlInternal(
  context: ControlsViewContext,
  settings: ControlsSettings,
  options: SelectOption[],
): SelectFieldResult {
  const secondaryOptions: SelectOption[] = [
    { optionValue: 'none', title: 'Disabled (primary sort only)' },
    ...options.filter((option) => option.optionValue !== 'none'),
  ];

  return createSelectFieldInternal(
    context,
    'cw-secondary-sort-mode',
    'Secondary sort:',
    getString(settings.secondarySortMode, 'none'),
    secondaryOptions,
  );
}

function appendControlsRowChildren(row: HTMLElement, parts: ControlsParts): void {
  row.appendChild(parts.watchReadyFilterControl.field);
  row.appendChild(parts.cardLayoutControl.field);
  row.appendChild(parts.audioFilterControl.field);
  row.appendChild(parts.genreFilterControl.field);
  row.appendChild(parts.sortControl.field);
  row.appendChild(parts.secondarySortControl.field);
  row.appendChild(parts.refreshButton);
  row.appendChild(parts.stats);
  row.appendChild(parts.topLoadingIndicator);
}

function createCuratedInterfaceControlsInternal(
  context: ControlsViewContext,
  settings: ControlsSettings | null | undefined,
  sortModeControlOptions: SelectOption[] | null | undefined,
) {
  const safeSettings = settings ?? {};
  const options = Array.isArray(sortModeControlOptions)
    ? sortModeControlOptions.filter((option): option is SelectOption => {
        if (!option || typeof option !== 'object') {
          return false;
        }

        const normalizedOption = option as BoundaryRecord;
        return typeof normalizedOption.optionValue === 'string' && typeof normalizedOption.title === 'string';
      })
    : [];

  const controls = context.documentRef.createElement('div');
  controls.className = 'cw-controls';
  const controlsRow = context.documentRef.createElement('div');
  controlsRow.className = 'cw-controls__row';

  const watchReadyFilterControl = createWatchReadyFilterControlInternal(context, safeSettings);
  const cardLayoutControl = createCardLayoutControlInternal(context, safeSettings);
  const audioFilterControl = createAudioFilterControlInternal(context, safeSettings);
  const genreFilterControl = createGenreFilterControlInternal(context, safeSettings);
  const sortControl = createSortControlInternal(context, safeSettings, options);
  const secondarySortControl = createSecondarySortControlInternal(context, safeSettings, options);

  [
    watchReadyFilterControl.field,
    audioFilterControl.field,
    genreFilterControl.field,
    sortControl.field,
    secondarySortControl.field,
  ].forEach((field) => {
    field.classList.add('cw-controls__field--grow');
  });

  const refreshButton = context.documentRef.createElement('button');
  refreshButton.type = 'button';
  refreshButton.textContent = 'Refresh ratings';
  refreshButton.className = 'cw-button cw-button--primary cw-controls__refresh';

  const stats = context.documentRef.createElement('span');
  stats.className = 'cw-controls__stats';
  stats.textContent = '';

  const loadingIndicator = createLoadingIndicatorInternal(context, 'Loading');
  loadingIndicator.classList.add('cw-loading-indicator');
  loadingIndicator.style.display = 'none';
  const topLoadingIndicator = createLoadingIndicatorInternal(context, 'Loading');
  topLoadingIndicator.classList.add('cw-controls-loading-indicator');
  topLoadingIndicator.style.display = 'none';

  appendControlsRowChildren(controlsRow, {
    watchReadyFilterControl,
    cardLayoutControl,
    audioFilterControl,
    genreFilterControl,
    sortControl,
    secondarySortControl,
    refreshButton,
    topLoadingIndicator,
    loadingIndicator,
    stats,
  });

  controls.appendChild(controlsRow);

  return {
    controls,
    watchReadyFilterControl,
    cardLayoutControl,
    audioFilterControl,
    genreFilterControl,
    sortControl,
    secondarySortControl,
    refreshButton,
    stats,
    topLoadingIndicator,
    loadingIndicator,
  };
}

class ControlsViewOwner {
  private readonly context: ControlsViewContext;

  constructor(options: ControlsViewOptions = {}) {
    this.context = {
      documentRef: resolveDocumentRef(options.documentRef),
    };
  }

  readonly createCuratedInterfaceControls = (
    settings: ControlsSettings | null | undefined,
    sortModeControlOptions: SelectOption[] | null | undefined,
  ) => {
    return createCuratedInterfaceControlsInternal(this.context, settings, sortModeControlOptions);
  };
}

function createControlsView(options: ControlsViewOptions = {}) {
  return new ControlsViewOwner(options);
}

const controlsViewRuntime = {
  createControlsView,
};
createControlsViewRuntimeFactory = () => controlsViewRuntime;

export function createControlsViewRuntime(): object {
  if (typeof createControlsViewRuntimeFactory !== 'function') {
    throw new Error('[CW] Controls view runtime factory was not initialized.');
  }
  return createControlsViewRuntimeFactory();
}
