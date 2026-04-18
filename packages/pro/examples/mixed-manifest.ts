/**
 * Example: resolveAll across a mix of compute and surface targets.
 *
 * The same composition emits TypeScript (compute) and React (surface) in one
 * call. Each target lands in its own folder in the manifest.
 *
 * Run: npx tsx examples/mixed-manifest.ts
 */

import { resolveAll, type Composition } from '@nomark-ai/pro'

// A composition that carries both compute and surface verbs. Compute resolvers
// strip the surface verbs (with a VERBS_STRIPPED warning); the React resolver
// does the reverse. Resolvers never fail on a mixed composition — they take
// what they can and warn about what they can't.
const composition: Composition = {
  name: 'fund_flow_app',
  version: '0.1.0',
  description: 'Fetch + validate (compute) + Dashboard (surface).',
  verbs: [
    {
      id: 'fetch_rows',
      verb: 'FETCH',
      params: {
        source: { type: 'http', config: { url: 'https://api.example.com/fund-flows/daily' } },
      },
    },
    {
      id: 'validate_rows',
      verb: 'VALIDATE',
      params: {
        rules: [{ field: 'fund_id', check: 'required' }],
        on_fail: { action: 'reject' },
      },
    },
    {
      id: 'outcome',
      verb: 'MONITOR',
      params: {
        subject: 'fund flows',
        data: ['aum_total'],
        refresh: { value: 5, unit: 'm' },
      },
    },
    {
      id: 'layout',
      verb: 'ARRANGE',
      params: { type: 'grid', density: 'compact', children: ['metric_aum'] },
    },
    {
      id: 'metric_aum',
      verb: 'DISPLAY',
      params: { type: 'metric', emphasis: 'hero', data: 'aum_total', label: 'Total AUM' },
    },
  ],
}

const manifest = resolveAll(
  composition,
  ['typescript', 'python', 'react'],
  { basePath: 'out' },
)

console.log('=== manifest ===')
console.log(JSON.stringify(manifest, null, 2))

console.log('\n=== summary ===')
console.log(`composition : ${manifest.composition} v${manifest.version}`)
console.log(`generated   : ${manifest.generated_at}`)
for (const target of manifest.targets) {
  const warn = target.warnings.length
  console.log(
    `${target.label.padEnd(12)} ${target.files.length} file(s), ${warn} warning(s)`,
  )
  for (const f of target.files) {
    console.log(`    ${f.path}  (${f.bytes} chars)`)
  }
}
