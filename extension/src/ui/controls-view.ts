;(() => {
  type SelectOption = {
    optionValue: string
    title: string
  }

  type SelectFieldResult = {
    field: HTMLElement
  } & Record<string, unknown>

  type CheckboxFieldResult = {
    field: HTMLElement
  } & Record<string, unknown>

  type ControlsSettings = {
    watchReadyFilterMode?: unknown
    cardLayout?: unknown
    audioLocaleFilter?: unknown
    genreFilter?: unknown
    sortMode?: unknown
  }

  type ControlsParts = {
    watchReadyFilterControl: SelectFieldResult
    cardLayoutControl: CheckboxFieldResult
    audioFilterControl: SelectFieldResult
    genreFilterControl: SelectFieldResult
    sortControl: SelectFieldResult
    refreshButton: HTMLButtonElement
    loadingIndicator: HTMLElement
    stats: HTMLSpanElement
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function getString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value : fallback
  }

  function createCheckboxFieldInternal(id: string, label: string, checked: boolean): CheckboxFieldResult {
    const field = document.createElement('label')
    field.className = 'cw-controls__field'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.id = id
    input.checked = checked

    const text = document.createElement('span')
    text.textContent = label

    field.appendChild(input)
    field.appendChild(text)

    return { field, input }
  }

  function createSelectFieldInternal(
    id: string,
    label: string,
    value: unknown,
    options: SelectOption[],
  ): SelectFieldResult {
    const field = document.createElement('label')
    field.className = 'cw-controls__field'

    const text = document.createElement('span')
    text.textContent = label

    const select = document.createElement('select')
    select.id = id

    options.forEach(({ optionValue, title }) => {
      const option = document.createElement('option')
      option.value = optionValue
      option.textContent = title
      option.selected = optionValue === value
      select.appendChild(option)
    })

    field.appendChild(text)
    field.appendChild(select)

    return { field, select }
  }

  function createLoadingIndicatorInternal(text: string): HTMLElement {
    const loading = document.createElement('span')
    loading.className = 'cw-loading'

    const spinner = document.createElement('span')
    spinner.className = 'cw-spinner'
    spinner.setAttribute('aria-hidden', 'true')

    const label = document.createElement('span')
    label.className = 'cw-loading__label'
    label.textContent = text

    loading.appendChild(spinner)
    loading.appendChild(label)
    return loading
  }

  function createWatchReadyFilterControlInternal(settings: ControlsSettings): SelectFieldResult {
    return createSelectFieldInternal(
      'cw-watch-ready-mode',
      'Watch-ready filter:',
      getString(settings.watchReadyFilterMode, 'none'),
      [
        { optionValue: 'none', title: 'None' },
        { optionValue: 'dim', title: 'Dim not watch-ready' },
        { optionValue: 'hide', title: 'Hide not watch-ready' },
      ],
    )
  }

  function createCardLayoutControlInternal(settings: ControlsSettings): CheckboxFieldResult {
    return createCheckboxFieldInternal(
      'cw-landscape-cards',
      'Landscape cards',
      getString(settings.cardLayout, 'portrait') === 'landscape',
    )
  }

  function createAudioFilterControlInternal(settings: ControlsSettings): SelectFieldResult {
    return createSelectFieldInternal('cw-audio-filter', 'Audio:', getString(settings.audioLocaleFilter, 'any'), [
      { optionValue: 'any', title: 'Any language' },
    ])
  }

  function createGenreFilterControlInternal(settings: ControlsSettings): SelectFieldResult {
    return createSelectFieldInternal('cw-genre-filter', 'Genre:', getString(settings.genreFilter, 'any'), [
      { optionValue: 'any', title: 'Any genre' },
    ])
  }

  function createSortControlInternal(settings: ControlsSettings, options: SelectOption[]): SelectFieldResult {
    return createSelectFieldInternal('cw-sort-mode', 'Sort:', getString(settings.sortMode, 'none'), options)
  }

  function appendControlsRowChildren(row: HTMLElement, parts: ControlsParts): void {
    row.appendChild(parts.watchReadyFilterControl.field)
    row.appendChild(parts.cardLayoutControl.field)
    row.appendChild(parts.audioFilterControl.field)
    row.appendChild(parts.genreFilterControl.field)
    row.appendChild(parts.sortControl.field)
    row.appendChild(parts.refreshButton)
    row.appendChild(parts.loadingIndicator)
    row.appendChild(parts.stats)
  }

  function createCuratedInterfaceControlsInternal(settings: unknown, sortModeControlOptions: unknown) {
    const safeSettings = settings && typeof settings === 'object' ? (settings as ControlsSettings) : {}
    const options = Array.isArray(sortModeControlOptions)
      ? sortModeControlOptions.filter((option): option is SelectOption => {
          if (!option || typeof option !== 'object') {
            return false
          }

          const normalizedOption = option as Record<string, unknown>
          return typeof normalizedOption.optionValue === 'string' && typeof normalizedOption.title === 'string'
        })
      : []

    const controls = document.createElement('div')
    controls.className = 'cw-controls'
    const controlsRow = document.createElement('div')
    controlsRow.className = 'cw-controls__row'

    const watchReadyFilterControl = createWatchReadyFilterControlInternal(safeSettings)
    const cardLayoutControl = createCardLayoutControlInternal(safeSettings)
    const audioFilterControl = createAudioFilterControlInternal(safeSettings)
    const genreFilterControl = createGenreFilterControlInternal(safeSettings)
    const sortControl = createSortControlInternal(safeSettings, options)

    ;[watchReadyFilterControl.field, audioFilterControl.field, genreFilterControl.field, sortControl.field].forEach(
      (field) => {
        field.classList.add('cw-controls__field--grow')
      },
    )

    const refreshButton = document.createElement('button')
    refreshButton.type = 'button'
    refreshButton.textContent = 'Refresh ratings'
    refreshButton.className = 'cw-button cw-button--primary cw-controls__refresh'

    const stats = document.createElement('span')
    stats.className = 'cw-controls__stats'
    stats.textContent = ''

    const loadingIndicator = createLoadingIndicatorInternal('Loading')
    loadingIndicator.classList.add('cw-loading-indicator')
    loadingIndicator.style.display = 'none'

    appendControlsRowChildren(controlsRow, {
      watchReadyFilterControl,
      cardLayoutControl,
      audioFilterControl,
      genreFilterControl,
      sortControl,
      refreshButton,
      loadingIndicator,
      stats,
    })

    controls.appendChild(controlsRow)

    return {
      controls,
      watchReadyFilterControl,
      cardLayoutControl,
      audioFilterControl,
      genreFilterControl,
      sortControl,
      refreshButton,
      stats,
      loadingIndicator,
    }
  }

  function createControlsView() {
    return {
      createCuratedInterfaceControls: (settings: unknown, sortModeControlOptions: unknown) =>
        createCuratedInterfaceControlsInternal(settings, sortModeControlOptions),
    }
  }

  let uiRegistry = moduleRegistry.ui
  if (!uiRegistry || typeof uiRegistry !== 'object') {
    uiRegistry = {}
    moduleRegistry.ui = uiRegistry
  }

  ;(uiRegistry as Record<string, unknown>).controlsView = {
    createControlsView,
  }
})()
