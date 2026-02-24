#!/usr/bin/env node

import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'esbuild'

type FileClassification = 'ok' | 'warning' | 'refactor'

type FileRow = {
  path: string
  lines: number
  classification: FileClassification
}

type FunctionSpan = {
  path: string
  name: string
  startLine: number
  endLine: number
  length: number
}

type AstNode = {
  type: string
  [key: string]: unknown
}

type AcornModule = {
  parse: (source: string, options: Record<string, unknown>) => unknown
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const acorn = require('acorn') as AcornModule

const FILE_SIZE_BUDGETS = {
  runtimeWarn: 800,
  runtimeRefactor: 1200,
  testWarn: 550,
  testRefactor: 750,
  functionWarn: 70,
  functionRefactor: 100,
} as const

const FILE_SIZE_BUDGET_OVERRIDES: Record<string, { warn: number; refactor: number }> = {
  'extension/Content.js': {
    warn: 1000,
    refactor: 1200,
  },
}

function isAstNode(value: unknown): value is AstNode {
  return Boolean(value) && typeof value === 'object' && typeof (value as Record<string, unknown>).type === 'string'
}

async function readUtf8(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8')
}

function countLines(text: string): number {
  return text.split(/\r?\n/).length
}

function toRel(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/')
}

function walkAst(
  node: unknown,
  visitor: (node: AstNode, parent: AstNode | null) => void,
  parent: AstNode | null = null,
): void {
  if (!isAstNode(node)) {
    return
  }

  visitor(node, parent)

  for (const value of Object.values(node)) {
    if (!value) {
      continue
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (isAstNode(entry)) {
          walkAst(entry, visitor, node)
        }
      }
      continue
    }

    if (isAstNode(value)) {
      walkAst(value, visitor, node)
    }
  }
}

function getIdentifierName(node: unknown): string {
  if (!isAstNode(node) || node.type !== 'Identifier') {
    return ''
  }
  const name = (node as { name?: unknown }).name
  return typeof name === 'string' ? name : ''
}

function getPropertyKeyName(node: unknown): string {
  if (!isAstNode(node)) {
    return ''
  }

  if (node.type === 'Identifier') {
    return getIdentifierName(node)
  }
  if (node.type === 'Literal') {
    const value = (node as { value?: unknown }).value
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  }

  return ''
}

function getMemberExpressionName(node: unknown): string {
  if (!isAstNode(node) || node.type !== 'MemberExpression') {
    return ''
  }

  const object = (node as { object?: unknown }).object
  const property = (node as { property?: unknown }).property
  const objectName =
    getIdentifierName(object) ||
    (isAstNode(object) && object.type === 'MemberExpression' ? getMemberExpressionName(object) : '')
  const propertyName = getPropertyKeyName(property)

  if (objectName && propertyName) {
    return `${objectName}.${propertyName}`
  }

  return propertyName || objectName
}

function getFunctionNodeLocation(node: unknown): { startLine: number; endLine: number } | null {
  if (!isAstNode(node)) {
    return null
  }

  const location = (node as { loc?: { start?: { line?: unknown }; end?: { line?: unknown } } }).loc
  const startLineRaw = location?.start?.line
  const endLineRaw = location?.end?.line
  const startLine = typeof startLineRaw === 'number' ? startLineRaw : null
  const endLine = typeof endLineRaw === 'number' ? endLineRaw : null
  if (!startLine || !endLine) {
    return null
  }

  return {
    startLine,
    endLine,
  }
}

function inferFunctionExpressionName(node: AstNode, parent: AstNode | null): string {
  const directName = getIdentifierName((node as { id?: unknown }).id)
  if (directName) {
    return directName
  }
  if (!parent) {
    return ''
  }

  if (parent.type === 'VariableDeclarator') {
    return getIdentifierName((parent as { id?: unknown }).id)
  }
  if (parent.type === 'AssignmentExpression') {
    const left = (parent as { left?: unknown }).left
    return getIdentifierName(left) || getMemberExpressionName(left)
  }
  if (parent.type === 'Property' || parent.type === 'MethodDefinition') {
    return getPropertyKeyName((parent as { key?: unknown }).key)
  }

  return ''
}

