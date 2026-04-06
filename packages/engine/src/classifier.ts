/**
 * Input Classification (MEE Spec Section 1.1).
 *
 * Tier 0: Pass-through — already resolved. Confirmations, selections, JSON, exit codes.
 * Tier 1: Routing — match to established pattern. Skill invocations, continuations, corrections.
 * Tier 2: Extraction — full intent reconstruction through resolver + gate.
 */

export type InputTier = 0 | 1 | 2

export type ClassificationResult = {
  tier: InputTier
  reason: string
}

export type ClassifierRule = {
  tier: InputTier
  test: (input: string) => boolean
  reason: string
}

const TIER_0_PATTERNS: ClassifierRule[] = [
  { tier: 0, test: (s) => /^(y|yes|no|n|ok|done|skip|cancel|approve|reject|confirm|confirmed)$/i.test(s.trim()), reason: 'confirmation' },
  { tier: 0, test: (s) => /^[0-9]+$/.test(s.trim()), reason: 'numeric_selection' },
  { tier: 0, test: (s) => { try { JSON.parse(s); return s.trim().startsWith('{') || s.trim().startsWith('[') } catch { return false } }, reason: 'json_data' },
  { tier: 0, test: (s) => /^(exit|quit|bye|stop)\s*$/i.test(s.trim()), reason: 'exit_signal' },
  { tier: 0, test: (s) => /^[a-f0-9]{6,40}$/i.test(s.trim()), reason: 'hash_or_id' },
]

const TIER_1_PATTERNS: ClassifierRule[] = [
  { tier: 1, test: (s) => /^\/\w/.test(s.trim()), reason: 'skill_invocation' },
  { tier: 1, test: (s) => /^(continue|go ahead|proceed|next|keep going|resume)\s*$/i.test(s.trim()), reason: 'continuation' },
  { tier: 1, test: (s) => /^(no[,.]?\s+(not that|wrong|different|the other|I meant))/i.test(s.trim()), reason: 'correction' },
  { tier: 1, test: (s) => /^(actually|wait|hold on|scratch that|never\s?mind)/i.test(s.trim()), reason: 'correction' },
  { tier: 1, test: (s) => s.trim().length > 0 && s.trim().length <= 3 && /^[a-z]$/i.test(s.trim()), reason: 'letter_selection' },
]

/**
 * Classify input into Tier 0 (pass-through), Tier 1 (routing), or Tier 2 (extraction).
 *
 * Classification determines computational resources allocated. Tier 0 and 1 inputs
 * do not consume Signal Units.
 *
 * Custom rules are evaluated first and can override defaults.
 */
export function classify(input: string, customRules: ClassifierRule[] = []): ClassificationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { tier: 0, reason: 'empty_input' }
  }

  // Custom rules take priority
  for (const rule of customRules) {
    if (rule.test(trimmed)) {
      return { tier: rule.tier, reason: rule.reason }
    }
  }

  // Tier 0 checks
  for (const rule of TIER_0_PATTERNS) {
    if (rule.test(trimmed)) {
      return { tier: rule.tier, reason: rule.reason }
    }
  }

  // Tier 1 checks
  for (const rule of TIER_1_PATTERNS) {
    if (rule.test(trimmed)) {
      return { tier: rule.tier, reason: rule.reason }
    }
  }

  // Default: Tier 2 (substantive NL requiring full extraction)
  return { tier: 2, reason: 'substantive_input' }
}
