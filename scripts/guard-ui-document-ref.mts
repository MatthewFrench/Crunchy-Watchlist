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
const uiRoot = path.join(repoRoot, 'extension', 'src', 'Ui');
const ambientDocumentPattern = /\bdocument\b/;

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

async function run(): Promise<void> {
  const files = (await collectTsFiles(uiRoot)).sort((left, right) => left.localeCompare(right));
  const violations: Violation[] = [];

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const relativePath = toRepoRelativePath(file);
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!line || isCommentLine(line)) {
        return;
      }
      if (!ambientDocumentPattern.test(line)) {
        return;
      }
      violations.push({
        file: relativePath,
        line: index + 1,
        snippet: line.trim(),
      });
    });
  }

  if (violations.length > 0) {
    console.error('[CW] UI document-ref guard failed.');
    violations.forEach((violation) => {
      console.error(`- ${violation.file}:${violation.line} Ambient document usage is forbidden in UI owners`);
      console.error(`    ${violation.snippet}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log('[CW] UI document-ref guard passed.');
}

await run();
