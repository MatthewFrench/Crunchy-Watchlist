#!/usr/bin/env node

import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type CDPSession, type Page } from '@playwright/test';

type MemoryMetrics = {
  JSHeapUsedSize: number;
  JSHeapTotalSize: number;
  Nodes: number;
  Documents: number;
  LayoutObjects: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cdpUrl = String(process.env.CW_PW_CDP_URL || 'http://127.0.0.1:9222').trim();
const runtimeOutputRelativeDir = String(process.env.EXTENSION_RUNTIME_DIR || '.tmp/extension-runtime-dev').trim();
const runtimeOutputDir = path.resolve(repoRoot, runtimeOutputRelativeDir);
const manifestPath = path.join(runtimeOutputDir, 'manifest.json');

function getErrorMessage(error: unknown): string {
  const maybeError = error as { message?: string };
  return maybeError?.message || String(error);
}

async function buildGeneratedRuntime(): Promise<void> {
  const { execFile } = await import('node:child_process');
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      'tsx',
      [path.join(repoRoot, 'scripts', 'build-extension-runtime.mts'), '--bundle-content-scripts', '--out', runtimeOutputDir],
      {
        cwd: repoRoot,
        env: process.env,
        maxBuffer: 16 * 1024 * 1024,
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });
}

function isWatchlistUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length > 0 && segments[segments.length - 1] === 'watchlist';
  } catch {
    return false;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

async function readRuntimeSources(): Promise<{ cssText: string; jsEntries: string[] }> {
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw) as {
    content_scripts?: Array<{
      css?: unknown;
      js?: unknown;
    }>;
  };
  const contentScript = manifest?.content_scripts?.[0];
  const cssFiles = toStringArray(contentScript?.css);
  const jsFiles = toStringArray(contentScript?.js);

  const cssChunks: string[] = [];
  for (const cssFile of cssFiles) {
    cssChunks.push(`/* ${cssFile} */\n${await fs.readFile(path.join(runtimeOutputDir, cssFile), 'utf8')}`);
  }

  const jsEntries: string[] = [];
  for (const jsFile of jsFiles) {
    const source = await fs.readFile(path.join(runtimeOutputDir, jsFile), 'utf8');
    jsEntries.push(`${source}\n//# sourceURL=cw-memory/${jsFile.replace(/\s+/g, '_')}`);
  }

  return {
    cssText: cssChunks.join('\n\n'),
    jsEntries,
  };
}

async function injectLatest(page: Page): Promise<void> {
  const runtimeSources = await readRuntimeSources();
  await page.evaluate(() => {
    (
      window as Window & {
        __CW_WATCHLIST_CURATOR_DEBUG_FLAGS__?: {
          perf?: boolean;
        };
      }
    ).__CW_WATCHLIST_CURATOR_DEBUG_FLAGS__ = {
      perf: true,
    };
  });

  await page.evaluate((styles) => {
    const styleId = 'cw-live-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = styles;
  }, runtimeSources.cssText);

  for (const source of runtimeSources.jsEntries) {
    await page.evaluate((entrySource) => {
      // biome-ignore lint/security/noGlobalEval: tooling-only live injection.
      eval(entrySource);
    }, source);
  }
}

function toMetricRecord(metrics: Array<{ name: string; value: number }>): Record<string, number> {
  const record: Record<string, number> = {};
  metrics.forEach((metric) => {
    record[metric.name] = Number(metric.value) || 0;
  });
  return record;
}

function pickMemoryMetrics(record: Record<string, number>): MemoryMetrics {
  return {
    JSHeapUsedSize: Number(record.JSHeapUsedSize) || 0,
    JSHeapTotalSize: Number(record.JSHeapTotalSize) || 0,
    Nodes: Number(record.Nodes) || 0,
    Documents: Number(record.Documents) || 0,
    LayoutObjects: Number(record.LayoutObjects) || 0,
  };
}

async function collectGarbage(cdpSession: CDPSession): Promise<void> {
  try {
    await cdpSession.send('HeapProfiler.enable');
    await cdpSession.send('HeapProfiler.collectGarbage');
  } catch {
    // no-op
  }
}

