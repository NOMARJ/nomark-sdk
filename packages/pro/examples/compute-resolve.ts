/**
 * Example: resolve a compute composition to TypeScript.
 *
 * Run: npx tsx examples/compute-resolve.ts
 */

import { resolve, type Composition } from '@nomark-ai/pro'

const composition: Composition = {
  name: 'daily_fund_flow_etl',
  version: '0.1.0',
  description: 'Fetch → validate → project → upsert — a minimal compute pipeline.',
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
        rules: [
          { field: 'fund_id', check: 'required' },
          { field: 'flow_usd', check: 'numeric' },
        ],
        on_fail: { action: 'reject' },
      },
    },
    {
      id: 'project_fields',
      verb: 'MAP',
      params: {
        expression: '{ fund_id: fund_id, flow_usd: flow_usd }',
        project: { fund_id: 'fund_id', flow_usd: 'flow_usd' },
      },
    },
    {
      id: 'upsert_rows',
      verb: 'PERSIST',
      params: {
        sink: { type: 'sql', config: { table: 'fund_flow_daily' } },
        mode: 'insert',
      },
    },
  ],
}

const output = resolve(composition, 'typescript')

console.log('=== resolve(composition, "typescript") ===')
for (const file of output.files) {
  console.log(`\n--- ${file.path} (${file.content.length} chars) ---`)
  console.log(file.content)
}

if (output.warnings.length > 0) {
  console.log('\n=== warnings ===')
  for (const w of output.warnings) {
    console.log(`- ${w.code}: ${w.message}`)
  }
} else {
  console.log('\nNo warnings.')
}