function extractFunctionSpans(source: string, relPath: string): FunctionSpan[] {
  let ast: unknown = null

  try {
    ast = acorn.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    })
  } catch {
    return []
  }

  const spans: FunctionSpan[] = []
  const seen = new Set<string>()
  const pushSpan = (name: string, node: AstNode): void => {
    if (!name) {
      return
    }

    const location = getFunctionNodeLocation(node)
    if (!location) {
      return
    }

    const key = `${name}:${location.startLine}:${location.endLine}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    spans.push({
      path: relPath,
      name,
      startLine: location.startLine,
      endLine: location.endLine,
      length: location.endLine - location.startLine + 1,
    })
  }

  walkAst(ast, (node, parent) => {
    if (node.type === 'FunctionDeclaration') {
      pushSpan(getIdentifierName((node as { id?: unknown }).id), node)
      return
    }

    if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      pushSpan(inferFunctionExpressionName(node, parent), node)
    }
  })

  return spans
}

async function normalizeSourceForFunctionScan(source: string, filePath: string): Promise<string> {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.mts')) {
    return source
  }

  try {
    const result = await transform(source, {
      loader: 'ts',
      format: 'esm',
      target: 'es2022',
    })
    return result.code
  } catch {
    return source
  }
}

function classifyFile(relPath: string, lines: number): FileClassification {
  const budgets = getFileSizeBudgets(relPath)
  if (!budgets) {
    return 'ok'
  }

  if (lines > budgets.refactor) return 'refactor'
  if (lines > budgets.warn) return 'warning'
  return 'ok'
}

function getFileWarningThreshold(relPath: string): number | null {
  const budgets = getFileSizeBudgets(relPath)
  return budgets ? budgets.warn : null
}

function getFileSizeBudgets(relPath: string): { warn: number; refactor: number } | null {
  const override = FILE_SIZE_BUDGET_OVERRIDES[relPath]
  if (override) {
    return override
  }

  if (relPath.startsWith('extension/')) {
    return {
      warn: FILE_SIZE_BUDGETS.runtimeWarn,
      refactor: FILE_SIZE_BUDGETS.runtimeRefactor,
    }
  }

  if (relPath.startsWith('tests/') && (relPath.endsWith('.spec.js') || relPath.endsWith('.spec.ts'))) {
    return {
      warn: FILE_SIZE_BUDGETS.testWarn,
      refactor: FILE_SIZE_BUDGETS.testRefactor,
    }
  }

  return null
}

function statusLabel(classification: FileClassification): 'OK' | 'Warning' | 'Refactor' {
  if (classification === 'refactor') return 'Refactor'
  if (classification === 'warning') return 'Warning'
  return 'OK'
}

async function collectTrackedFiles(): Promise<string[]> {
  const extensionSrcJsFiles = await collectFilesBySuffix(path.join(repoRoot, 'extension', 'src'), '.js')
  const extensionSrcTsFiles = await collectFilesBySuffix(path.join(repoRoot, 'extension', 'src'), '.ts')
  const scriptsTsFiles = [
    ...(await collectFilesBySuffix(path.join(repoRoot, 'scripts'), '.ts')),
    ...(await collectFilesBySuffix(path.join(repoRoot, 'scripts'), '.mts')),
  ]

  const testsDir = path.join(repoRoot, 'tests')
  const testEntries = await fs.readdir(testsDir, { withFileTypes: true })
  const testSpecs = testEntries
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.spec.js') || entry.name.endsWith('.spec.ts')))
    .map((entry) => path.join(testsDir, entry.name))
  const fixtureServerModules = testEntries
    .filter((entry) => entry.isFile() && entry.name.startsWith('Server') && entry.name.endsWith('.ts'))
    .map((entry) => path.join(testsDir, entry.name))

  return Array.from(
    new Set([
      path.join(repoRoot, 'extension', 'Content.js'),
      path.join(repoRoot, 'extension', 'Content.css'),
      ...extensionSrcJsFiles.sort(),
      ...extensionSrcTsFiles.sort(),
      ...fixtureServerModules.sort(),
      ...testSpecs.sort(),
      ...scriptsTsFiles.sort(),
      path.join(repoRoot, 'scripts', 'build-safari-macos.sh'),
    ]),
  )
}

async function collectFilesBySuffix(rootDir: string, suffix: string): Promise<string[]> {
  let entries: Dirent[]

  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true })
  } catch (error) {
    if ((error as { code?: string })?.code === 'ENOENT') {
      return []
    }
    throw error
  }

  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFilesBySuffix(fullPath, suffix)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(fullPath)
    }
  }

  return files
}

function formatDateUtc(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function renderMarkdown(args: {
  generatedDate: string
  fileRows: FileRow[]
  topFunctions: FunctionSpan[]
  opportunities: string[]
}): string {
  const tick = '`'
  const fileTableRows = args.fileRows
    .map((row) => `| ${tick}${row.path}${tick} | ${row.lines} | ${statusLabel(row.classification)} |`)
    .join('\n')

  const functionTableRows = args.topFunctions
    .map((fn) => {
      const status =
        fn.length > FILE_SIZE_BUDGETS.functionRefactor
          ? 'Refactor'
          : fn.length > FILE_SIZE_BUDGETS.functionWarn
            ? 'Warning'
            : 'OK'
      return `| ${tick}${fn.name}${tick} | ${tick}${fn.path}:${fn.startLine}${tick} | ${fn.length} | ${status} |`
    })
    .join('\n')

  const opportunityRows = args.opportunities.length
    ? args.opportunities.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : '1. No new structural opportunities detected above configured thresholds.'

  return `# Architecture Progress\n\nLast generated: ${args.generatedDate}\n\nThis tracker is generated by \`scripts/architecture-metrics.mts\` and summarizes current structural hotspots against \`docs/architecture-standards.md\` budgets.\n\n## File Metrics\n\n| File | Lines | Status |\n| --- | ---: | --- |\n${fileTableRows}\n\n## Largest Runtime Functions\n\n| Function | Location | Lines | Status |\n| --- | --- | ---: | --- |\n${functionTableRows}\n\n## Improvement Opportunities\n\n${opportunityRows}\n\n## Notes\n\n- \`Refactor\`: beyond mandatory threshold.\n- \`Warning\`: trending toward threshold; avoid additional growth.\n- \`OK\`: within configured budget.\n`
}

