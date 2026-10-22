import { spawn } from 'node:child_process'
import { constants as fsConstants, promises as fs } from 'node:fs'
import path from 'node:path'
import { AppError } from '../shared/errors'
import type { Manifest, Platform } from '../shared/manifest'
import { launchArgsFor, launchEnvFor } from '../shared/manifestUtils'
import type { GameEntry } from '../shared/types'
import { expandVariables } from './pathVars'

export interface LaunchCallbacks {
  onStart: (entryId: string) => void
  /** Chamado ao fechar o jogo com a duração da sessão em segundos. */
  onExit: (entryId: string, seconds: number) => void
}

/** Inicia os jogos com `cwd` na pasta do jogo e mede o tempo jogado. */
export class GameLauncher {
  private readonly running = new Set<string>()

  constructor(
    private readonly platform: Platform,
    private readonly callbacks: LaunchCallbacks
  ) {}

  isRunning(entryId: string): boolean {
    return this.running.has(entryId)
  }

  async launch(entry: GameEntry, manifest: Manifest, exeRel: string | null): Promise<void> {
    if (this.running.has(entry.id)) throw new AppError('ALREADY_RUNNING')
    // A pasta do jogo já foi conferida por quem chama (LibraryService.launch).
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
    this.running.add(entry.id)
    this.callbacks.onStart(entry.id)
    child.once('exit', () => {
      this.running.delete(entry.id)
      this.callbacks.onExit(entry.id, Math.round((Date.now() - startedAt) / 1000))
    })
  }
}