async function captureHeapSnapshot(cdpSession: CDPSession, outputPath: string): Promise<void> {
  await cdpSession.send('HeapProfiler.enable');
  const outputStream = createWriteStream(outputPath, { encoding: 'utf8' });

  await new Promise<void>((resolve, reject) => {
    const handleChunk = ({ chunk }: { chunk: string }) => {
      outputStream.write(chunk);
    };
    const handleProgress = ({
      finished,
      total,
      done,
    }: {
      finished?: boolean;
      total?: number;
      done?: number;
    }) => {
      if (finished) {
        process.stdout.write(`[memory] heap snapshot progress ${done ?? total ?? 0}/${total ?? done ?? 0}\n`);
      }
    };

    cdpSession.on('HeapProfiler.addHeapSnapshotChunk', handleChunk);
    cdpSession.on('HeapProfiler.reportHeapSnapshotProgress', handleProgress);

    cdpSession
      .send('HeapProfiler.takeHeapSnapshot', { reportProgress: true })
      .then(() => {
        cdpSession.off('HeapProfiler.addHeapSnapshotChunk', handleChunk);
        cdpSession.off('HeapProfiler.reportHeapSnapshotProgress', handleProgress);
        outputStream.end(() => resolve());
      })
      .catch((error) => {
        cdpSession.off('HeapProfiler.addHeapSnapshotChunk', handleChunk);
        cdpSession.off('HeapProfiler.reportHeapSnapshotProgress', handleProgress);
        outputStream.end(() => reject(error));
      });
  });
}

async function main(): Promise<void> {
  console.log(`[memory] Building generated runtime at ${runtimeOutputDir}...`);
  await buildGeneratedRuntime();
  console.log('[memory] Build complete.');

  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error(`No browser context available over CDP at ${cdpUrl}.`);
  }

  const page =
    context.pages().find((candidate) => isWatchlistUrl(candidate.url())) ||
    context.pages().find((candidate) => candidate.url().includes('crunchyroll.com')) ||
    context.pages()[0];
  if (!page) {
    throw new Error('No Crunchyroll page available in attached browser session.');
  }

  await page.bringToFront();
  if (!isWatchlistUrl(page.url())) {
    await page.goto('https://www.crunchyroll.com/watchlist', {
      waitUntil: 'domcontentloaded',
    });
  } else {
    await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
  }

  await injectLatest(page);
  await page.waitForTimeout(3_200);
  await page.waitForSelector('#cw-sort-mode', { timeout: 20_000 });

  const cdpSession = await context.newCDPSession(page);
  await cdpSession.send('Performance.enable');
  await collectGarbage(cdpSession);

  const beforeRecord = toMetricRecord(
    (await cdpSession.send('Performance.getMetrics')).metrics as Array<{ name: string; value: number }>,
  );
  const before = pickMemoryMetrics(beforeRecord);
  console.log(`[memory] before=${JSON.stringify(before)}`);

  const outputDir = path.join(repoRoot, '.tmp', 'memory-snapshots');
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `edge-watchlist-${timestamp}.heapsnapshot`);

  console.log(`[memory] capturing heap snapshot to ${outputPath}`);
  await captureHeapSnapshot(cdpSession, outputPath);
  await collectGarbage(cdpSession);

  const afterRecord = toMetricRecord(
    (await cdpSession.send('Performance.getMetrics')).metrics as Array<{ name: string; value: number }>,
  );
  const after = pickMemoryMetrics(afterRecord);
  console.log(`[memory] after=${JSON.stringify(after)}`);
  console.log(
    `[memory] delta=${JSON.stringify({
      JSHeapUsedSize: after.JSHeapUsedSize - before.JSHeapUsedSize,
      JSHeapTotalSize: after.JSHeapTotalSize - before.JSHeapTotalSize,
      Nodes: after.Nodes - before.Nodes,
      Documents: after.Documents - before.Documents,
      LayoutObjects: after.LayoutObjects - before.LayoutObjects,
    })}`,
  );

  await cdpSession.send('Performance.disable');
  await browser.close();
}

main().catch((error) => {
  process.stderr.write(`${getErrorMessage(error)}\n`);
  process.exitCode = 1;
});
