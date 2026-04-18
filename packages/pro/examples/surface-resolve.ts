/**
 * Example: resolve a surface composition to a React Dashboard.tsx.
 *
 * Run: npx tsx examples/surface-resolve.ts
 */

import { resolve, type Composition } from '@nomark-ai/pro'

const dashboard: Composition = {
  name: 'fund_flow_dashboard',
  version: '0.1.0',
  description: 'Read-model dashboard — monitor fund flows.',
  verbs: [
    {
      id: 'outcome',
      verb: 'MONITOR',
      params: {
        subject: 'fund flows',
        data: ['aum_total', 'flow_by_fund'],
        refresh: { value: 5, unit: 'm' },
      },
    },
    {
      id: 'layout',
      verb: 'ARRANGE',
      params: {
        type: 'grid',
        density: 'compact',
        children: ['metric_aum', 'chart_flows'],
      },
    },
    {
      id: 'metric_aum',
      verb: 'DISPLAY',
      params: {
        type: 'metric',
        emphasis: 'hero',
        data: 'aum_total',
        label: 'Total AUM',
      },
    },
    {
      id: 'chart_flows',
      verb: 'DISPLAY',
      params: {
        type: 'chart',
        emphasis: 'standard',
        data: 'flow_by_fund',
      },
    },
    {
      id: 'loading',
      verb: 'STATUS',
      params: { type: 'loading', message: 'Fetching fund flows...' },
    },
    {
      id: 'anomaly_hint',
      verb: 'GUIDE',
      params: {
        type: 'alert',
        message: 'Anomalous outflow detected',
        priority: 'primary',
      },
    },
  ],
}

const output = resolve(dashboard, 'react')

console.log('=== resolve(dashboard, "react") ===')
for (const file of output.files) {
  console.log(`\n--- ${file.path} (${file.content.length} chars) ---`)
  console.log(file.content)
}

if (output.warnings.length > 0) {
  console.log('\n=== warnings ===')
  for (const w of output.warnings) {
    console.log(`- ${w.code}: ${w.message}`)
  }
}
