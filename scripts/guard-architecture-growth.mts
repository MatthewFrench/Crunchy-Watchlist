#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyFunctionSpan, collectArchitectureMetrics } from './architecture-metrics.mjs';

type BaselineFunctionWarning = {
  name: string;
  path: string;
};

type ArchitectureGrowthBaseline = {
  allowedWarningFiles: string[];
  allowedWarningFunctions: BaselineFunctionWarning[];
};

type RuntimeFunctionWarning = {
  name: string;
  path: string;
  startLine: number;
  length: number;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const baselinePath = path.join(repoRoot, 'docs', 'architecture-growth-baseline.json');

function toFunctionKey(name: string, filePath: string): string {
  return `${name}|${filePath}`;
}

async function loadBaseline(): Promise<ArchitectureGrowthBaseline> {
  const source = await fs.readFile(baselinePath, 'utf8');
  const parsed = JSON.parse(source) as Partial<ArchitectureGrowthBaseline>;
  const allowedWarningFiles = Array.isArray(parsed.allowedWarningFiles)
    ? parsed.allowedWarningFiles.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const allowedWarningFunctions = Array.isArray(parsed.allowedWarningFunctions)
    ? parsed.allowedWarningFunctions
        .filter((value): value is BaselineFunctionWarning => Boolean(value) && typeof value === 'object')
        .map((value) => ({
          name: typeof value.name === 'string' ? value.name : '',
          path: typeof value.path === 'string' ? value.path : '',
        }))
        .filter((value) => value.name.length > 0 && value.path.length > 0)
    : [];

  return {
    allowedWarningFiles,
    allowedWarningFunctions,
  };
}

function formatFunctionWarning(warning: RuntimeFunctionWarning): string {
  return `${warning.name} (${warning.path}:${warning.startLine}, ${warning.length} lines)`;
}

async function run(): Promise<void> {
  const baseline = await loadBaseline();
  const baselineWarningFiles = new Set(baseline.allowedWarningFiles);
  const baselineWarningFunctionKeys = new Set(
    baseline.allowedWarningFunctions.map((warning) => toFunctionKey(warning.name, warning.path)),
  );

  const metrics = await collectArchitectureMetrics();

  const fileWarnings = metrics.fileRows
    .filter((row) => row.classification === 'warning')
    .sort((left, right) => left.path.localeCompare(right.path));
  const fileRefactors = metrics.fileRows
    .filter((row) => row.classification === 'refactor')
    .sort((left, right) => left.path.localeCompare(right.path));

  const functionWarnings: RuntimeFunctionWarning[] = metrics.runtimeFunctionSpans
    .filter((span) => classifyFunctionSpan(span.length) === 'warning')
    .map((span) => ({
      name: span.name,
      path: span.path,
      startLine: span.startLine,
      length: span.length,
    }))
    .sort((left, right) => {
      const pathCompare = left.path.localeCompare(right.path);
      if (pathCompare !== 0) {
        return pathCompare;
      }
      return left.name.localeCompare(right.name);
    });

  const functionRefactors: RuntimeFunctionWarning[] = metrics.runtimeFunctionSpans
    .filter((span) => classifyFunctionSpan(span.length) === 'refactor')
    .map((span) => ({
      name: span.name,
      path: span.path,
      startLine: span.startLine,
      length: span.length,
    }))
    .sort((left, right) => {
      const pathCompare = left.path.localeCompare(right.path);
      if (pathCompare !== 0) {
        return pathCompare;
      }
      return left.name.localeCompare(right.name);
    });

  const unexpectedFileWarnings = fileWarnings.filter((row) => !baselineWarningFiles.has(row.path));
  const unexpectedFunctionWarnings = functionWarnings.filter(
    (warning) => !baselineWarningFunctionKeys.has(toFunctionKey(warning.name, warning.path)),
  );

  const staleBaselineFiles = [...baselineWarningFiles].filter(
    (filePath) => !fileWarnings.some((row) => row.path === filePath),
  );
  const staleBaselineFunctions = baseline.allowedWarningFunctions.filter(
    (warning) =>
      !functionWarnings.some(
        (runtimeWarning) => runtimeWarning.name === warning.name && runtimeWarning.path === warning.path,
      ),
  );

  const hasViolation =
    fileRefactors.length > 0 ||
    functionRefactors.length > 0 ||
    unexpectedFileWarnings.length > 0 ||
    unexpectedFunctionWarnings.length > 0 ||
    staleBaselineFiles.length > 0 ||
    staleBaselineFunctions.length > 0;

  if (hasViolation) {
    console.error('[CW] Architecture growth guard failed.');

    if (fileRefactors.length > 0) {
      console.error('[CW] File refactor-threshold violations:');
      fileRefactors.forEach((row) => {
        console.error(`- ${row.path} (${row.lines} lines)`);
      });
    }

    if (functionRefactors.length > 0) {
      console.error('[CW] Function refactor-threshold violations:');
      functionRefactors.forEach((warning) => {
        console.error(`- ${formatFunctionWarning(warning)}`);
      });
    }

    if (unexpectedFileWarnings.length > 0) {
      console.error('[CW] New file warning hotspots not present in baseline:');
      unexpectedFileWarnings.forEach((row) => {
        console.error(`- ${row.path} (${row.lines} lines)`);
      });
    }

    if (unexpectedFunctionWarnings.length > 0) {
      console.error('[CW] New function warning hotspots not present in baseline:');
      unexpectedFunctionWarnings.forEach((warning) => {
        console.error(`- ${formatFunctionWarning(warning)}`);
      });
    }

    if (staleBaselineFiles.length > 0 || staleBaselineFunctions.length > 0) {
      console.error(
        '[CW] Baseline contains resolved warning entries. Remove them from docs/architecture-growth-baseline.json.',
      );
      staleBaselineFiles.forEach((filePath) => {
        console.error(`- File baseline entry no longer needed: ${filePath}`);
      });
      staleBaselineFunctions.forEach((warning) => {
        console.error(`- Function baseline entry no longer needed: ${warning.name} (${warning.path})`);
      });
    }

    process.exitCode = 1;
    return;
  }

  console.log('[CW] Architecture growth guard passed.');
  console.log(`[CW] Allowed warning files: ${fileWarnings.length}`);
  console.log(`[CW] Allowed warning functions: ${functionWarnings.length}`);
}

await run();
