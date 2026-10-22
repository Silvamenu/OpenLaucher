import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Nomes de processos em execução (minúsculos). */
export async function listProcessNames(platform: NodeJS.Platform = process.platform): Promise<Set<string>> {
  const names = new Set<string>()
  if (platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 })
      for (const line of stdout.split(/\r?\n/)) {
        const match = /^"([^"]+)"/.exec(line)
        if (match) names.add(match[1].toLowerCase())
      }
    } catch {
      // Sem tasklist (ambiente restrito): seguimos apenas com os processos que nós iniciamos.
    }
    return names
  }
  // Linux: /proc/<pid>/comm (até 15 caracteres) e argv[0].
  let pids: string[]
  try {
    pids = (await fs.readdir('/proc')).filter((p) => /^\d+$/.test(p))
  } catch {
    return names
  }
  await Promise.all(
    pids.map(async (pid) => {
      try {
        const comm = (await fs.readFile(`/proc/${pid}/comm`, 'utf8')).trim()
        if (comm) names.add(comm.toLowerCase())
        const cmdline = await fs.readFile(`/proc/${pid}/cmdline`, 'utf8')
        const argv0 = cmdline.split('\0')[0]
        if (argv0) names.add(path.basename(argv0).toLowerCase())
      } catch {
        // processo terminou durante a leitura
      }
    })
  )
  return names
}

/** Verifica se algum dos executáveis (por nome de arquivo) está rodando. */
export async function isAnyRunning(executables: string[], platform: NodeJS.Platform = process.platform): Promise<boolean> {
  if (executables.length === 0) return false
  const running = await listProcessNames(platform)
  return executables.some((exe) => {
    const base = path.basename(exe).toLowerCase()
    const noExt = base.replace(/\.(exe|appimage)$/i, '')
    // /proc/<pid>/comm é truncado em 15 caracteres
    return running.has(base) || running.has(noExt) || running.has(base.slice(0, 15)) || running.has(noExt.slice(0, 15))
  })
}
