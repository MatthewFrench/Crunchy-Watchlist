import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Violation = {
  file: string;
  line: number;
  snippet: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const scanRoots = [path.join(repoRoot, 'extension', 'src')];
const directAsyncListenerPattern = /\baddEventListener\s*\(\s*[^,]+,\s*async\b/g;

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

function getLineForOffset(source: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) {
      line += 1;
    }
  }
  return line;
}

function getSourceLine(source: string, line: number): string {
  const lines = source.split(/\r?\n/);
  return lines[line - 1]?.trim() || '';
}

async function run(): Promise<void> {
  const files = (await Promise.all(scanRoots.map(async (rootDir) => collectTsFiles(rootDir)))).flat();
  const violations: Violation[] = [];

  for (const file of files.sort((left, right) => left.localeCompare(right))) {
    const source = await fs.readFile(file, 'utf8');
    const relativePath = toRepoRelativePath(file);
    const matches = source.matchAll(directAsyncListenerPattern);

    for (const match of matches) {
      const offset = typeof match.index === 'number' ? match.index : -1;
      if (offset < 0) {
        continue;
      }
      const line = getLineForOffset(source, offset);
      violations.push({
        file: relativePath,
        line,
        snippet: getSourceLine(source, line),
      });
    }
  }

  if (violations.length > 0) {
    console.error('[CW] Async event-listener guard failed.');
    violations.forEach((violation) => {
      console.error(`- ${violation.file}:${violation.line} direct async addEventListener callback is forbidden`);
      if (violation.snippet) {
        console.error(`    ${violation.snippet}`);
      }
    });
    console.error('[CW] Wrap listener work in a guarded runner: void run().catch(...)');
    process.exitCode = 1;
    return;
  }

  console.log('[CW] Async event-listener guard passed.');
}

await run();
