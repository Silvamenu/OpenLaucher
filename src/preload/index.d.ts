import type { RecompApi } from '../shared/ipc'

declare global {
  interface Window {
    api: RecompApi
  }
}

export {}
