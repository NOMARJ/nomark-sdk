import * as fs from 'node:fs'
import { parseLedger } from '../ledger.js'

const DEFAULT_LEDGER = './nomark-ledger.jsonl'

export function reviewCommand(flags: Record<string, string | boolean>): void {
  const ledgerPath = typeof flags['ledger'] === 'string' ? flags['ledger'] : DEFAULT_LEDGER

  if (!fs.existsSync(ledgerPath)) {
    console.log('No ledger found. Run: npx nomark import first.')
    return
  }

  const content = fs.readFileSync(ledgerPath, 'utf8')
  const entries = parseLedger(content)

  const staged = entries.filter(e =>
    (e.type === 'pref' || e.type === 'map') &&
    (e.data as Record<string, unknown>).staged === true
  )

  if (staged.length === 0) {
    console.log('No signals need review. Your preference model is clean.')
    return
  }

  console.log()
  console.log(`  ${staged.length} signals need confirmation:`)
  console.log()

  for (let i = 0; i < staged.length; i++) {
    const entry = staged[i]!
    if (entry.type === 'pref') {
      const data = entry.data as Record<string, unknown>
      console.log(`  ${i + 1}. [pref] ${data['dim']}: ${data['target']} (${data['n']} observations, weight ${data['w']})`)
    } else if (entry.type === 'map') {
      const data = entry.data as Record<string, unknown>
      const intent = Array.isArray(data['intent']) ? (data['intent'] as string[]).join(', ') : ''
      console.log(`  ${i + 1}. [map] "${data['trigger']}" -> ${intent} (${data['n']} observations)`)
    }
  }

  console.log()
  console.log('  Low-confidence signals decay faster and are evicted first.')
  console.log('  To confirm: use the Preference Panel or continue using NOMARK — signals strengthen with use.')
  console.log()
}
