/**
 * Worked example 7.3 — Trade Approval.
 *
 * Computation + surface + lifecycle. Blocking gate for human decision,
 * evidence-rich DECIDE outcome, routing on approval / amend / reject.
 */

import {
  ARRANGE,
  BRANCH,
  COLLECT,
  DECIDE,
  DISPLAY,
  EMIT,
  FETCH,
  GATE,
  GUIDE,
  PERSIST,
  STATUS,
  VALIDATE,
  compose,
} from '../index.js';

export const TRADE_APPROVAL = compose({
  name: 'TRADE_APPROVAL',
  version: '1.0.0',
  description:
    'Human-in-the-loop trade approval with compliance, credit, and market evidence.',
  input_schema: { $ref: '#/schemas/pending_order' },
  output_schema: { $ref: '#/schemas/trade_decision' },
  entities: {
    order: { schema: { $ref: '#/schemas/order' }, role: 'primary' },
    audit: { schema: { $ref: '#/schemas/audit_event' }, role: 'affected' },
  },
  verbs: [
    // ── Outcome ────────────────────────────────────────────────
    DECIDE('outcome', {
      question: 'Execute trade?',
      options: [
        { id: 'approve', label: 'Approve' },
        { id: 'reject', label: 'Reject' },
        { id: 'amend', label: 'Amend & Resubmit' },
      ],
      evidence: ['compliance_result', 'credit_result', 'market_data'],
      deadline: { value: 30, unit: 'm' },
      default: 'reject',
    }),

    // ── Evidence gathering ─────────────────────────────────────
    FETCH('fetch_order', {
      source: {
        type: 'queue',
        config: { topic: 'orders.pending_approval' },
      },
    }),
    VALIDATE('compliance', {
      rules: { $ref: '#/rules/pre_trade_compliance' },
      on_fail: { action: 'route', target: 'reject_order' },
    }),
    VALIDATE('credit', {
      rules: { $ref: '#/rules/credit_limit' },
      on_fail: { action: 'route', target: 'reject_order' },
    }),
    FETCH('market', {
      source: {
        type: 'api',
        config: { endpoint: '/market/quote/:ticker' },
      },
    }),

    // ── Layout ─────────────────────────────────────────────────
    ARRANGE('layout', {
      type: 'split',
      children: ['evidence_panel', 'action_panel'],
    }),
    ARRANGE('evidence_panel', {
      type: 'stack',
      children: [
        'order_detail',
        'compliance_display',
        'credit_display',
        'market_display',
      ],
    }),
    DISPLAY('order_detail', { type: 'detail', data: 'fetch_order' }),
    DISPLAY('compliance_display', {
      type: 'card',
      data: 'compliance',
      emphasis: 'standard',
    }),
    DISPLAY('credit_display', { type: 'card', data: 'credit' }),
    DISPLAY('market_display', { type: 'chart', data: 'market' }),
    COLLECT('action_panel', {
      type: 'select',
      field: 'decision',
      label: 'Decision',
      required: true,
    }),

    // ── Respond ────────────────────────────────────────────────
    GUIDE('confirm_action', {
      type: 'next_action',
      message: 'Review evidence then approve, reject, or amend',
      priority: 'primary',
    }),
    STATUS('countdown', {
      type: 'warning',
      message: 'Auto-reject in {remaining}',
      dismiss: { value: 30, unit: 'm' },
    }),

    // ── Gate + routing ─────────────────────────────────────────
    GATE('gate', {
      assignee: { type: 'role', id: 'portfolio_manager' },
      prompt: 'Approve trade?',
      timeout: { value: 30, unit: 'm' },
      on_timeout: 'auto_reject',
    }),
    BRANCH('route', {
      conditions: [
        { test: "decision == 'approve'", then: 'execute' },
        { test: "decision == 'amend'", then: 'amend_flow' },
      ],
      default: 'reject_order',
    }),

    // ── Terminals ──────────────────────────────────────────────
    PERSIST(
      'execute',
      {
        sink: { type: 'queue', config: { topic: 'orders.approved' } },
        mode: 'insert',
      },
      { entity: 'order' },
    ),
    EMIT('reject_order', {
      target: { type: 'queue', config: { topic: 'orders.rejected' } },
    }),
    EMIT('auto_reject', {
      target: { type: 'queue', config: { topic: 'orders.rejected' } },
    }),
    EMIT('amend_flow', {
      target: { type: 'queue', config: { topic: 'orders.amend' } },
    }),
  ],
  compensations: {
    execute: 'reject_order',
  },
  target: { compute: 'typescript', surface: 'react' },
});
