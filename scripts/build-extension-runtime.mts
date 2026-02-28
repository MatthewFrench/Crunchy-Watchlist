#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const defaultSourceDir = path.join(repoRoot, 'extension');
const defaultOutputDir = path.join(repoRoot, '.tmp', 'extension-runtime-dev');

interface CliOptions {
  sourceDir: string;
  outputDir: string;
  bundleContentScripts: boolean;
}

interface ExtensionManifest {
  [key: string]: unknown;
  background?: {
    service_worker?: string;
    [key: string]: unknown;
  };
  content_scripts?: Array<{
    [key: string]: unknown;
    js?: string[];
    css?: string[];
  }>;
  web_accessible_resources?: Array<{
    [key: string]: unknown;
    resources?: string[];
  }>;
}

function parseCliOptions(argv: string[]): CliOptions {
  let sourceDir = defaultSourceDir;
  let outputDir = defaultOutputDir;
  let bundleContentScripts = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--source') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --source');
      }
      sourceDir = path.resolve(repoRoot, next);
      index += 1;
      continue;
    }

    if (value === '--out') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --out');
      }
      outputDir = path.resolve(repoRoot, next);
      index += 1;
      continue;
    }

    if (value === '--bundle-content-scripts') {
      bundleContentScripts = true;
      continue;
    }

    if (value === '--no-bundle-content-scripts') {
      bundleContentScripts = false;
    }
  }

  return {
    sourceDir,
    outputDir,
    bundleContentScripts,
  };
}

function isTranspilableTypeScriptFile(filePath: string): boolean {
  return filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');
}

function replaceWithJsExtension(filePath: string): string {
  return filePath.replace(/\.ts$/i, '.js');
}

