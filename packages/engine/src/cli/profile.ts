import * as fs from 'node:fs'
import { parseLedger } from '../ledger.js'
import { createResolver } from '../resolver.js'
const DEFAULT_LEDGER = './nomark-ledger.jsonl'

function bar(value: number, width = 10): string {
  const filled = Math.round(value * width)
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function profileCommand(flags: Record<string, string | boolean>): void {
  const ledgerPath = typeof flags['ledger'] === 'string' ? flags['ledger'] : DEFAULT_LEDGER

  if (!fs.existsSync(ledgerPath)) {
    console.log('No ledger found. Run: npx nomark import --platform <platform> --file <export>')
    return
  }

  const content = fs.readFileSync(ledgerPath, 'utf8')
  const entries = parseLedger(content)

  if (entries.length === 0) {
    console.log('Ledger is empty. Import some data first.')
    return
  }

  const resolver = createResolver({ entries })
  const result = resolver.resolveAll()

  // Count signals needing review
  const staged = entries.filter(e => e.type === 'pref' && (e.data as Record<string, unknown>).staged === true)

  console.log()
  console.log('  Your Communication Profile')
  console.log()

  const dims = Object.entries(result.dimensions)
  if (dims.length === 0) {
    console.log('  No preferences detected yet.')
  } else {
    const maxDimLen = Math.max(...dims.map(([d]) => d.length))
    const maxTargetLen = Math.max(...dims.map(([, r]) => (r.winner?.target ?? 'unknown').length))

    for (const [dim, dimResult] of dims) {
      if (!dimResult.winner) continue
      const target = dimResult.winner.target
      const score = dimResult.winner._effective_w
      const dimPad = dim.padEnd(maxDimLen)
      const targetPad = capitalize(target).padEnd(maxTargetLen + 1)
      console.log(`  ${capitalize(dimPad)}:  ${targetPad} ${bar(score)}  ${score.toFixed(2)}`)
    }
  }

  // Show defaults
  if (result.defaults.length > 0) {
    console.log()
    for (const def of result.defaults) {
      console.log(`  Default ${def.field}: ${def.default} (${(def.accuracy * 100).toFixed(0)}% accurate)`)
    }
  }

  console.log()
  if (staged.length > 0) {
    console.log(`  ${staged.length} signals need confirmation. Run: npx nomark review`)
  }
  console.log()
}
