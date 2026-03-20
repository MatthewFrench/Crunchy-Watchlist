#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Violation = {
  file: string;
  line: number;
  reason: string;
  snippet: string;
};

type ForbiddenMarkerRule = {
  pattern: RegExp;
  reason: string;
  allowlist?: Set<string>;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const scanRoots = [path.join(repoRoot, 'extension', 'src', 'Runtime'), path.join(repoRoot, 'extension', 'src', 'Ui')];

const forbiddenMarkerRules: ForbiddenMarkerRule[] = [
  {
    pattern: /\bcwAction\b/,
    reason: 'Owned action identity must not be stored in DOM dataset markers',
  },
  {
    pattern: /\bcwCardHref\b|\bcwCardNavigationBound\b/,
    reason: 'Card navigation bookkeeping must be controller-owned, not DOM-owned',
  },
  {
    pattern: /\bcwPrevDisplay\b/,
    reason: 'Previous display state must be runtime-owned, not DOM-owned',
    allowlist: new Set(['extension/src/Runtime/ContentRuntimeBootstrapDomLock.ts']),
  },
  {
    pattern: /\bcwRatingState\b|\bcwLastWatchedState\b|\bcwEmpty\b/,
    reason: 'Owned view state must not be mirrored into DOM dataset markers',
  },
  {
    pattern: /\bcwAbsolutePositionSeeded\b|\bcwCenterIntroStaged\b/,
    reason: 'Transition lifecycle state must not be stored in DOM dataset markers',
  },
  {
    pattern: /data-cw-card-layout|cwCardLayout/,
    reason: 'Host layout projection must use classes, not data attributes',
  },
  {
    pattern: /data-cw-tab|\bcwTab\b/,
    reason: 'Tab projection must not store owned state in DOM dataset markers',
  },
];

function isCommentLine(line: string): boolean {
  return line.trim().startsWith('//');
}

async function collectTsFiles(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return collectTsFiles(fullPath);
      }
      if (!entry.isFile() || !entry.name.endsWith('.ts')) {
        return [];
      }
      return [fullPath];
    }),
  );
  return files.flat();
}

function toRepoRelativePath(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

async function run(): Promise<void> {
  const files = (await Promise.all(scanRoots.map((scanRoot) => collectTsFiles(scanRoot)))).flat().sort();
  const violations: Violation[] = [];

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const relativePath = toRepoRelativePath(file);
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!line || isCommentLine(line)) {
        return;
      }

      forbiddenMarkerRules.forEach((rule) => {
        if (!rule.pattern.test(line)) {
          return;
        }
        if (rule.allowlist?.has(relativePath)) {
          return;
        }
        violations.push({
          file: relativePath,
          line: index + 1,
          reason: rule.reason,
          snippet: line.trim(),
        });
      });
    });
  }

  if (violations.length > 0) {
    console.error('[CW] Owned DOM state marker guard failed.');
    violations.forEach((violation) => {
      console.error(`- ${violation.file}:${violation.line} ${violation.reason}`);
      console.error(`    ${violation.snippet}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log('[CW] Owned DOM state marker guard passed.');
}

await run();
