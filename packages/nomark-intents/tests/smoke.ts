import { validate, flatten } from '../src/index.js';
import {
  DAILY_FUND_FLOW_ETL,
  TRADE_APPROVAL,
} from '../src/examples/index.js';

console.log('=== DAILY_FUND_FLOW_ETL ===');
console.log(`name: ${DAILY_FUND_FLOW_ETL.compose}`);
console.log(`version: ${DAILY_FUND_FLOW_ETL.version}`);
console.log(`verbs: ${DAILY_FUND_FLOW_ETL.verbs.length}`);
console.log(`first verb: ${DAILY_FUND_FLOW_ETL.verbs[0]!.verb} / ${DAILY_FUND_FLOW_ETL.verbs[0]!.id}`);

const r = validate(DAILY_FUND_FLOW_ETL);
console.log(`validation: ok=${r.ok}, warnings=${r.warnings.length}, errors=${r.errors.length}`);

console.log('\n=== TRADE_APPROVAL JSON (truncated) ===');
const json = JSON.stringify(TRADE_APPROVAL, null, 2);
console.log(json.slice(0, 400));
console.log(`... (${json.length} chars total)`);

console.log('\n=== flatten no-op ===');
const flat = flatten(DAILY_FUND_FLOW_ETL);
console.log(`flattened verbs: ${flat.verbs.length}`);
