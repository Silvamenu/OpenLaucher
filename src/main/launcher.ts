import { spawn, type ChildProcess } from 'node:child_process'
import { constants as fsConstants, promises as fs } from 'node:fs'
import path from 'node:path'
import { AppError } from '../shared/errors'
import { launchArgsFor, launchEnvFor, type Manifest, type Platform } from '../shared/manifest'
import type { GameEntry } from '../shared/types'
import { expandVariables } from './pathVars'

interface RunningGame {
  child: ChildProcess
  startedAt: number
  exeName: string
}

export interface LaunchCallbacks {
  onStart: (entryId: string) => void
  /** Chamado ao fechar o jogo com a duração da sessão em segundos. */
  onExit: (entryId: string, seconds: number) => void
}

/** Inicia os jogos com `cwd` na pasta do jogo e mede o tempo jogado. */
export class GameLauncher {
  private readonly running = new Map<string, RunningGame>()

  constructor(
    private readonly platform: Platform,
    private readonly callbacks: LaunchCallbacks
  ) {}

  isRunning(entryId: string): boolean {
    return this.running.has(entryId)
  }

  runningExeNames(): string[] {
    return [...this.running.values()].map((r) => r.exeName)
  }

  async launch(entry: GameEntry, manifest: Manifest, exeRel: string | null): Promise<void> {
    if (this.running.has(entry.id)) throw new AppError('ALREADY_RUNNING')
    try {
      const stat = await fs.stat(entry.path)
      if (!stat.isDirectory()) throw new Error('not a dir')
    } catch {
      throw new AppError('FOLDER_NOT_FOUND', entry.path, { path: entry.path })
    }
    if (!exeRel) throw new AppError('EXE_NOT_FOUND', '', { path: entry.path })
    const exe = path.join(entry.path, exeRel)

    // AppImages e binários Linux precisam do bit de execução.
    if (this.platform !== 'win32') {
      try {
        await fs.access(exe, fsConstants.X_OK)
      } catch {
        await fs.chmod(exe, 0o755).catch(() => {
          throw new AppError('PERMISSION_DENIED', exe, { path: exe })
        })
      }
    }

    const ctx = { gameDir: entry.path, platform: this.platform }
    const extraEnv = Object.fromEntries(Object.entries(launchEnvFor(manifest, this.platform)).map(([k, v]) => [k, expandVariables(v, ctx)]))
    const args = launchArgsFor(manifest, this.platform).map((a) => expandVariables(a, ctx))

    const child = spawn(exe, args, {
      cwd: entry.path,
      env: { ...process.env, ...extraEnv },
      stdio: 'ignore',
      windowsHide: false,
      detached: false
    })

    await new Promise<void>((resolve, reject) => {
      child.once('spawn', () => resolve())
      child.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') reject(new AppError('EXE_NOT_FOUND', exe, { path: exe }))
        else if (err.code === 'EACCES' || err.code === 'EPERM') reject(new AppError('PERMISSION_DENIED', exe, { path: exe }))
        else reject(new AppError('UNKNOWN', err.message))
      })
    })

    const startedAt = Date.now()
    this.running.set(entry.id, { child, startedAt, exeName: path.basename(exeRel) })
    this.callbacks.onStart(entry.id)
    child.once('exit', () => {
      this.running.delete(entry.id)
      this.callbacks.onExit(entry.id, Math.round((Date.now() - startedAt) / 1000))
    })
  }
}
