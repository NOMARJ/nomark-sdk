/**
 * Worked example 7.4 — Deploy Pipeline with Dashboard.
 *
 * Computation + surface. Build, test, stage, smoke, promote, health-check,
 * with automatic rollback on health failure and a human DECIDE hook for
 * manual rollback while traffic is live.
 */

import {
  ARRANGE,
  AWAIT,
  COMPENSATE,
  DECIDE,
  DISPLAY,
  EMIT,
  FETCH,
  GUIDE,
  MONITOR,
  PERSIST,
  STATUS,
  VALIDATE,
  compose,
} from '../index.js';

export const DEPLOY_WITH_DASHBOARD = compose({
  name: 'DEPLOY_WITH_DASHBOARD',
  version: '1.0.0',
  description:
    'CI-triggered deploy with progressive promotion and compensation-based rollback.',
  input_schema: { $ref: '#/schemas/deploy_request' },
  output_schema: { $ref: '#/schemas/deploy_result' },
  entities: {
    deployment: {
      schema: { $ref: '#/schemas/deployment' },
      role: 'primary',
    },
    release_notes: {
      schema: { $ref: '#/schemas/release_notes' },
      role: 'affected',
    },
  },
  verbs: [
    // ── Outcome ────────────────────────────────────────────────
    MONITOR('outcome', {
      subject: 'deployment',
      data: ['build_status', 'test_results', 'health'],
      refresh: 'realtime',
      alerts: [
        {
          condition: 'health_check_failed',
          severity: 'critical',
          action: 'rollback_confirm',
        },
      ],
    }),

    // ── Pipeline ───────────────────────────────────────────────
    AWAIT('trigger', {
      on: { type: 'webhook', config: { path: '/deploy' } },
    }),
    FETCH('build', {
      source: { type: 'api', config: { endpoint: '/ci/build' } },
    }),
    VALIDATE('test', {
      rules: { $ref: '#/rules/test_suite' },
      on_fail: { action: 'route', target: 'test_failure' },
    }),
    PERSIST(
      'stage',
      {
        sink: { type: 'api', config: { endpoint: '/k8s/staging' } },
        mode: 'replace',
      },
      { entity: 'deployment' },
    ),
    VALIDATE('smoke', {
      rules: { $ref: '#/rules/smoke_tests' },
      on_fail: { action: 'route', target: 'auto_rollback' },
    }),
    PERSIST(
      'promote',
      {
        sink: { type: 'api', config: { endpoint: '/k8s/production' } },
        mode: 'replace',
      },
      { entity: 'deployment' },
    ),
    VALIDATE('health', {
      rules: { $ref: '#/rules/health_check' },
      on_fail: { action: 'route', target: 'auto_rollback' },
    }),

    // ── Surface ────────────────────────────────────────────────
    ARRANGE('layout', {
      type: 'stack',
      children: ['progress_steps', 'live_health', 'action_area'],
    }),
    STATUS('progress_steps', {
      type: 'loading',
      message: 'Deploying...',
      detail: 'current_step',
    }),
    DISPLAY('live_health', {
      type: 'chart',
      data: 'health',
      emphasis: 'standard',
    }),
    GUIDE('action_area', {
      type: 'next_action',
      message: 'Rollback available',
      condition: "stage == 'live'",
      action: 'rollback_confirm',
    }),

    // ── Rollback paths ─────────────────────────────────────────
    DECIDE('rollback_confirm', {
      question: 'Rollback to previous version?',
      options: [
        { id: 'rollback', label: 'Rollback' },
        { id: 'continue', label: 'Keep Current' },
      ],
      evidence: ['live_health'],
    }),
    COMPENSATE('auto_rollback', {
      receipt: ':promote.receipt',
      action: 'restore_previous',
    }),
    PERSIST(
      'restore_previous',
      {
        sink: { type: 'api', config: { endpoint: '/k8s/production' } },
        mode: 'replace',
        idempotency_key: 'rollback',
      },
      { entity: 'deployment' },
    ),
    PERSIST(
      'restore_staging',
      {
        sink: { type: 'api', config: { endpoint: '/k8s/staging' } },
        mode: 'replace',
        idempotency_key: 'rollback-staging',
      },
      { entity: 'deployment' },
    ),
    EMIT('test_failure', {
      target: { type: 'slack', config: { channel: '#deployments' } },
    }),
    EMIT('done', {
      target: { type: 'slack', config: { channel: '#deployments' } },
    }),
  ],
  compensations: {
    promote: 'restore_previous',
    stage: 'restore_staging',
  },
  target: { compute: 'python', surface: 'react' },
});
