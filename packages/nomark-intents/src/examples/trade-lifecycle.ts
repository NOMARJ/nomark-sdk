/**
 * Example lifecycle — Trade Order.
 *
 * Demonstrates a mirror-pair lifecycle (BUY ↔ SELL) with progression
 * (DRAFT → PENDING → APPROVED → SETTLED) and branching (PENDING → REJECTED).
 */

import { LIFECYCLE } from '../lifecycle/index.js';
import { TRADE_APPROVAL } from './trade-approval.js';
import { DAILY_FUND_FLOW_ETL } from './etl-pipeline.js';

export const TRADE_LIFECYCLE = LIFECYCLE({
  name: 'trade_order',
  domain: 'trading',
  version: '1.0.0',
  entity: { $ref: '#/schemas/trade_order' },
  states: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SETTLED', 'REVERSED'],
  operations: {
    // Re-use the approval composition as the PENDING → APPROVED path.
    approve_trade: TRADE_APPROVAL,
    // Placeholder — in a real system each of these would be its own composition.
    submit_trade: DAILY_FUND_FLOW_ETL,
    reject_trade: DAILY_FUND_FLOW_ETL,
    settle_trade: DAILY_FUND_FLOW_ETL,
    reverse_trade: DAILY_FUND_FLOW_ETL,
  },
  transitions: [
    { from: 'DRAFT', via: 'submit_trade', to: 'PENDING' },
    { from: 'PENDING', via: 'approve_trade', to: 'APPROVED' },
    { from: 'PENDING', via: 'reject_trade', to: 'REJECTED' },
    { from: 'APPROVED', via: 'settle_trade', to: 'SETTLED' },
    { from: 'SETTLED', via: 'reverse_trade', to: 'REVERSED' },
  ],
});
