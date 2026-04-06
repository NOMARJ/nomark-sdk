/**
 * Critical-Field Gate (MEE Spec Module 6).
 *
 * Schema-level inference tiers that prevent autonomous agent action on high-risk fields.
 */

export type InferenceTier = 1 | 2 | 3

export type FieldClassification = {
  field: string
  tier: InferenceTier
  tierName: 'inferable' | 'defaultable' | 'critical_ask'
}

export type RequestTypeSchema = {
  inferable: string[]
  defaultable: string[]
  critical_ask: string[]
}

const BUILTIN_SCHEMAS: Record<string, RequestTypeSchema> = {
  creative: {
    inferable: ['tone', 'format', 'structure', 'sections', 'length'],
    defaultable: ['audience', 'depth', 'style_referent'],
    critical_ask: ['content_facts', 'send_target', 'claims', 'figures'],
  },
  decision: {
    inferable: ['format'],
    defaultable: ['criteria_weights'],
    critical_ask: ['options', 'constraints', 'stakeholders'],
  },
  communication: {
    inferable: ['tone', 'format', 'length'],
    defaultable: ['audience', 'channel'],
    critical_ask: ['recipient', 'content_facts', 'send_intent', 'commitments'],
  },
}

export function classifyField(
  field: string,
  requestType: string,
  customSchemas: Record<string, RequestTypeSchema> = {},
): FieldClassification {
  const schema = customSchemas[requestType] ?? BUILTIN_SCHEMAS[requestType]

  if (!schema) {
    // Unknown request type — default to critical_ask for safety
    return { field, tier: 3, tierName: 'critical_ask' }
  }

  if (schema.inferable.includes(field)) {
    return { field, tier: 1, tierName: 'inferable' }
  }
  if (schema.defaultable.includes(field)) {
    return { field, tier: 2, tierName: 'defaultable' }
  }
  if (schema.critical_ask.includes(field)) {
    return { field, tier: 3, tierName: 'critical_ask' }
  }

  // Unknown field — default to critical_ask for safety
  return { field, tier: 3, tierName: 'critical_ask' }
}

export type GateResult = {
  field: string
  tier: InferenceTier
  action: 'infer' | 'default' | 'ask'
  blocked: boolean
  reason?: string
}

/**
 * Evaluate the critical-field gate for a set of fields.
 * Returns which fields can be inferred, defaulted, or must be asked.
 */
export function evaluateGate(
  fields: string[],
  requestType: string,
  customSchemas: Record<string, RequestTypeSchema> = {},
): GateResult[] {
  return fields.map(field => {
    const classification = classifyField(field, requestType, customSchemas)

    switch (classification.tier) {
      case 1:
        return { field, tier: 1, action: 'infer' as const, blocked: false }
      case 2:
        return { field, tier: 2, action: 'default' as const, blocked: false }
      case 3:
        return {
          field, tier: 3, action: 'ask' as const, blocked: true,
          reason: `${field} is critical_ask for ${requestType} — cannot be inferred`,
        }
    }
  })
}

/**
 * Get all critical_ask fields for a request type.
 * These fields can never be fully inferred, regardless of history.
 */
export function getCriticalFields(
  requestType: string,
  customSchemas: Record<string, RequestTypeSchema> = {},
): string[] {
  const schema = customSchemas[requestType] ?? BUILTIN_SCHEMAS[requestType]
  return schema?.critical_ask ?? []
}
