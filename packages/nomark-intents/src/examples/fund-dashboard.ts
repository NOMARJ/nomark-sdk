/**
 * Worked example 7.2 — Fund Flow Dashboard.
 *
 * Mixed computation + surface. The same ETL data, presented as an
 * interactive dashboard. Resolver splits by target tag:
 *   - React  → responsive dashboard with charts + data table + toasts
 *   - API    → JSON { aum_total, flow_by_fund, recent_flows, alerts }
 *   - Slack  → formatted summary card with @mentions on anomaly
 *   - CLI    → ASCII table with highlighted anomalies
 *   - PDF    → formatted report with charts and tables
 */

import {
  ARRANGE,
  DISPLAY,
  FETCH,
  GUIDE,
  MONITOR,
  REDUCE,
  STATUS,
  compose,
} from '../index.js';

export const FUND_FLOW_DASHBOARD = compose({
  name: 'FUND_FLOW_DASHBOARD',
  version: '1.0.0',
  description:
    'Read-model dashboard for fund flow monitoring with anomaly alerts and drill-down.',
  input_schema: { $ref: '#/schemas/date_range' },
  output_schema: { $ref: '#/schemas/dashboard_view' },
  verbs: [
    // ── Outcome ────────────────────────────────────────────────
    MONITOR('outcome', {
      subject: 'fund flows',
      data: ['aum_total', 'flow_by_fund', 'recent_flows'],
      refresh: { value: 5, unit: 'm' },
      alerts: [
        {
          condition: 'net_flow < -1000000',
          severity: 'critical',
          action: 'anomaly_detail',
        },
      ],
    }),

    // ── Computation ────────────────────────────────────────────
    FETCH('fetch_flows', {
      source: {
        type: 'sql',
        config: {
          query:
            'SELECT * FROM fund_flows_daily WHERE date BETWEEN :start AND :end',
        },
      },
    }),
    REDUCE('aum_total', {
      expression: 'sum(amount)',
    }),
    REDUCE('flow_by_fund', {
      expression: 'group_by(fund_id).sum(amount)',
    }),

    // ── Presentation ───────────────────────────────────────────
    ARRANGE('layout', {
      type: 'grid',
      density: 'compact',
      children: ['metric_aum', 'chart_flows', 'table_recent'],
    }),
    DISPLAY('metric_aum', {
      type: 'metric',
      data: 'aum_total',
      emphasis: 'hero',
      label: 'Total AUM',
    }),
    DISPLAY('chart_flows', {
      type: 'chart',
      data: 'flow_by_fund',
      emphasis: 'standard',
      interact: [{ on: 'click', action: 'fund_detail' }],
    }),
    DISPLAY('table_recent', {
      type: 'table',
      data: 'recent_flows',
      interact: [{ on: 'click', action: 'flow_detail' }],
    }),

    // ── Respond ────────────────────────────────────────────────
    STATUS('loading', {
      type: 'loading',
      message: 'Fetching fund flows...',
    }),
    STATUS('empty', {
      type: 'empty',
      message: 'No flows for this period',
      action: 'adjust_date_range',
    }),
    GUIDE('anomaly_hint', {
      type: 'alert',
      message: 'Anomalous outflow detected',
      condition: 'net_flow < -1000000',
      action: 'anomaly_detail',
      priority: 'primary',
    }),

    // ── Referenced but unimplemented targets ───────────────────
    // In real code these would be separate ComposedUnits.
    // They're stubbed here as no-op STATUS verbs so the validator
    // sees them as declared and cross-references resolve.
    STATUS('fund_detail', { type: 'info', message: 'fund detail view' }),
    STATUS('flow_detail', { type: 'info', message: 'flow detail view' }),
    STATUS('anomaly_detail', { type: 'warning', message: 'anomaly detail' }),
    STATUS('adjust_date_range', { type: 'info', message: 'adjust dates' }),
  ],
  target: { compute: 'python', surface: 'react' },
});
