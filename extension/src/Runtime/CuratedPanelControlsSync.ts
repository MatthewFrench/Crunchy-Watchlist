type CuratedBoundaryValue = CwBoundaryValue;

type RuntimeState = {
  curatedError: CuratedBoundaryValue;
};

type SelectLike = Element & {
  value?: string;
  options?: ArrayLike<{
    value?: string | null;
    textContent?: string | null;
    text?: string | null;
  }>;
  textContent: string | null;
  appendChild: (child: Element) => void;
};

type DisplayableElement = Element & {
  style?: {
    display?: string;
  };
};

type SelectOption = {
  optionValue: string;
  title: string;
};

type CuratedPanelControlsSyncOptions = {
  state: RuntimeState;
  documentRef: Document;
};

function asSelectLike(value: CuratedBoundaryValue): SelectLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const select = value as SelectLike;
  return typeof select.appendChild === 'function' ? select : null;
}

function asSelectOptions(value: CuratedBoundaryValue): SelectOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option): SelectOption | null => {
      if (!option || typeof option !== 'object') {
        return null;
      }
      const optionRecord = option as Record<string, CuratedBoundaryValue>;
      const optionValue = typeof optionRecord.optionValue === 'string' ? optionRecord.optionValue : '';
      const title = typeof optionRecord.title === 'string' ? optionRecord.title : '';
      if (!optionValue || !title) {
        return null;
      }
      return { optionValue, title };
    })
    .filter((option): option is SelectOption => option != null);
}

function getSelectOptionSignature(select: SelectLike): string[] {
  const options = select.options ? Array.from(select.options) : [];
  return options.map((option) => {
    const optionValue = typeof option?.value === 'string' ? option.value : '';
    const optionTitle =
      typeof option?.textContent === 'string'
        ? option.textContent
        : typeof option?.text === 'string'
          ? option.text
          : '';
    return `${optionValue}\u001f${optionTitle}`;
  });
}

export class CuratedPanelControlsSyncOwner {
  private readonly state: RuntimeState;
  private readonly documentRef: Document;

  constructor(options: CuratedPanelControlsSyncOptions) {
    this.state = options.state;
    this.documentRef = options.documentRef;
  }

  readonly syncFilterOptions = (
    audioFilterSelectEl: CuratedBoundaryValue,
    genreFilterSelectEl: CuratedBoundaryValue,
    audioOptions: CuratedBoundaryValue,
    genreOptions: CuratedBoundaryValue,
    selectedAudioFilter: string,
    selectedGenreFilter: string,
  ): void => {
    this.setSelectOptions(audioFilterSelectEl, audioOptions, selectedAudioFilter);
    this.setSelectOptions(genreFilterSelectEl, genreOptions, selectedGenreFilter);
  };

  readonly updateStatsText = (
    statsEl: Element & { textContent: string | null },
    watchReadyFilterMode: string,
    total: number,
    visibleCount: number,
    loading: boolean,
  ): void => {
    statsEl.textContent = this.resolveCuratedStatsText(watchReadyFilterMode, total, visibleCount, loading);
  };

  readonly updateLoadingIndicatorVisibility = (loadingIndicatorEl: CuratedBoundaryValue, loading: boolean): void => {
    if (!loadingIndicatorEl || typeof loadingIndicatorEl !== 'object') {
      return;
    }
    const style = (loadingIndicatorEl as DisplayableElement).style;
    if (!style) {
      return;
    }
    const nextDisplay = loading ? 'inline-flex' : 'none';
    if (style.display === nextDisplay) {
      return;
    }
    style.display = nextDisplay;
  };

  private readonly setSelectOptions = (
    selectValue: CuratedBoundaryValue,
    optionsValue: CuratedBoundaryValue,
    selectedValue: string,
  ): void => {
    const select = asSelectLike(selectValue);
    if (!select) {
      return;
    }

    const options = asSelectOptions(optionsValue);
    if (!options.length) {
      return;
    }

    const currentValue =
      typeof selectedValue === 'string' && selectedValue ? selectedValue : options[0]?.optionValue || '';
    const hasCurrentOptionValue = options.some(({ optionValue }) => optionValue === currentValue);
    const existing = getSelectOptionSignature(select);
    const next = options.map((option) => `${option.optionValue}\u001f${option.title}`);
    const unchanged = existing.length === next.length && existing.every((value, index) => value === next[index]);

    if (!unchanged) {
      select.textContent = '';
      options.forEach(({ optionValue, title }) => {
        const option = this.documentRef.createElement('option') as HTMLOptionElement;
        option.value = optionValue;
        option.textContent = title;
        select.appendChild(option);
      });
    }

    select.value = hasCurrentOptionValue ? currentValue : options[0]?.optionValue || '';
  };

  private readonly resolveCuratedStatsText = (
    watchReadyFilterMode: string,
    total: number,
    visibleCount: number,
    loading: boolean,
  ): string => {
    const shouldShowFilteredCount = watchReadyFilterMode === 'hide' || watchReadyFilterMode === 'hide_not_started';
    if (this.state.curatedError && total === 0) {
      return 'API load failed';
    }
    if (loading && total === 0) {
      return '';
    }
    if (loading && total > 0) {
      const base = shouldShowFilteredCount ? `Showing ${visibleCount} of ${total}` : `${total} shows`;
      return `${base} (refreshing...)`;
    }
    if (this.state.curatedError) {
      return String(this.state.curatedError);
    }
    return shouldShowFilteredCount ? `Showing ${visibleCount} of ${total}` : `${total} shows`;
  };
}
