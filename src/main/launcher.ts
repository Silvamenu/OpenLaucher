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

/** O que é executado ao abrir um jogo. */
export interface LaunchPlan {
  exe: string
  args: string[]
  cwd: string
  env: Record<string, string>
}

/** Jogo comum: o executável dele, com a pasta do jogo como diretório de trabalho. */
export function directPlan(manifest: Manifest, entry: GameEntry, exeRel: string, platform: Platform): LaunchPlan {
  const ctx = { gameDir: entry.path, platform }
  return {
    exe: path.join(entry.path, exeRel),
    args: launchArgsFor(manifest, platform).map((a) => expandVariables(a, ctx)),
    cwd: entry.path,
    env: Object.fromEntries(Object.entries(launchEnvFor(manifest, platform)).map(([k, v]) => [k, expandVariables(v, ctx)]))
  }
}

/**
 * Jogo via emulador: o emulador abre o arquivo do jogo do usuário. Roda na pasta do emulador (onde
 * ficam as configurações dele); {gameFile} e {gameDir} nos argumentos são o arquivo e a pasta do jogo.
 */
export function runnerPlan(
  game: { manifest: Manifest; entry: GameEntry; gameFile: string },
  emulator: { manifest: Manifest; entry: GameEntry; exe: string },
  platform: Platform
): LaunchPlan {
  const runner = game.manifest.runner
  const args = !runner ? [] : Array.isArray(runner.args) ? runner.args : (runner.args[platform] ?? ['{gameFile}'])
  const gameCtx = { gameDir: game.entry.path, platform }
  const emulatorCtx = { gameDir: emulator.entry.path, platform }
  return {
    exe: emulator.exe,
    args: args.map((a) => expandVariables(a, gameCtx, { gameFile: game.gameFile })),
    cwd: emulator.entry.path,
    env: Object.fromEntries(Object.entries(launchEnvFor(emulator.manifest, platform)).map(([k, v]) => [k, expandVariables(v, emulatorCtx)]))
  }
}

/** Inicia os jogos e mede o tempo jogado. */
export class GameLauncher {
  /** Quantas sessões usam cada entrada agora (um emulador pode estar rodando vários jogos). */
  private readonly running = new Map<string, number>()

  constructor(
    private readonly platform: Platform,
    private readonly callbacks: LaunchCallbacks
  ) {}

  isRunning(entryId: string): boolean {
    return (this.running.get(entryId) ?? 0) > 0
  }

  /** `alsoBusy`: entradas usadas pelo jogo enquanto ele roda (o emulador não pode ser atualizado no meio). */
  async launch(entryId: string, plan: LaunchPlan, alsoBusy: string[] = []): Promise<void> {
    if (this.isRunning(entryId)) throw new AppError('ALREADY_RUNNING')
    const exe = plan.exe

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

    const child = spawn(exe, plan.args, {
      cwd: plan.cwd,
      env: { ...process.env, ...plan.env },
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
    const ids = [entryId, ...alsoBusy.filter((id) => id !== entryId)]
    ids.forEach((id) => this.running.set(id, (this.running.get(id) ?? 0) + 1))
    this.callbacks.onStart(entryId)
    child.once('exit', () => {
      for (const id of ids) {
        const left = (this.running.get(id) ?? 1) - 1
        if (left > 0) this.running.set(id, left)
        else this.running.delete(id)
      }
      this.callbacks.onExit(entryId, Math.round((Date.now() - startedAt) / 1000))
    })
  }
}