function normalizeManifestScriptPath(scriptPath: string): string {
  return scriptPath.replace(/\.tsx?$/i, '.js');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectTypeScriptFiles(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && isTranspilableTypeScriptFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function ensureDirectoryForFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function transpileTypeScriptFile(sourceFile: string, outputFile: string): Promise<void> {
  const source = await fs.readFile(sourceFile, 'utf8');
  const result = await transform(source, {
    loader: 'ts',
    format: 'esm',
    target: 'es2022',
  });

  await ensureDirectoryForFile(outputFile);
  const output = result.code.endsWith('\n') ? result.code : `${result.code}\n`;
  await fs.writeFile(outputFile, output, 'utf8');
}

async function rewriteManifestForGeneratedRuntime(outputDir: string): Promise<ExtensionManifest> {
  const manifestPath = path.join(outputDir, 'manifest.json');
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw) as ExtensionManifest;

  if (Array.isArray(manifest.content_scripts)) {
    manifest.content_scripts = manifest.content_scripts.map((entry) => {
      const nextEntry: NonNullable<ExtensionManifest['content_scripts']>[number] = {
        ...entry,
      };

      if (Array.isArray(entry.js)) {
        nextEntry.js = entry.js.map(normalizeManifestScriptPath);
      } else {
        delete nextEntry.js;
      }

      if (Array.isArray(entry.css)) {
        nextEntry.css = [...entry.css];
      } else {
        delete nextEntry.css;
      }

      return nextEntry;
    });
  }

  if (manifest.background?.service_worker) {
    manifest.background = {
      ...manifest.background,
      service_worker: normalizeManifestScriptPath(manifest.background.service_worker),
    };
  }

  if (Array.isArray(manifest.web_accessible_resources)) {
    manifest.web_accessible_resources = manifest.web_accessible_resources.map((entry) => {
      const nextEntry: NonNullable<ExtensionManifest['web_accessible_resources']>[number] = {
        ...entry,
      };

      if (Array.isArray(entry.resources)) {
        nextEntry.resources = entry.resources.map((resourcePath) => normalizeManifestScriptPath(resourcePath));
      } else {
        delete nextEntry.resources;
      }

      return nextEntry;
    });
  }

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function normalizeImportSpecifier(scriptPath: string): string {
  const normalized = scriptPath.replace(/\\/g, '/');
  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    return normalized;
  }
  return `./${normalized}`;
}

async function assertContentScriptPathsExist(
  outputDir: string,
  contentScriptIndex: number,
  scriptPaths: string[],
): Promise<void> {
  for (const scriptPath of scriptPaths) {
    const fullPath = path.join(outputDir, scriptPath);
    if (!(await pathExists(fullPath))) {
      throw new Error(
        `Cannot bundle content_scripts[${contentScriptIndex}] because source script is missing: ${scriptPath}`,
      );
    }
  }
}

async function bundleManifestContentScripts(
  outputDir: string,
  manifest: ExtensionManifest,
): Promise<ExtensionManifest> {
  if (!Array.isArray(manifest.content_scripts)) {
    return manifest;
  }

  for (const [index, contentScriptEntry] of manifest.content_scripts.entries()) {
    const scriptPaths = Array.isArray(contentScriptEntry.js) ? contentScriptEntry.js : [];
    if (scriptPaths.length === 0) {
      continue;
    }
    await assertContentScriptPathsExist(outputDir, index, scriptPaths);

    const tempEntryFileName = `.cw-content-script-${index}.entry.js`;
    const tempEntryPath = path.join(outputDir, tempEntryFileName);
    const bundledFileName = `ContentScript.${index}.bundle.js`;
    const bundledFilePath = path.join(outputDir, bundledFileName);
    const entryContents = scriptPaths
      .map((scriptPath) => `import "${normalizeImportSpecifier(scriptPath)}";`)
      .join('\n');
    await fs.writeFile(tempEntryPath, `${entryContents}\n`, 'utf8');

    try {
      await build({
        entryPoints: [tempEntryPath],
        outfile: bundledFilePath,
        bundle: true,
        format: 'iife',
        target: 'es2022',
        treeShaking: false,
        logLevel: 'silent',
      });
    } finally {
      await fs.rm(tempEntryPath, { force: true });
    }

    contentScriptEntry.js = [bundledFileName];
  }

  await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function validateManifestContentScripts(outputDir: string, manifest: ExtensionManifest): Promise<void> {
  const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];

  for (const contentScriptEntry of contentScripts) {
    const scriptPaths = Array.isArray(contentScriptEntry.js) ? contentScriptEntry.js : [];
    for (const scriptPath of scriptPaths) {
      const fullPath = path.join(outputDir, scriptPath);
      if (!(await pathExists(fullPath))) {
        throw new Error(`Generated runtime is missing manifest script: ${scriptPath}`);
      }
    }
  }
}

async function buildExtensionRuntime(options: CliOptions): Promise<void> {
  if (!(await pathExists(options.sourceDir))) {
    throw new Error(`Extension source directory not found: ${options.sourceDir}`);
  }

  await fs.rm(options.outputDir, { recursive: true, force: true });
  await fs.mkdir(options.outputDir, { recursive: true });
  await fs.cp(options.sourceDir, options.outputDir, { recursive: true });

  const typeScriptFiles = await collectTypeScriptFiles(options.sourceDir);
  for (const typeScriptFile of typeScriptFiles) {
    const relativePath = path.relative(options.sourceDir, typeScriptFile);
    const outputTsPath = path.join(options.outputDir, relativePath);
    const outputJsPath = replaceWithJsExtension(outputTsPath);

    await transpileTypeScriptFile(typeScriptFile, outputJsPath);
    await fs.rm(outputTsPath, { force: true });
  }

  const manifest = await rewriteManifestForGeneratedRuntime(options.outputDir);
  const finalizedManifest = options.bundleContentScripts
    ? await bundleManifestContentScripts(options.outputDir, manifest)
    : manifest;
  await validateManifestContentScripts(options.outputDir, finalizedManifest);

  process.stdout.write(`Prepared extension runtime: ${options.outputDir}\n`);
  process.stdout.write(`TypeScript source files transpiled: ${typeScriptFiles.length}\n`);
  process.stdout.write(`Content scripts bundled: ${options.bundleContentScripts ? 'yes' : 'no'}\n`);
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  await buildExtensionRuntime(options);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
});
