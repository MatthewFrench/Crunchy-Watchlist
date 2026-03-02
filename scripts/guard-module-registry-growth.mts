#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ModuleRegistryGrowthBaseline = {
  maxTotalReferences: number;
  maxFilesWithReferences: number;
  allowedFiles: string[];
};

type FileReferenceCount = {
  path: string;
  count: number;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const baselinePath = path.join(repoRoot, 'docs', 'module-registry-growth-baseline.json');
const scanRoots = [
  path.join(repoRoot, 'extension', 'src'),
  path.join(repoRoot, 'extension', 'Types'),
  path.join(repoRoot, 'extension', 'Content.js'),
];
const registryPattern = /__CW_WATCHLIST_CURATOR_MODULES__/g;

function normalizePath(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function isSourceFile(filePath: string): boolean {
  return filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.d.ts');
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

async function loadBaseline(): Promise<ModuleRegistryGrowthBaseline> {
  const source = await fs.readFile(baselinePath, 'utf8');
  const parsed = JSON.parse(source) as Partial<ModuleRegistryGrowthBaseline>;
  const maxTotalReferences = Number(parsed.maxTotalReferences || 0);
  const maxFilesWithReferences = Number(parsed.maxFilesWithReferences || 0);
  const allowedFiles = Array.isArray(parsed.allowedFiles)
    ? parsed.allowedFiles.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];

  return {
    maxTotalReferences,
    maxFilesWithReferences,
    allowedFiles,
  };
}

async function collectReferenceCounts(): Promise<FileReferenceCount[]> {
  const files = (await Promise.all(scanRoots.map(async (scanRoot) => collectFiles(scanRoot)))).flat();
  const sortedFiles = [...new Set(files)].sort((left, right) => left.localeCompare(right));

  const counts: FileReferenceCount[] = [];
  for (const filePath of sortedFiles) {
    const source = await fs.readFile(filePath, 'utf8');
    const matches = source.match(registryPattern);
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

async function run(): Promise<void> {
  const baseline = await loadBaseline();
  const counts = await collectReferenceCounts();
  const totalReferences = counts.reduce((sum, item) => sum + item.count, 0);
  const filesWithReferences = counts.length;
  const allowedFileSet = new Set(baseline.allowedFiles);
  const currentFileSet = new Set(counts.map((item) => item.path));

  const violations: string[] = [];

  if (totalReferences > baseline.maxTotalReferences) {
    violations.push(
      `Total module-registry references grew: ${totalReferences} > ${baseline.maxTotalReferences} (max baseline)`,
    );
  }

  if (filesWithReferences > baseline.maxFilesWithReferences) {
    violations.push(
      `Files with module-registry references grew: ${filesWithReferences} > ${baseline.maxFilesWithReferences} (max baseline)`,
    );
  }

  const unexpectedFiles = counts
    .map((item) => item.path)
    .filter((filePath) => !allowedFileSet.has(filePath))
    .sort((left, right) => left.localeCompare(right));

  if (unexpectedFiles.length > 0) {
    violations.push('New files with module-registry usage were introduced:');
    unexpectedFiles.forEach((filePath) => {
      violations.push(`- ${filePath}`);
    });
  }

  const staleBaselineFiles = baseline.allowedFiles
    .filter((filePath) => !currentFileSet.has(filePath))
    .sort((left, right) => left.localeCompare(right));

  if (staleBaselineFiles.length > 0) {
    violations.push('Baseline contains files that no longer use module-registry references:');
    staleBaselineFiles.forEach((filePath) => {
      violations.push(`- ${filePath}`);
    });
    violations.push('Remove stale entries from docs/module-registry-growth-baseline.json.');
  }

  if (violations.length > 0) {
    console.error('[CW] Module registry growth guard failed.');
    violations.forEach((line) => {
      console.error(line);
    });
    process.exitCode = 1;
    return;
  }

  console.log('[CW] Module registry growth guard passed.');
  console.log(`[CW] Total references: ${totalReferences}/${baseline.maxTotalReferences}`);
  console.log(`[CW] Files with references: ${filesWithReferences}/${baseline.maxFilesWithReferences}`);
}

await run();
