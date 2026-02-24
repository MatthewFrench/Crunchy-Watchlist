#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const buildScriptPath = path.join(repoRoot, 'scripts', 'build-extension-runtime.mts')
const playwrightCliPath = path.join(repoRoot, 'node_modules', '@playwright', 'test', 'cli.js')
const keepRuntimeOutput = /^(1|true|yes)$/i.test(String(process.env.CW_KEEP_E2E_RUNTIME || '').trim())

type CommandResult = {
  code: number
}

function sanitizeColorEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (env.NO_COLOR) {
    delete env.NO_COLOR
  }
  if (env.FORCE_COLOR) {
    delete env.FORCE_COLOR
  }
  return env
}

sanitizeColorEnv(process.env)

function createPlaywrightEnv(runtimeDir: string, fixtureServerPort: number): NodeJS.ProcessEnv {
  return sanitizeColorEnv({
    ...process.env,
    EXTENSION_RUNTIME_DIR: runtimeDir,
    PW_FIXTURE_SERVER_PORT: String(fixtureServerPort),
  })
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: 'inherit',
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      resolve({
        code: typeof code === 'number' ? code : 1,
      })
    })
  })
}

async function createRuntimeOutputDir(): Promise<string> {
  const tmpRoot = path.join(repoRoot, '.tmp')
  await fs.mkdir(tmpRoot, { recursive: true })
  return fs.mkdtemp(path.join(tmpRoot, 'extension-runtime-e2e-'))
}

function allocateFixtureServerPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', (error) => {
      reject(error)
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Unable to resolve ephemeral fixture server port.'))
        return
      }

      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(address.port)
      })
    })
  })
}

async function main(): Promise<void> {
  const playwrightArgs = process.argv.slice(2)
  const runtimeDir = await createRuntimeOutputDir()
  const fixtureServerPort = await allocateFixtureServerPort()
  const commandEnv = createPlaywrightEnv(runtimeDir, fixtureServerPort)

  try {
    process.stdout.write(`[e2e-runtime] Building generated runtime at ${runtimeDir}\n`)
    process.stdout.write(`[e2e-runtime] Reserved fixture server port ${fixtureServerPort}\n`)
    const buildResult = await runCommand('tsx', [buildScriptPath, '--out', runtimeDir], commandEnv)
    if (buildResult.code !== 0) {
      process.exitCode = buildResult.code
      return
    }

    const finalArgs = ['test', ...playwrightArgs]
    process.stdout.write(`[e2e-runtime] Running playwright ${finalArgs.join(' ')}\n`)
    const testResult = await runCommand(process.execPath, [playwrightCliPath, ...finalArgs], commandEnv)
    process.exitCode = testResult.code
  } finally {
    if (!keepRuntimeOutput) {
      await fs.rm(runtimeDir, { recursive: true, force: true })
    } else {
      process.stdout.write(`[e2e-runtime] Keeping runtime output at ${runtimeDir} (CW_KEEP_E2E_RUNTIME enabled)\n`)
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`)
  process.exitCode = 1
})
