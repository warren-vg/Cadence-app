// lib/opportunityScore.ts — Cadence Source of Truth v1.0
// All 6 collected inputs are now used. Urgency and moneyCost were previously
// silently ignored. Thresholds and weights are centralised here.

export interface OpportunityInputs {
  upside:     number
  alignment:  number
  urgency:    number
  timeCost:   number
  energyCost: number
  moneyCost:  number
}

export interface OpportunityResult {
  score:     number
  decision:  'accept' | 'defer' | 'reject'
  label:     string
  color:     string
  bg:        string
  icon:      string
  advice:    string
  rationale: string[]
}

export const OPPORTUNITY_THRESHOLDS = { ACCEPT: 60, DEFER: 40 } as const

export function calcOpportunityScore(inputs: OpportunityInputs): number {
  const benefitSum = inputs.upside * 0.40 + inputs.alignment * 0.35 + inputs.urgency * 0.10
  const costSum    = inputs.timeCost * 0.40 + inputs.energyCost * 0.35 + inputs.moneyCost * 0.10
  return Math.max(0, Math.min(100, Math.round(benefitSum - costSum + 50)))
}

export function getOpportunityDecision(score: number): 'accept' | 'defer' | 'reject' {
  if (score >= OPPORTUNITY_THRESHOLDS.ACCEPT) return 'accept'
  if (score >= OPPORTUNITY_THRESHOLDS.DEFER)  return 'defer'
  return 'reject'
}

export function getOpportunityVerdict(score: number): Omit<OpportunityResult, 'score' | 'rationale'> {
  const decision = getOpportunityDecision(score)
  if (decision === 'accept') return {
    decision, label: 'Strong Match', color: '#16A34A', bg: '#DCFCE7', icon: '✓',
    advice: 'This opportunity aligns well with your goals and offers strong potential. Consider prioritising it.',
  }
  if (decision === 'defer') return {
    decision, label: 'Consider Deferring', color: '#D97706', bg: '#FFFBEB', icon: '⚠️',
    advice: 'Mixed signals. Do more research or wait until your capacity opens up before committing.',
  }
  return {
    decision, label: 'Pass on This', color: '#DC2626', bg: '#FFF0F0', icon: '🚫',
    advice: "This opportunity costs more than it gives back right now. Your time is better spent elsewhere.",
  }
}

export function getOpportunityRationale(inputs: OpportunityInputs): string[] {
  const bullets: string[] = []
  if (inputs.alignment  >= 60) bullets.push('High alignment with your current goals')
  if (inputs.upside     >= 60) bullets.push('Significant potential upside')
  if (inputs.urgency    >= 70) bullets.push('Time-sensitive — window may close soon')
  if (inputs.timeCost   >= 70) bullets.push('High time investment required — review your capacity first')
  if (inputs.energyCost >= 70) bullets.push('Significant energy drain — factor in recovery time')
  if (inputs.moneyCost  >= 70) bullets.push('Meaningful financial commitment — confirm budget availability')
  if (inputs.alignment  <  40) bullets.push('Low alignment with current goals — potential strategic misfit')
  if (inputs.upside     <  40) bullets.push('Limited upside relative to cost')
  return bullets
}

export function evaluateOpportunity(inputs: OpportunityInputs): OpportunityResult {
  const score     = calcOpportunityScore(inputs)
  const verdict   = getOpportunityVerdict(score)
  const rationale = getOpportunityRationale(inputs)
  return { score, ...verdict, rationale }
}
