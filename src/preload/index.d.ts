import type { RelaunchApi } from '../shared/ipc'

declare global {
  interface Window {
    api: RelaunchApi
  }
}

export {}