async function main(): Promise<void> {
  const trackedFiles = await collectTrackedFiles()
  const fileRows: FileRow[] = []

  for (const filePath of trackedFiles) {
    const source = await readUtf8(filePath)
    const relPath = toRel(filePath)
    const lines = countLines(source)
    fileRows.push({
      path: relPath,
      lines,
      classification: classifyFile(relPath, lines),
    })
  }

  fileRows.sort((left, right) => right.lines - left.lines)

  const runtimeFunctionSpans: FunctionSpan[] = []
  const runtimeSources = trackedFiles.filter((filePath) => {
    const relPath = toRel(filePath)
    return relPath.startsWith('extension/') && (filePath.endsWith('.js') || filePath.endsWith('.ts'))
  })

  for (const filePath of runtimeSources) {
    const source = await readUtf8(filePath)
    const relPath = toRel(filePath)
    const normalizedSource = await normalizeSourceForFunctionScan(source, filePath)
    runtimeFunctionSpans.push(...extractFunctionSpans(normalizedSource, relPath))
  }

  const functionSpans = runtimeFunctionSpans.sort((left, right) => right.length - left.length).slice(0, 12)
  const opportunities: string[] = []

  for (const row of fileRows) {
    if (row.classification === 'refactor') {
      opportunities.push(`\`${row.path}\` is ${row.lines} lines and above the refactor threshold.`)
    }
  }

  const warningFiles = fileRows.filter((row) => row.classification === 'warning')
  for (const row of warningFiles.slice(0, 5)) {
    const warningThreshold = getFileWarningThreshold(row.path)
    if (!warningThreshold) {
      continue
    }
    opportunities.push(
      `\`${row.path}\` is ${row.lines} lines and above the warning threshold (${warningThreshold}); reduce before reaching refactor threshold.`,
    )
  }

  for (const fn of functionSpans) {
    if (fn.length > FILE_SIZE_BUDGETS.functionRefactor) {
      opportunities.push(`\`${fn.name}\` in \`${fn.path}:${fn.startLine}\` is ${fn.length} lines and should be split.`)
    }
  }

  const warningFunctions = runtimeFunctionSpans
    .filter((fn) => fn.length > FILE_SIZE_BUDGETS.functionWarn && fn.length <= FILE_SIZE_BUDGETS.functionRefactor)
    .sort((left, right) => right.length - left.length)
  for (const fn of warningFunctions.slice(0, 5)) {
    opportunities.push(
      `\`${fn.name}\` in \`${fn.path}:${fn.startLine}\` is ${fn.length} lines and above the warning threshold (${FILE_SIZE_BUDGETS.functionWarn}).`,
    )
  }

  const markdown = renderMarkdown({
    generatedDate: formatDateUtc(new Date()),
    fileRows,
    topFunctions: functionSpans,
    opportunities,
  })

  const outputPath = path.join(repoRoot, 'docs', 'architecture-progress.md')
  await fs.writeFile(outputPath, markdown, 'utf8')

  process.stdout.write(`Updated ${toRel(outputPath)}\n`)
}

main().catch((error) => {
  process.stderr.write(
    `${(error as { stack?: string; message?: string })?.stack || (error as { message?: string })?.message || String(error)}\n`,
  )
  process.exitCode = 1
})
