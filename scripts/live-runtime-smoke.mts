#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ContentScriptAssets = {
  cssFiles: string[];
  jsFiles: string[];
};

type ManifestContentScript = {
  css?: unknown;
  js?: unknown;
};

type ManifestShape = {
  content_scripts?: ManifestContentScript[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const sourceManifestPath = path.join(repoRoot, 'extension', 'manifest.json');
const buildScriptPath = path.join(repoRoot, 'scripts', 'build-extension-runtime.mts');
const keepOutput = /^(1|true|yes)$/i.test(String(process.env.CW_KEEP_LIVE_SMOKE_RUNTIME || '').trim());
const bundleContentScripts = !/^(0|false|no)$/i.test(String(process.env.CW_BUNDLE_CONTENT_SCRIPTS ?? '1').trim());
const ciEnvironment = /^(1|true|yes)$/i.test(String(process.env.CI || '').trim());

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${code ?? 1}): ${command} ${args.join(' ')}`));
    });
  });
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

async function readManifestAssets(manifestPath: string): Promise<ContentScriptAssets> {
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw) as ManifestShape;
  const contentScript = manifest.content_scripts?.[0] || {};

  return {
    cssFiles: toStringArray(contentScript.css),
    jsFiles: toStringArray(contentScript.js),
  };
}

function assertArrayEqual(label: string, left: string[], right: string[]): void {
  if (left.length !== right.length) {
    throw new Error(`Mismatch for ${label}: expected ${left.length} entries, received ${right.length}.`);
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      throw new Error(
        `Mismatch for ${label} at index ${index}: expected "${left[index]}", received "${right[index]}".`,
      );
    }
  }
}

async function assertFilesExist(baseDir: string, relativePaths: string[]): Promise<void> {
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(baseDir, relativePath);
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        throw new Error(`Expected file but found non-file: ${absolutePath}`);
      }
    } catch (error) {
      if ((error as { code?: string })?.code === 'ENOENT') {
        throw new Error(`Missing generated runtime asset: ${absolutePath}`);
      }
      throw error;
    }
  }
}

async function main(): Promise<void> {
  if (ciEnvironment && !bundleContentScripts) {
    throw new Error('CW_BUNDLE_CONTENT_SCRIPTS=0 is forbidden in CI; bundled content scripts are required.');
  }

  const tmpRoot = path.join(repoRoot, '.tmp');
  await fs.mkdir(tmpRoot, { recursive: true });
  const runtimeDir = await fs.mkdtemp(path.join(tmpRoot, 'extension-runtime-live-smoke-'));
  const runtimeManifestPath = path.join(runtimeDir, 'manifest.json');
  const bundleFlag = bundleContentScripts ? '--bundle-content-scripts' : '--no-bundle-content-scripts';

  try {
    process.stdout.write(
      `[live-smoke] Building generated runtime at ${runtimeDir} (${bundleContentScripts ? 'bundled' : 'unbundled'})\n`,
    );
    await runCommand('tsx', [buildScriptPath, bundleFlag, '--out', runtimeDir]);

    const sourceAssets = await readManifestAssets(sourceManifestPath);
    const runtimeAssets = await readManifestAssets(runtimeManifestPath);

    assertArrayEqual('content_scripts[0].css', sourceAssets.cssFiles, runtimeAssets.cssFiles);

    if (bundleContentScripts) {
      if (runtimeAssets.jsFiles.length !== 1) {
        throw new Error(
          `Bundled runtime expected one JS entry for content_scripts[0], received ${runtimeAssets.jsFiles.length}.`,
        );
      }
      const bundledFile = runtimeAssets.jsFiles[0] || '';
      if (!bundledFile.endsWith('.bundle.js')) {
        throw new Error(`Bundled runtime expected a *.bundle.js script, received "${bundledFile}".`);
      }
    } else {
      assertArrayEqual('content_scripts[0].js', sourceAssets.jsFiles, runtimeAssets.jsFiles);
      if (!runtimeAssets.jsFiles.length || runtimeAssets.jsFiles[runtimeAssets.jsFiles.length - 1] !== 'Content.js') {
        throw new Error('Generated runtime content script ordering is invalid: expected Content.js as final JS entry.');
      }
    }

    await assertFilesExist(runtimeDir, [...runtimeAssets.cssFiles, ...runtimeAssets.jsFiles]);

    process.stdout.write(
      `[live-smoke] OK: manifest/assets validated (${runtimeAssets.cssFiles.length} css, ${runtimeAssets.jsFiles.length} js, mode=${bundleContentScripts ? 'bundled' : 'unbundled'}).\n`,
    );
  } finally {
    if (!keepOutput) {
      await fs.rm(runtimeDir, { recursive: true, force: true });
    } else {
      process.stdout.write(
        `[live-smoke] Keeping generated runtime at ${runtimeDir} (CW_KEEP_LIVE_SMOKE_RUNTIME enabled)\n`,
      );
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
});
