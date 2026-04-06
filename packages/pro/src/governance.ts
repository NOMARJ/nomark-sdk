/**
 * Governance Engine (MEE Spec Module 7).
 *
 * Lifecycle stages, verification protocol, and audit trail.
 */

export type LifecycleStage = {
  name: string
  skills: string[]
  trustGate: number | null
  artifacts: string[]
}

export type LifecycleConfig = {
  name: string
  stages: LifecycleStage[]
}

export type StageStatus = 'pending' | 'active' | 'completed' | 'skipped'

export type LifecycleInstance = {
  config: LifecycleConfig
  currentStage: number
  stageStatuses: StageStatus[]
  artifacts: Map<string, string[]>
  auditTrail: AuditEntry[]
  startedAt: string
}

export type AuditEntry = {
  timestamp: string
  type: 'stage_advance' | 'verification' | 'completion' | 'breach' | 'gate_check'
  details: Record<string, unknown>
}

export function createLifecycle(config: LifecycleConfig, timestamp: string): LifecycleInstance {
  return {
    config,
    currentStage: 0,
    stageStatuses: config.stages.map((_, i) => i === 0 ? 'active' : 'pending'),
    artifacts: new Map(),
    auditTrail: [{
      timestamp,
      type: 'stage_advance',
      details: { from: null, to: config.stages[0]?.name ?? 'unknown' },
    }],
    startedAt: timestamp,
  }
}

export function checkTrustGate(instance: LifecycleInstance, trustScore: number): { pass: boolean; required: number | null } {
  const stage = instance.config.stages[instance.currentStage]
  if (!stage || stage.trustGate === null) return { pass: true, required: null }
  return { pass: trustScore >= stage.trustGate, required: stage.trustGate }
}

export function advanceStage(
  instance: LifecycleInstance,
  trustScore: number,
  timestamp: string,
): LifecycleInstance {
  const gate = checkTrustGate(instance, trustScore)
  if (!gate.pass) {
    return {
      ...instance,
      auditTrail: [...instance.auditTrail, {
        timestamp,
        type: 'gate_check',
        details: { stage: instance.config.stages[instance.currentStage]?.name, required: gate.required, actual: trustScore, result: 'blocked' },
      }],
    }
  }

  const nextStage = instance.currentStage + 1
  if (nextStage >= instance.config.stages.length) return instance

  const statuses = [...instance.stageStatuses]
  statuses[instance.currentStage] = 'completed'
  statuses[nextStage] = 'active'

  return {
    ...instance,
    currentStage: nextStage,
    stageStatuses: statuses,
    auditTrail: [...instance.auditTrail, {
      timestamp,
      type: 'stage_advance',
      details: {
        from: instance.config.stages[instance.currentStage]?.name,
        to: instance.config.stages[nextStage]?.name,
        trustScore,
      },
    }],
  }
}

export function recordArtifact(
  instance: LifecycleInstance,
  stageName: string,
  artifact: string,
): LifecycleInstance {
  const artifacts = new Map(instance.artifacts)
  const existing = artifacts.get(stageName) ?? []
  artifacts.set(stageName, [...existing, artifact])
  return { ...instance, artifacts }
}

export function recordVerification(
  instance: LifecycleInstance,
  storyId: string,
  command: string,
  exitCode: number,
  evidence: string,
  timestamp: string,
): LifecycleInstance {
  return {
    ...instance,
    auditTrail: [...instance.auditTrail, {
      timestamp,
      type: 'verification',
      details: { storyId, command, exitCode, evidence: evidence.slice(0, 500) },
    }],
  }
}

export function isComplete(instance: LifecycleInstance): boolean {
  return instance.stageStatuses.every(s => s === 'completed' || s === 'skipped')
}

export function currentStageName(instance: LifecycleInstance): string {
  return instance.config.stages[instance.currentStage]?.name ?? 'unknown'
}

/** Default code lifecycle matching the PRD */
export const CODE_LIFECYCLE: LifecycleConfig = {
  name: 'code',
  stages: [
    { name: 'discover', skills: ['brainstorming', 'empathy-engine'], trustGate: null, artifacts: [] },
    { name: 'plan', skills: ['plan_feature', 'plan_assessment'], trustGate: null, artifacts: ['plan.md'] },
    { name: 'build', skills: ['tdd', 'lifecycle'], trustGate: 0.5, artifacts: ['src/**'] },
    { name: 'verify', skills: ['uat-run', 'verification-before-completion'], trustGate: 0.5, artifacts: ['evidence.md'] },
    { name: 'ship', skills: ['deploy-pack', 'ship'], trustGate: 1.0, artifacts: ['release.md'] },
  ],
}
