import type { SyncEntry, OfflineOp } from './types.js'

function entryKey(entry: SyncEntry): string {
  const data = entry.data as Record<string, unknown>
  const dim = (data.dim as string) ?? (data.field as string) ?? (data.trigger as string) ?? '_meta'
  const scope = (data.scope as string) ?? '*'
  return `${entry.type}:${dim}:${scope}`
}

let opCounter = 0

export class OfflineQueue {
  private ops: OfflineOp[] = []
  private seen = new Set<string>()

  get pendingCount(): number {
    return this.ops.length
  }

  enqueue(kind: 'push' | 'pull', entries: SyncEntry[]): void {
    if (kind === 'push' && entries.length > 0) {
      const key = entries.map(entryKey).join('|')
      if (this.seen.has(key)) return
      this.seen.add(key)
    }

    this.ops.push({
      id: `op-${++opCounter}`,
      kind,
      entries,
      created_at: new Date().toISOString(),
    })
  }

  flush(): OfflineOp[] {
    const pending = [...this.ops]
    this.ops = []
    this.seen.clear()
    return pending
  }
}
