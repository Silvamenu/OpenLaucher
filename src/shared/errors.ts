import type { AppErrorCode, AppErrorShape } from './types'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly params?: Record<string, string | number>

  constructor(code: AppErrorCode, message?: string, params?: Record<string, string | number>) {
    super(message ?? code)
    this.name = 'AppError'
    this.code = code
    this.params = params
  }

  toShape(): AppErrorShape {
    return { code: this.code, message: this.message, params: this.params }
  }
}

/** Converte qualquer erro (incluindo erros de sistema do Node) em um formato serializável. */
export function toErrorShape(err: unknown): AppErrorShape {
  if (err instanceof AppError) return err.toShape()
  const e = err as { code?: string; path?: string; message?: string; name?: string } | undefined
  const message = e?.message ?? String(err)
  switch (e?.code) {
    case 'ENOENT':
      return { code: 'NOT_FOUND', message, params: e.path ? { path: e.path } : undefined }
    case 'EACCES':
    case 'EPERM':
      return { code: 'PERMISSION_DENIED', message, params: e.path ? { path: e.path } : undefined }
    case 'EBUSY':
      return { code: 'GAME_RUNNING', message, params: e.path ? { path: e.path } : undefined }
    case 'ENOSPC':
      return { code: 'DISK_FULL', message }
    case 'ABORT_ERR':
      return { code: 'CANCELLED', message }
    default:
      if (e?.name === 'AbortError') return { code: 'CANCELLED', message }
      return { code: 'UNKNOWN', message }
  }
}
