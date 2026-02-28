import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type InterfaceShellHostLifecycleRuntime = {
  setNativeVisibility: (context: Record<string, unknown>, showNative: boolean) => void;
  resetInterfaceShell: (context: Record<string, unknown>, removeHost: boolean) => void;
};

type InterfaceShellHostLifecycleModule = {
  runtimeInterfaceShellHostLifecycle: {
    createInterfaceShellHostLifecycleRuntime: () => InterfaceShellHostLifecycleRuntime;
  };
};

const interfaceShellHostLifecycleModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'InterfaceShellHostLifecycle.ts'),
).href;

class FakeClassList {
  private readonly tokens = new Set<string>();
  private readonly owner: FakeElement;

  constructor(owner: FakeElement) {
    this.owner = owner;
  }

  add(...tokens: string[]): void {
    tokens.forEach((token) => {
      if (!token) {
        return;
      }
      this.tokens.add(token);
    });
    this.owner.className = Array.from(this.tokens).join(' ');
  }

  remove(...tokens: string[]): void {
    tokens.forEach((token) => {
      this.tokens.delete(token);
    });
    this.owner.className = Array.from(this.tokens).join(' ');
  }

  contains(token: string): boolean {
    return this.tokens.has(token);
  }
}

class FakeElement {
  readonly classList: FakeClassList;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  className = '';
  parentNode: FakeElement | null = null;
  isConnected = false;
  removeCallCount = 0;

  constructor(initialClassName = '') {
    this.classList = new FakeClassList(this);
    if (initialClassName) {
      this.classList.add(...initialClassName.split(' ').filter(Boolean));
    }
  }

  setConnected(nextValue: boolean): void {
    this.isConnected = nextValue;
    this.children.forEach((child) => {
      child.setConnected(nextValue);
    });
  }

  appendChild(child: FakeElement): FakeElement {
    child.remove();
    child.parentNode = this;
    this.children.push(child);
    child.setConnected(this.isConnected);
    return child;
  }

  remove(): void {
    this.removeCallCount += 1;
    if (this.parentNode) {
      const index = this.parentNode.children.indexOf(this);
      if (index >= 0) {
        this.parentNode.children.splice(index, 1);
      }
      this.parentNode = null;
    }
    this.setConnected(false);
  }

  contains(candidate: unknown): boolean {
    if (candidate === this) {
      return true;
    }
    return this.children.some((child) => child.contains(candidate));
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector !== '[data-cw-prev-display]') {
      return [];
    }
    const matches: FakeElement[] = [];
    const visit = (node: FakeElement) => {
      if (Object.hasOwn(node.dataset, 'cwPrevDisplay')) {
        matches.push(node);
      }
      node.children.forEach((child) => {
        visit(child);
      });
    };
    visit(this);
    return matches;
  }
}

class FakeWindow {
  readonly dispatchedEvents: string[] = [];

  requestAnimationFrame(callback: () => void): number {
    callback();
    return 1;
  }

  dispatchEvent(event: { type?: string }): boolean {
    this.dispatchedEvents.push(String(event?.type || ''));
    return true;
  }
}

function getHostLifecycleRuntime(): InterfaceShellHostLifecycleRuntime {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as InterfaceShellHostLifecycleModule;
  return registry.runtimeInterfaceShellHostLifecycle.createInterfaceShellHostLifecycleRuntime();
}

function createState(hostEl: FakeElement | null = null) {
  return {
    framedRootEl: null,
    nativeHiddenNodes: [] as FakeElement[],
    hostEl,
    tabCrunchyrollEl: hostEl,
    tabCuratedEl: hostEl,
    curatedPanelEl: hostEl,
    controlsEl: hostEl,
    loadingBoxEl: hostEl,
    loadingIndicatorEl: hostEl,
    audioFilterSelectEl: hostEl,
    genreFilterSelectEl: hostEl,
    statsEl: hostEl,
    gridEl: hostEl,
    curatedGridRenderSignature: 'signature',
  };
}

describe('interface-shell-host-lifecycle runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([interfaceShellHostLifecycleModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
  });

  it('keeps native visibility toggles idempotent without duplicating hidden-node tracking', () => {
    const runtime = getHostLifecycleRuntime();
    const rootElement = new FakeElement();
    rootElement.setConnected(true);

    const hostElement = new FakeElement('cw-host');
    const nativeElement = new FakeElement();
    nativeElement.style.display = 'grid';

    rootElement.appendChild(hostElement);
    rootElement.appendChild(nativeElement);

    const state = createState(hostElement);
    const windowRef = new FakeWindow();
    const context = {
      state,
      windowRef,
      getWatchlistRoot: () => rootElement,
    };

    runtime.setNativeVisibility(context, false);
    runtime.setNativeVisibility(context, false);

    expect(nativeElement.style.display).toBe('none');
    expect(nativeElement.dataset.cwPrevDisplay).toBe('grid');
    expect(state.nativeHiddenNodes).toHaveLength(1);

    runtime.setNativeVisibility(context, true);
    runtime.setNativeVisibility(context, true);

    expect(nativeElement.style.display).toBe('grid');
    expect(Object.hasOwn(nativeElement.dataset, 'cwPrevDisplay')).toBe(false);
    expect(state.nativeHiddenNodes).toEqual([]);
    expect(windowRef.dispatchedEvents).toEqual(['resize', 'scroll', 'resize', 'scroll']);
  });

  it('handles repeated resetInterfaceShell teardown calls without stale references', () => {
    const runtime = getHostLifecycleRuntime();
    const hostElement = new FakeElement('cw-host');
    hostElement.setConnected(true);
    const state = createState(hostElement);
    const context = {
      state,
      windowRef: new FakeWindow(),
      getWatchlistRoot: () => null,
    };

    runtime.resetInterfaceShell(context, true);
    runtime.resetInterfaceShell(context, true);

    expect(state.hostEl).toBeNull();
    expect(state.tabCrunchyrollEl).toBeNull();
    expect(state.tabCuratedEl).toBeNull();
    expect(state.curatedPanelEl).toBeNull();
    expect(state.controlsEl).toBeNull();
    expect(state.loadingIndicatorEl).toBeNull();
    expect(state.audioFilterSelectEl).toBeNull();
    expect(state.genreFilterSelectEl).toBeNull();
    expect(state.statsEl).toBeNull();
    expect(state.gridEl).toBeNull();
    expect(state.curatedGridRenderSignature).toBe('');
    expect(hostElement.removeCallCount).toBe(1);
  });
});
