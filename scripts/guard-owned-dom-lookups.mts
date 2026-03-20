import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Violation = {
  file: string;
  line: number;
  reason: string;
  snippet: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const scanRoots = [path.join(repoRoot, 'extension', 'src', 'Runtime'), path.join(repoRoot, 'extension', 'src', 'Ui')];

const allowedQueryLookupBudgets = new Map<string, number>([
  ['extension/src/Runtime/BootstrapGate.ts', 2],
  ['extension/src/Runtime/ContentRuntimeBootstrapDomLock.ts', 3],
  ['extension/src/Runtime/InterfaceShellHostLifecycle.ts', 0],
]);

const queryLookupPattern = /\bquerySelector(?:All)?\s*\(/;
const forbiddenLookupPatterns: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\bfindElementByClassTokenWithin\s*\(/,
    reason: 'Owned class-token lookup helper is forbidden',
  },
  {
    pattern: /\bgetElementById\s*\(/,
    reason: 'ID lookups are forbidden for extension-owned UI',
  },
  {
    pattern: /\bgetElementsByClassName\s*\(/,
    reason: 'Class-name lookups are forbidden for extension-owned UI',
  },
  {
    pattern: /\bgetElementsByTagName\s*\(/,
    reason: 'Tag-based lookups are forbidden for extension-owned UI',
  },
];

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

function isCommentLine(line: string): boolean {
  return line.trim().startsWith('//');
}

function assertAllowedLookupBudgets(queryLookupCountByFile: Map<string, number>, violations: Violation[]): void {
  for (const [file, expectedCount] of allowedQueryLookupBudgets.entries()) {
    const actualCount = queryLookupCountByFile.get(file) ?? 0;
    if (actualCount === expectedCount) {
      continue;
    }
    violations.push({
      file,
      line: 1,
      reason: `Expected ${expectedCount} allowed root/native query lookups, found ${actualCount}`,
      snippet: '',
    });
  }

  for (const [file, actualCount] of queryLookupCountByFile.entries()) {
    if (allowedQueryLookupBudgets.has(file)) {
      continue;
    }
    if (actualCount <= 0) {
      continue;
    }
    violations.push({
      file,
      line: 1,
      reason: `Found ${actualCount} querySelector-based lookups in a non-allowlisted owner file`,
      snippet: '',
    });
  }
}

async function run(): Promise<void> {
  const files = (await Promise.all(scanRoots.map(async (scanRoot) => collectTsFiles(scanRoot)))).flat();
  const sortedFiles = files.sort((left, right) => left.localeCompare(right));
  const violations: Violation[] = [];
  const queryLookupCountByFile = new Map<string, number>();

  for (const file of sortedFiles) {
    const source = await fs.readFile(file, 'utf8');
    const relativePath = toRepoRelativePath(file);
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!line || isCommentLine(line)) {
        return;
      }

      const lineNumber = index + 1;
      for (const forbiddenPattern of forbiddenLookupPatterns) {
        if (!forbiddenPattern.pattern.test(line)) {
          continue;
        }
        violations.push({
          file: relativePath,
          line: lineNumber,
          reason: forbiddenPattern.reason,
          snippet: line.trim(),
        });
      }

      if (!queryLookupPattern.test(line)) {
        return;
      }

      const existingCount = queryLookupCountByFile.get(relativePath) ?? 0;
      queryLookupCountByFile.set(relativePath, existingCount + 1);
    });
  }

  assertAllowedLookupBudgets(queryLookupCountByFile, violations);

  if (violations.length > 0) {
    const summary = violations
      .map((violation) => {
        const location = `${violation.file}:${violation.line}`;
        if (!violation.snippet) {
          return `- ${location} ${violation.reason}`;
        }
        return `- ${location} ${violation.reason}\n    ${violation.snippet}`;
      })
      .join('\n');

    console.error('[CW] Owned DOM lookup guard failed.');
    console.error(summary);
    process.exitCode = 1;
    return;
  }

  const allowedSummary = [...allowedQueryLookupBudgets.entries()]
    .map(([file, expected]) => `${file}=${expected}`)
    .join(', ');
  console.log('[CW] Owned DOM lookup guard passed.');
  console.log(`[CW] Allowlisted root/native query lookups: ${allowedSummary}`);
}

await run();
