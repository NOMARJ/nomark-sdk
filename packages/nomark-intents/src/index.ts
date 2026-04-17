/**
 * @nomark/intents — NOMARK Intents Specification v0.4 SDK
 *
 * 31 verbs + 1 grammar rule. Computation and surface, unified.
 *
 * The interlingua between meaning and execution. LLMs are the
 * first-class user — this SDK ships the types, builders, and
 * validators that make intents machine-authorable.
 *
 * Open specification (Apache 2.0). Verified resolvers are sold
 * separately under BSL 1.1.
 */

// Types
export type * from './types/index.js';

// Verb builders (31 factories + generic verb())
export * from './verbs/index.js';

// Grammar verb: COMPOSE
export * from './compose/index.js';

// Validators and flatten compiler
export * from './validator/index.js';

// Lifecycle layer
export * from './lifecycle/index.js';

// Canonical registry (semantic IDs, categories, signatures)
export * from './registry/index.js';

/** SDK version (mirrors the spec version it implements). */
export const SPEC_VERSION = '0.4.0' as const;
