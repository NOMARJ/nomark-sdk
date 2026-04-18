/**
 * Surface-only fixture composition for SUR-000 React contract.
 *
 * 6 verbs exercising 5 surface classes (MONITOR + ARRANGE + 2×DISPLAY +
 * STATUS + GUIDE). Reverse-engineered from the approved
 * `__fixtures__/expected/react/Dashboard.tsx` — see `REACT_STYLE.md` for
 * the params→JSX mapping contract.
 *
 * Hermetic: resolver tests import FIXTURE_SURFACE_COMPOSITION from here,
 * NOT from `@nomark/intents/examples/fund-dashboard.ts`. The canonical
 * SDK example is free to evolve; surface resolver tests stay reproducible.
 */

import type { Composition } from '../../../src/resolvers/core/ir.js'

export const FIXTURE_SURFACE_COMPOSITION: Composition = {
  name: 'fund_flow_dashboard',
  version: '0.4.0',
  description: 'Read-model dashboard for fund flow monitoring.',
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
      params: {
        type: 'loading',
        message: 'Fetching fund flows...',
      },
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
