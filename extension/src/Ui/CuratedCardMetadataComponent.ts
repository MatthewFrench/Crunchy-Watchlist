type RuntimeModuleRegistry = Record<string, unknown>;

type RuntimeGlobal = typeof globalThis & {
  __CW_WATCHLIST_CURATOR_MODULES__?: RuntimeModuleRegistry;
};

export type CuratedCardMetadataComponentRefs = {
  body: HTMLElement;
  bodyRefs: CwCuratedCardBodyRefs | null;
};

export type CuratedCardMetadataComponent = {
  root: HTMLElement;
  refs: CuratedCardMetadataComponentRefs;
  patch: (entry: CuratedCardMetadataEntry) => void;
  moveDescriptionInto: (target: HTMLElement) => void;
};

export type CuratedCardMetadataEntry = Record<string, unknown>;

type CuratedCardMetadataDependencies = {
  createCuratedCardBody: (entry: CuratedCardMetadataEntry, actionsRoot: HTMLElement) => HTMLElement;
  getCuratedCardBodyRefs: (body: HTMLElement) => CwCuratedCardBodyRefs | null;
  patchCuratedCardBody: (body: HTMLElement, entry: CuratedCardMetadataEntry) => void;
};

export type CuratedCardMetadataComponentOptions = {
  entry?: CuratedCardMetadataEntry;
  actionsRoot?: HTMLElement;
  createCuratedCardBody?: CuratedCardMetadataDependencies['createCuratedCardBody'];
  getCuratedCardBodyRefs?: CuratedCardMetadataDependencies['getCuratedCardBodyRefs'];
  patchCuratedCardBody?: CuratedCardMetadataDependencies['patchCuratedCardBody'];
};

function requireFunction<T>(name: string, value: T | undefined): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing card metadata component dependency: ${name}`);
  }

  return value;
}

function requireActionsRoot(value: HTMLElement | undefined): HTMLElement {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing card metadata component dependency: actionsRoot');
  }

  return value;
}

function toEntry(value: CuratedCardMetadataEntry | undefined): CuratedCardMetadataEntry {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value;
}

function resolveDependencies(options: CuratedCardMetadataComponentOptions): CuratedCardMetadataDependencies {
  return {
    createCuratedCardBody: requireFunction<CuratedCardMetadataDependencies['createCuratedCardBody']>(
      'createCuratedCardBody',
      options.createCuratedCardBody,
    ),
    getCuratedCardBodyRefs: requireFunction<CuratedCardMetadataDependencies['getCuratedCardBodyRefs']>(
      'getCuratedCardBodyRefs',
      options.getCuratedCardBodyRefs,
    ),
    patchCuratedCardBody: requireFunction<CuratedCardMetadataDependencies['patchCuratedCardBody']>(
      'patchCuratedCardBody',
      options.patchCuratedCardBody,
    ),
  };
}

class CuratedCardMetadataController {
  readonly refs: CuratedCardMetadataComponentRefs;

  constructor(
    private readonly dependencies: CuratedCardMetadataDependencies,
    private readonly actionsRoot: HTMLElement,
    initialEntry: CuratedCardMetadataEntry,
  ) {
    const body = this.dependencies.createCuratedCardBody(initialEntry, this.actionsRoot);
    this.refs = {
      body,
      bodyRefs: this.dependencies.getCuratedCardBodyRefs(body),
    };
  }

  patchEntry(entry: CuratedCardMetadataEntry): void {
    this.dependencies.patchCuratedCardBody(this.refs.body, entry);
    this.refs.bodyRefs = this.dependencies.getCuratedCardBodyRefs(this.refs.body) || this.refs.bodyRefs;
  }

  moveDescriptionInto(target: HTMLElement): void {
    const descriptionElement = this.refs.bodyRefs?.descriptionElement || null;
    if (!descriptionElement) {
      return;
    }

    target.appendChild(descriptionElement);
  }
}

export function createCuratedCardMetadataComponent(
  options: CuratedCardMetadataComponentOptions = {},
): CuratedCardMetadataComponent {
  const dependencies = resolveDependencies(options);
  const actionsRoot = requireActionsRoot(options.actionsRoot);
  const controller = new CuratedCardMetadataController(dependencies, actionsRoot, toEntry(options.entry));

  return {
    root: controller.refs.body,
    refs: controller.refs,
    patch: (entry: CuratedCardMetadataEntry) => {
      controller.patchEntry(entry);
    },
    moveDescriptionInto: (target: HTMLElement) => {
      controller.moveDescriptionInto(target);
    },
  };
}

function registerCardMetadataComponentRuntime(): void {
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

  (uiRegistry as Record<string, unknown>).cardMetadataComponent = {
    createCuratedCardMetadataComponent,
  };
}

registerCardMetadataComponentRuntime();
