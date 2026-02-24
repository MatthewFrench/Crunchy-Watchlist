#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(repoRoot, 'dist', 'firefox', 'unpacked')

function runWebExtLint(): Promise<number> {
  return new Promise((resolve, reject) => {
    const existingNodeOptions = String(process.env.NODE_OPTIONS || '').trim()
    const nodeOptions = [existingNodeOptions, '--no-deprecation'].filter(Boolean).join(' ')

    const child = spawn('web-ext', ['lint', '--source-dir', sourceDir], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_OPTIONS: nodeOptions,
      },
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('close', (code) => resolve(typeof code === 'number' ? code : 1))
  })
}

const exitCode = await runWebExtLint()
process.exitCode = exitCode
