import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedPanelControlsSyncOwner = {
  syncFilterOptions: (
    audioFilterSelectEl: unknown,
    genreFilterSelectEl: unknown,
    audioOptions: unknown,
    genreOptions: unknown,
    selectedAudioFilter: string,
    selectedGenreFilter: string,
  ) => void;
};

type CuratedPanelControlsSyncModule = {
  CuratedPanelControlsSyncOwner: new (options: {
    state: { curatedError: unknown };
    documentRef: Document;
  }) => CuratedPanelControlsSyncOwner;
};

type FakeOptionElement = {
  value: string;
  textContent: string | null;
  text?: string | null;
};

type FakeSelectElement = {
  value: string;
  textContent: string | null;
  options: FakeOptionElement[];
  appendChild: (child: FakeOptionElement) => void;
};

type FakeDocument = {
  createElement: (tagName: string) => FakeOptionElement;
};

const moduleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelControlsSync.ts'),
).href;

let CuratedPanelControlsSyncOwnerCtor: CuratedPanelControlsSyncModule['CuratedPanelControlsSyncOwner'] | null = null;

function createFakeOptionElement(): FakeOptionElement {
  return {
    value: '',
    textContent: '',
    text: '',
  };
}

function createFakeSelectElement(): FakeSelectElement {
  let textContentValue = '';
  const select: FakeSelectElement = {
    value: '',
    textContent: '',
    options: [],
    appendChild(child: FakeOptionElement) {
      this.options.push(child);
    },
  };

  Object.defineProperty(select, 'textContent', {
    configurable: true,
    enumerable: true,
    get() {
      return textContentValue;
    },
    set(value: string | null) {
      textContentValue = value ?? '';
      select.options = [];
    },
  });

  return select;
}

function createFakeDocument(): FakeDocument {
  return {
    createElement: () => createFakeOptionElement(),
  };
}

function createOwner(): CuratedPanelControlsSyncOwner {
  if (!CuratedPanelControlsSyncOwnerCtor) {
    throw new Error('CuratedPanelControlsSyncOwner ctor not initialized');
  }
  return new CuratedPanelControlsSyncOwnerCtor({
    state: { curatedError: null },
    documentRef: createFakeDocument() as unknown as Document,
  });
}

describe('CuratedPanelControlsSyncOwner', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(moduleUrl)) as CuratedPanelControlsSyncModule;
    CuratedPanelControlsSyncOwnerCtor = module.CuratedPanelControlsSyncOwner;
  });

  it('does not rebuild select options when values and titles are unchanged', () => {
    const owner = createOwner();
    const audioSelect = createFakeSelectElement();
    const genreSelect = createFakeSelectElement();
    let appendCount = 0;
    const appendChild = audioSelect.appendChild.bind(audioSelect);
    audioSelect.appendChild = (child) => {
      appendCount += 1;
      appendChild(child);
    };

    owner.syncFilterOptions(
      audioSelect,
      genreSelect,
      [{ optionValue: 'any', title: 'Any language' }],
      [{ optionValue: 'any', title: 'Any genre' }],
      'any',
      'any',
    );

    appendCount = 0;
    owner.syncFilterOptions(
      audioSelect,
      genreSelect,
      [{ optionValue: 'any', title: 'Any language' }],
      [{ optionValue: 'any', title: 'Any genre' }],
      'any',
      'any',
    );

    expect(appendCount).toBe(0);
    expect(audioSelect.options).toHaveLength(1);
    expect(genreSelect.options).toHaveLength(1);
  });

  it('rebuilds select options when option titles change', () => {
    const owner = createOwner();
    const audioSelect = createFakeSelectElement();
    const genreSelect = createFakeSelectElement();

    owner.syncFilterOptions(
      audioSelect,
      genreSelect,
      [{ optionValue: 'any', title: 'Any language' }],
      [{ optionValue: 'any', title: 'Any genre' }],
      'any',
      'any',
    );

    owner.syncFilterOptions(
      audioSelect,
      genreSelect,
      [{ optionValue: 'any', title: 'All languages' }],
      [{ optionValue: 'any', title: 'Any genre' }],
      'any',
      'any',
    );

    expect(audioSelect.options).toHaveLength(1);
    expect(audioSelect.options[0]?.textContent).toBe('All languages');
  });

  it('preserves selected non-default filter values across syncs', () => {
    const owner = createOwner();
    const audioSelect = createFakeSelectElement();
    const genreSelect = createFakeSelectElement();

    owner.syncFilterOptions(
      audioSelect,
      genreSelect,
      [
        { optionValue: 'any', title: 'Any language' },
        { optionValue: 'en-US', title: 'en-US' },
      ],
      [
        { optionValue: 'any', title: 'Any genre' },
        { optionValue: 'action', title: 'action' },
      ],
      'en-US',
      'action',
    );

    expect(audioSelect.value).toBe('en-US');
    expect(genreSelect.value).toBe('action');
  });
});
