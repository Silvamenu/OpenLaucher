import { decideDevlog, findChangelogEntry, groupReleaseNotes } from '../shared/devlog'
import type { DevlogView } from '../shared/types'

export interface DevlogStorage {
  getLastSeen(): string | undefined
  setLastSeen(version: string): void
  getStoredNotes(version: string): { notes: string; date: string | null } | undefined
}

/**
 * Controla o popup "Novidades da vX.Y.Z": aparece uma única vez,
 * na primeira abertura depois de uma atualização.
 */
export class DevlogTracker {
  constructor(
    private readonly currentVersion: string,
    private readonly storage: DevlogStorage,
    private readonly readChangelog: () => string | null
  ) {}

  /** Chamado ao abrir o app. Retorna o devlog a exibir, ou null. */
  pending(): DevlogView | null {
    const decision = decideDevlog(this.currentVersion, this.storage.getLastSeen())
    if (decision.show) return this.current()
    if (decision.markSeen) this.storage.setLastSeen(this.currentVersion)
    return null
  }

  markSeen(): void {
    this.storage.setLastSeen(this.currentVersion)
  }

  /** Notas da versão atual: CHANGELOG.md embutido; se faltar, as notas guardadas pelo atualizador. */
  current(): DevlogView {
    const changelog = this.readChangelog()
    const entry = changelog ? findChangelogEntry(changelog, this.currentVersion) : null
    const stored = this.storage.getStoredNotes(this.currentVersion)
    const raw = entry?.body || stored?.notes || ''
    return {
      version: this.currentVersion,
      date: entry?.date ?? stored?.date ?? null,
      sections: groupReleaseNotes(raw)
    }
  }
}
