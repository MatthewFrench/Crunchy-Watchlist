#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const defaultExtensionDir = path.join(repoRoot, 'extension');
const distDir = path.join(repoRoot, 'dist');
const supportedBrowsers = ['chrome', 'edge', 'firefox'] as const;
const firefoxExtensionId = process.env.FIREFOX_EXTENSION_ID || 'crunchy-watchlist-curator@matthewfrench.dev';

type SupportedBrowser = (typeof supportedBrowsers)[number];

type ExtensionManifest = Record<string, unknown> & {
  action?: Record<string, unknown>;
  icons?: Record<number, string>;
  browser_specific_settings?: {
    gecko?: {
      id?: string;
      data_collection_permissions?: {
        required?: string[];
      };
    };
  };
};

type BuildResult = {
  browser: SupportedBrowser;
  outputDir: string;
  unpackedDir: string;
  artifacts: string[];
};

function parseRequestedBrowser(argv: string[]): SupportedBrowser | null {
  const index = argv.indexOf('--browser');
  if (index === -1) {
    return null;
  }

  const value = argv[index + 1];
  if (!value) {
    throw new Error('Missing value for --browser.');
  }
  if (!supportedBrowsers.includes(value as SupportedBrowser)) {
    throw new Error(`Unsupported browser "${value}". Supported values: ${supportedBrowsers.join(', ')}.`);
  }

  return value as SupportedBrowser;
}

function parseExtensionSourceDir(argv: string[]): string {
  const index = argv.indexOf('--source');
  if (index === -1) {
    return defaultExtensionDir;
  }

  const value = argv[index + 1];
  if (!value) {
    throw new Error('Missing value for --source.');
  }

  return path.resolve(repoRoot, value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function extensionIcons(): Record<number, string> {
  return {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    64: 'icons/icon-64.png',
    96: 'icons/icon-96.png',
    128: 'icons/icon-128.png',
    256: 'icons/icon-256.png',
    1024: 'icons/icon-1024.png',
  };
}

function actionIcons(): Record<number, string> {
  return {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    64: 'icons/icon-64.png',
  };
}

function finalizeManifest(baseManifest: ExtensionManifest, browser: SupportedBrowser): ExtensionManifest {
  const manifest = deepClone(baseManifest);

  manifest.icons = extensionIcons();
  manifest.action = {
    ...(manifest.action || {}),
    default_icon: actionIcons(),
  };

  if (browser === 'firefox') {
    manifest.browser_specific_settings = {
      gecko: {
        id: firefoxExtensionId,
        data_collection_permissions: {
          required: ['websiteActivity', 'websiteContent'],
        },
      },
    };
  } else if (manifest.browser_specific_settings) {
    delete manifest.browser_specific_settings;
  }

  return manifest;
}

async function ensureFileExists(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (_) {
    throw new Error(`Required file is missing: ${filePath}`);
  }
}

async function zipDirectory(sourceDir: string, zipPath: string): Promise<void> {
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  execFileSync('zip', ['-qrX', zipPath, '.'], {
    cwd: sourceDir,
    stdio: 'inherit',
  });
}

async function buildBrowserPackage(
  baseManifest: ExtensionManifest,
  browser: SupportedBrowser,
  extensionDir: string,
): Promise<BuildResult> {
  const outputDir = path.join(distDir, browser);
  const unpackedDir = path.join(outputDir, 'unpacked');
  const zipName = `crunchy-watchlist-curator-${browser}.zip`;
  const zipPath = path.join(outputDir, zipName);

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(unpackedDir, { recursive: true });
  await fs.cp(extensionDir, unpackedDir, { recursive: true });

  const manifest = finalizeManifest(baseManifest, browser);
  await fs.writeFile(path.join(unpackedDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  await zipDirectory(unpackedDir, zipPath);

  const artifacts = [zipPath];
  if (browser === 'firefox') {
    const xpiPath = path.join(outputDir, 'crunchy-watchlist-curator-firefox.xpi');
    await fs.copyFile(zipPath, xpiPath);
    artifacts.push(xpiPath);
  }

  return {
    browser,
    outputDir,
    unpackedDir,
    artifacts,
  };
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const requestedBrowser = parseRequestedBrowser(argv);
  const extensionDir = parseExtensionSourceDir(argv);
  const browsers = requestedBrowser ? [requestedBrowser] : supportedBrowsers;

  await ensureFileExists(path.join(extensionDir, 'manifest.json'));
  const baseManifestRaw = await fs.readFile(path.join(extensionDir, 'manifest.json'), 'utf8');
  const baseManifest = JSON.parse(baseManifestRaw) as ExtensionManifest;

  const iconPaths = Object.values(extensionIcons());
  for (const iconPath of iconPaths) {
    await ensureFileExists(path.join(extensionDir, iconPath));
  }

  const results: BuildResult[] = [];
  for (const browser of browsers) {
    const result = await buildBrowserPackage(baseManifest, browser, extensionDir);
    results.push(result);
  }

  process.stdout.write('Built extension artifacts:\n');
  for (const result of results) {
    process.stdout.write(`- ${result.browser}: ${result.artifacts.join(', ')}\n`);
  }
}

run().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
});
