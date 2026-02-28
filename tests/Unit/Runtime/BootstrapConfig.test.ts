import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type BootstrapConfig = {
  defaultSortMode: string;
  validSortModes: Set<string>;
  sortModeControlOptions: Array<{ optionValue: string; title: string }>;
  runtimeConstants: {
    settingsKey: string;
    ratingCacheKey: string;
    watchHistoryCacheKey: string;
    watchlistCacheKey: string;
    watchHistoryCacheVersion: number;
  };
  defaultSettings: {
    activeTab: string;
    watchReadyFilterMode: string;
    audioLocaleFilter: string;
    genreFilter: string;
    cardLayout: string;
    sortMode: string;
    secondarySortMode: string;
  };
};

type RuntimeBootstrapConfigModule = {
  runtimeBootstrapConfig: {
    createBootstrapConfig: () => BootstrapConfig;
  };
};

const bootstrapConfigModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapConfig.ts'),
).href;

function getBootstrapConfigModule() {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as RuntimeBootstrapConfigModule;
  return registry.runtimeBootstrapConfig;
}

describe('bootstrap-config runtime module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([bootstrapConfigModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
  });

  it('exposes expected default sort and settings values', () => {
    const config = getBootstrapConfigModule().createBootstrapConfig();

    expect(config.defaultSortMode).toBe('consensus_quality_desc');
    expect(config.defaultSettings.sortMode).toBe('consensus_quality_desc');
    expect(config.defaultSettings.secondarySortMode).toBe('none');
    expect(config.defaultSettings.activeTab).toBe('curated');
    expect(config.validSortModes.has('rating_desc')).toBe(true);
    expect(config.validSortModes.has('recent_activity_desc')).toBe(true);
    expect(config.validSortModes.has('star_1_pct_desc')).toBe(true);
    expect(config.sortModeControlOptions.some((option) => option.optionValue === 'recent_activity_desc')).toBe(true);
    expect(config.runtimeConstants.settingsKey).toBe('cw_settings_v1');
    expect(config.runtimeConstants.ratingCacheKey).toBe('cw_rating_cache_v2');
    expect(config.runtimeConstants.watchHistoryCacheVersion).toBe(3);
  });

  it('returns independent option arrays between calls', () => {
    const first = getBootstrapConfigModule().createBootstrapConfig();
    const second = getBootstrapConfigModule().createBootstrapConfig();

    const firstOption = first.sortModeControlOptions[0];
    const secondOption = second.sortModeControlOptions[0];
    expect(firstOption).toBeDefined();
    expect(secondOption).toBeDefined();
    if (!firstOption || !secondOption) {
      throw new Error('Missing sort-mode control options');
    }

    firstOption.title = 'mutated';
    expect(secondOption.title).toBe('Consensus quality (default)');
  });
});
