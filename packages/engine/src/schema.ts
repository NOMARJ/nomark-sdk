import { z } from 'zod'

// --- Enums as string literal unions ---

export type Context = 'chat' | 'cowork' | 'code'
export type Outcome = 'accepted' | 'edited' | 'corrected' | 'rejected' | 'abandoned' | 'unknown'
export type RequestType = 'question' | 'task' | 'brainstorm' | 'decision' | 'critique' | 'creative' | 'continuation' | 'reaction'
export type PatternType = 'rewrite_request' | 'scope_change' | 'quality_complaint' | 'format_request' | 'style_override' | 'abort' | 'custom'
export type RubricStage = 'ephemeral' | 'pending' | 'proven' | 'trusted'
export type SignalType = 'meta' | 'pref' | 'map' | 'asn' | 'rub'

export type Scope = string // '*' | 'context:{ctx}' | 'topic:{topic}' | compound 'context:{ctx}+topic:{topic}'

// --- Zod schemas ---

const IsoDatePattern = /^\d{4}-\d{2}-\d{2}$/
const IsoDatetimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

const IsoDate = z.string().regex(IsoDatePattern)
const IsoDatetime = z.string().regex(IsoDatetimePattern)

const ContextSchema = z.enum(['chat', 'cowork', 'code'])
const OutcomeSchema = z.enum(['accepted', 'edited', 'corrected', 'rejected', 'abandoned', 'unknown'])
const RequestTypeSchema = z.enum(['question', 'task', 'brainstorm', 'decision', 'critique', 'creative', 'continuation', 'reaction'])
const PatternTypeSchema = z.enum(['rewrite_request', 'scope_change', 'quality_complaint', 'format_request', 'style_override', 'abort', 'custom'])
const RubricStageSchema = z.enum(['ephemeral', 'pending', 'proven', 'trusted'])

const ContextCountsSchema = z.object({
  chat: z.number().int().optional(),
  code: z.number().int().optional(),
  cowork: z.number().int().optional(),
})

export const SigPrefSchema = z.object({
  dim: z.string(),
  target: z.string(),
  w: z.number().min(0).max(1),
  n: z.number().int().min(0),
  src: ContextCountsSchema,
  ctd: z.number().int().min(0),
  scope: z.string(),
  decay: z.number().min(0).max(1),
  last: IsoDate,
  staged: z.boolean().optional(),
  note: z.string().optional(),
  source_quote: z.string().optional(),
  source_scope: z.string().optional(),
})

export const SigMapSchema = z.object({
  trigger: z.string(),
  pattern_type: PatternTypeSchema,
  intent: z.array(z.string()),
  neg: z.array(z.string()).optional(),
  conf: z.number().min(0).max(1),
  n: z.number().int().min(0),
  scope: z.string().optional(),
  last: IsoDate,
})

export const SigAsnSchema = z.object({
  field: z.string(),
  default: z.string(),
  accuracy: z.number().min(0).max(1),
  total: z.number().int().min(0),
  correct: z.number().int().min(0),
  last: IsoDate,
})

export const SigMetaSchema = z.object({
  profile: z.record(z.string(), z.unknown()),
  signals: z.number().int().min(0),
  by_ctx: ContextCountsSchema,
  by_out: z.object({
    accepted: z.number().int().optional(),
    edited: z.number().int().optional(),
    corrected: z.number().int().optional(),
    rejected: z.number().int().optional(),
    abandoned: z.number().int().optional(),
  }),
  avg_conf: z.number().min(0).max(1),
  avg_q: z.number().min(0),
  updated: IsoDate,
})

export const SigRubSchema = z.object({
  id: z.string(),
  fmt: z.string(),
  stage: RubricStageSchema,
  uses: z.number().int().min(0),
  accepts: z.number().int().min(0),
  avg_ed: z.number().min(0),
  dims: z.record(z.string(), z.number().min(0).max(1)),
  min: z.number(),
  ref: z.string().optional(),
  last: IsoDate,
})

export const ArchiveEventSchema = z.object({
  id: z.string().regex(/^sig-/),
  timestamp: IsoDatetime,
  context: ContextSchema,
  session_id: z.string(),
  input_tier: z.number().int().min(0).max(2),
  request_type: RequestTypeSchema.optional(),
  input_summary: z.string().optional(),
  intent_confidence: z.number().min(0).max(1).optional(),
  assumptions: z.array(z.object({
    field: z.string(),
    value: z.string(),
    source: z.string(),
    correct: z.boolean().optional(),
  })).optional(),
  questions_asked: z.number().int().min(0).optional(),
  output_type: z.string().optional(),
  rubric_id: z.string().optional(),
  self_eval_score: z.number().optional(),
  outcome: OutcomeSchema,
  outcome_confidence: z.number().min(0).max(1).optional(),
  edit_distance: z.number().min(0).optional(),
  correction: z.string().nullable().optional(),
  resolver_decisions: z.array(z.object({
    dim: z.string(),
    winner: z.string(),
    score: z.number(),
    runner_up: z.string().optional(),
  })).optional(),
  preference_updates: z.array(z.object({
    dim: z.string(),
    delta: z.number(),
    reason: z.string().optional(),
  })).optional(),
})

export const LedgerEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meta'), data: SigMetaSchema }),
  z.object({ type: z.literal('pref'), data: SigPrefSchema }),
  z.object({ type: z.literal('map'), data: SigMapSchema }),
  z.object({ type: z.literal('asn'), data: SigAsnSchema }),
  z.object({ type: z.literal('rub'), data: SigRubSchema }),
])

// --- Inferred types ---

export type SigPref = z.infer<typeof SigPrefSchema>
export type SigMap = z.infer<typeof SigMapSchema>
export type SigAsn = z.infer<typeof SigAsnSchema>
export type SigMeta = z.infer<typeof SigMetaSchema>
export type SigRub = z.infer<typeof SigRubSchema>
export type ArchiveEvent = z.infer<typeof ArchiveEventSchema>
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>
