#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type BoundaryTypeGrowthBaseline = {
  maxAnyFnReferences: number;
  maxUnknownReferences: number;
  maxFilesWithAnyFnReferences: number;
  maxFilesWithUnknownReferences: number;
  allowedAnyFnFiles: string[];
  allowedUnknownFiles: string[];
};

type FileReferenceCount = {
  path: string;
  count: number;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const baselinePath = path.join(repoRoot, 'docs', 'boundary-type-growth-baseline.json');
const scanRoot = path.join(repoRoot, 'extension', 'src');
const anyFnPattern = /\bAnyFn\b/g;
const unknownPattern = /\bunknown\b/g;

function normalizePath(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function isSourceFile(filePath: string): boolean {
  return filePath.endsWith('.ts') || filePath.endsWith('.d.ts') || filePath.endsWith('.js');
}

async function collectFiles(targetPath: string): Promise<string[]> {
  const stats = await fs.stat(targetPath);
  if (stats.isFile()) {
    return isSourceFile(targetPath) ? [targetPath] : [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const fullPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(fullPath);
      }
      if (!entry.isFile() || !isSourceFile(fullPath)) {
        return [];
      }
      return [fullPath];
    }),
  );

  return files.flat();
}

async function loadBaseline(): Promise<BoundaryTypeGrowthBaseline> {
  const source = await fs.readFile(baselinePath, 'utf8');
  const parsed = JSON.parse(source) as Partial<BoundaryTypeGrowthBaseline>;
  const allowedAnyFnFiles = Array.isArray(parsed.allowedAnyFnFiles)
    ? parsed.allowedAnyFnFiles.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const allowedUnknownFiles = Array.isArray(parsed.allowedUnknownFiles)
    ? parsed.allowedUnknownFiles.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];

  return {
    maxAnyFnReferences: Number(parsed.maxAnyFnReferences || 0),
    maxUnknownReferences: Number(parsed.maxUnknownReferences || 0),
    maxFilesWithAnyFnReferences: Number(parsed.maxFilesWithAnyFnReferences || 0),
    maxFilesWithUnknownReferences: Number(parsed.maxFilesWithUnknownReferences || 0),
    allowedAnyFnFiles,
    allowedUnknownFiles,
  };
}

async function collectReferenceCounts(pattern: RegExp): Promise<FileReferenceCount[]> {
  const files = (await collectFiles(scanRoot)).sort((left, right) => left.localeCompare(right));

  const counts: FileReferenceCount[] = [];
  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8');
    const matches = source.match(pattern);
    const count = matches?.length ?? 0;
    if (count <= 0) {
      continue;
    }
    counts.push({
      path: normalizePath(filePath),
      count,
    });
  }

  return counts;
}

function appendFileDiffViolations(
  violations: string[],
  currentFiles: string[],
  allowedFiles: string[],
  tokenName: string,
): void {
  const allowedFileSet = new Set(allowedFiles);
  const currentFileSet = new Set(currentFiles);

  const unexpectedFiles = currentFiles
    .filter((filePath) => !allowedFileSet.has(filePath))
    .sort((left, right) => left.localeCompare(right));

  if (unexpectedFiles.length > 0) {
    violations.push(`New files with ${tokenName} usage were introduced:`);
    unexpectedFiles.forEach((filePath) => {
      violations.push(`- ${filePath}`);
    });
  }

  const staleBaselineFiles = allowedFiles
    .filter((filePath) => !currentFileSet.has(filePath))
    .sort((left, right) => left.localeCompare(right));

  if (staleBaselineFiles.length > 0) {
    violations.push(`Baseline contains files that no longer use ${tokenName}:`);
    staleBaselineFiles.forEach((filePath) => {
      violations.push(`- ${filePath}`);
    });
    violations.push('Remove stale entries from docs/boundary-type-growth-baseline.json.');
  }
}

async function run(): Promise<void> {
  const baseline = await loadBaseline();
  const anyFnCounts = await collectReferenceCounts(anyFnPattern);
  const unknownCounts = await collectReferenceCounts(unknownPattern);

  const anyFnTotalReferences = anyFnCounts.reduce((sum, item) => sum + item.count, 0);
  const unknownTotalReferences = unknownCounts.reduce((sum, item) => sum + item.count, 0);

  const violations: string[] = [];

  if (anyFnTotalReferences > baseline.maxAnyFnReferences) {
    violations.push(
      `Total AnyFn references grew: ${anyFnTotalReferences} > ${baseline.maxAnyFnReferences} (max baseline)`,
    );
  }

  if (unknownTotalReferences > baseline.maxUnknownReferences) {
    violations.push(
      `Total unknown references grew: ${unknownTotalReferences} > ${baseline.maxUnknownReferences} (max baseline)`,
    );
  }

  if (anyFnCounts.length > baseline.maxFilesWithAnyFnReferences) {
    violations.push(
      `Files with AnyFn references grew: ${anyFnCounts.length} > ${baseline.maxFilesWithAnyFnReferences} (max baseline)`,
    );
  }

  if (unknownCounts.length > baseline.maxFilesWithUnknownReferences) {
    violations.push(
      `Files with unknown references grew: ${unknownCounts.length} > ${baseline.maxFilesWithUnknownReferences} (max baseline)`,
    );
  }

  appendFileDiffViolations(
    violations,
    anyFnCounts.map((item) => item.path),
    baseline.allowedAnyFnFiles,
    'AnyFn',
  );
  appendFileDiffViolations(
    violations,
    unknownCounts.map((item) => item.path),
    baseline.allowedUnknownFiles,
    'unknown',
  );

  if (violations.length > 0) {
    console.error('[CW] Boundary type growth guard failed.');
    violations.forEach((line) => {
      console.error(line);
    });
    process.exitCode = 1;
    return;
  }

  console.log('[CW] Boundary type growth guard passed.');
  console.log(`[CW] AnyFn references: ${anyFnTotalReferences}/${baseline.maxAnyFnReferences}`);
  console.log(`[CW] unknown references: ${unknownTotalReferences}/${baseline.maxUnknownReferences}`);
  console.log(`[CW] Files with AnyFn: ${anyFnCounts.length}/${baseline.maxFilesWithAnyFnReferences}`);
  console.log(`[CW] Files with unknown: ${unknownCounts.length}/${baseline.maxFilesWithUnknownReferences}`);
}

await run();
