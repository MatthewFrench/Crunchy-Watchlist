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

type CuratedStatsSummary = {
  totalCount: number;
  visibleCount: number;
  loading: boolean;
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

type ProjectedSelectState = {
  optionSignature: string[];
  selectedValue: string;
};

export class CuratedPanelControlsSyncOwner {
  private readonly state: RuntimeState;
  private readonly documentRef: Document;
  private readonly projectedSelectState = new WeakMap<SelectLike, ProjectedSelectState>();

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
    summary: CuratedStatsSummary,
  ): void => {
    statsEl.textContent = this.resolveCuratedStatsText(summary);
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

    const currentValue = this.resolveCanonicalOptionValue(
      options,
      typeof selectedValue === 'string' ? selectedValue : '',
    );
    const hasCurrentOptionValue = options.some(({ optionValue }) => optionValue === currentValue);
    const next = options.map((option) => `${option.optionValue}\u001f${option.title}`);
    const nextSelectedValue = hasCurrentOptionValue ? currentValue : options[0]?.optionValue || '';
    const projectedState = this.projectedSelectState.get(select);
    const unchanged =
      projectedState != null &&
      projectedState.selectedValue === nextSelectedValue &&
      projectedState.optionSignature.length === next.length &&
      projectedState.optionSignature.every((value, index) => value === next[index]);

    if (!unchanged) {
      select.textContent = '';
      options.forEach(({ optionValue, title }) => {
        const option = this.documentRef.createElement('option') as HTMLOptionElement;
        this.applyOptionProjection(option, optionValue, title, optionValue === nextSelectedValue);
        select.appendChild(option);
      });
    }

    if (select.value !== nextSelectedValue) {
      select.value = nextSelectedValue;
    }
    this.projectedSelectState.set(select, {
      optionSignature: next,
      selectedValue: nextSelectedValue,
    });
  };

  private readonly applyOptionProjection = (
    option: HTMLOptionElement,
    optionValue: string,
    title: string,
    selected: boolean,
  ): void => {
    option.value = optionValue;
    option.textContent = title;
    option.selected = selected;
  };

  private readonly resolveCanonicalOptionValue = (options: SelectOption[], selectedValue: string): string => {
    const trimmedSelectedValue = typeof selectedValue === 'string' ? selectedValue.trim() : '';
    if (!trimmedSelectedValue) {
      return options[0]?.optionValue || '';
    }

    const exactMatch = options.find(({ optionValue }) => optionValue === trimmedSelectedValue);
    if (exactMatch) {
      return exactMatch.optionValue;
    }

    const normalizedSelectedValue = trimmedSelectedValue.toLowerCase();
    const normalizedMatch = options.find(({ optionValue }) => optionValue.toLowerCase() === normalizedSelectedValue);
    if (normalizedMatch) {
      return normalizedMatch.optionValue;
    }

    return trimmedSelectedValue;
  };

  private readonly resolveCuratedStatsText = ({ totalCount, visibleCount, loading }: CuratedStatsSummary): string => {
    const shouldShowFilteredCount = visibleCount !== totalCount;
    if (this.state.curatedError && totalCount === 0) {
      return 'API load failed';
    }
    if (loading && totalCount === 0) {
      return '';
    }
    if (loading && totalCount > 0) {
      const base = shouldShowFilteredCount ? `Showing ${visibleCount} of ${totalCount}` : `${totalCount} shows`;
      return `${base} (refreshing...)`;
    }
    if (this.state.curatedError) {
      return String(this.state.curatedError);
    }
    return shouldShowFilteredCount ? `Showing ${visibleCount} of ${totalCount}` : `${totalCount} shows`;
  };
}
