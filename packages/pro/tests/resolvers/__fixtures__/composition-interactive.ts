/**
 * W6 fixture composition — interactive admin console.
 *
 * 8-verb composition exercising all 6 outcome surface verbs (DECIDE,
 * CONFIGURE, EXPLORE, AUTHOR, ONBOARD, COLLECT) wrapped by MONITOR + ARRANGE.
 * The composition is interactive — backends detect the outcome verbs and
 * emit the dispatch-aware Dashboard signature per W6_DESIGN §7 path A.
 *
 * Read-model fixtures (FIXTURE_SURFACE_COMPOSITION) stay byte-exact — they
 * have no interactive verbs and emit the original (state)-only signature.
 */

import type { Composition } from '../../../src/resolvers/core/ir.js'

export const FIXTURE_INTERACTIVE_COMPOSITION: Composition = {
  name: 'admin_console',
  version: '0.4.0',
  description: 'Interactive admin console: configure thresholds, decide on approvals, explore audit log, author rules, onboard new admins.',
  verbs: [
    {
      id: 'admin_view',
      verb: 'MONITOR',
      params: {
        subject: 'admin operations',
        data: ['threshold_usd', 'pending_approvals'],
        refresh: { value: 1, unit: 's' },
      },
    },
    {
      id: 'tabs',
      verb: 'ARRANGE',
      params: {
        type: 'tabs',
        density: 'comfortable',
        children: [
          'threshold_form',
          'approval_choice',
          'audit_search',
          'rule_editor',
          'admin_setup',
          'admin_email',
        ],
      },
    },
    {
      id: 'threshold_form',
      verb: 'CONFIGURE',
      params: {
        prompt: 'System thresholds',
        params: [
          { key: 'threshold_usd', type: 'number', label: 'Alert threshold (USD)' },
          { key: 'alert_channel', type: 'text', label: 'Alert channel' },
        ],
      },
    },
    {
      id: 'approval_choice',
      verb: 'DECIDE',
      params: {
        prompt: 'Approve this transaction?',
        options: [
          { value: 'approve', label: 'Approve' },
          { value: 'reject', label: 'Reject' },
        ],
      },
    },
    {
      id: 'audit_search',
      verb: 'EXPLORE',
      params: {
        prompt: 'Audit log',
        source: 'audit_log',
        placeholder: 'Search events...',
      },
    },
    {
      id: 'rule_editor',
      verb: 'AUTHOR',
      params: {
        prompt: 'Edit rule',
        schema: 'rules.v1',
        save_mode: 'manual',
      },
    },
    {
      id: 'admin_setup',
      verb: 'ONBOARD',
      params: {
        prompt: 'New admin setup',
        steps: [
          { id: 'profile', label: 'Profile' },
          { id: 'permissions', label: 'Permissions' },
          { id: 'review', label: 'Review' },
        ],
        progress_type: 'step',
      },
    },
    {
      id: 'admin_email',
      verb: 'COLLECT',
      params: {
        type: 'text',
        label: 'Admin email',
        name: 'email',
        required: true,
      },
    },
  ],
}
