// lib/smartScore.ts — Cadence Source of Truth v1.0
// All SMART scoring is deterministic regex/formula-based.
// No Math.random(). No hardcoded per-goal constants.

export interface SmartScore {
  score:    number
  feedback: string
}

export interface SmartEvalResult {
  specific:     SmartScore
  measurable:   SmartScore
  achievable:   SmartScore
  relevant:     SmartScore
  timeBound:    SmartScore
  overallScore: number
  quality:      string
  qualityColor: string
  qualityBg:    string
}

export const SMART_GATE_THRESHOLD = 60

function scoreColor(s: number): { color: string; bg: string } {
  if (s >= 80) return { color: '#16A34A', bg: '#F0FFF4' }
  if (s >= 60) return { color: '#D97706', bg: '#FFFBEB' }
  return        { color: '#DC2626', bg: '#FFF5F5' }
}

export function scoreSpecific(text: string): SmartScore {
  const t         = text.toLowerCase()
  const wordCount = t.trim().split(/\s+/).filter(Boolean).length
  let score = 0
  if (wordCount >= 10) score += 40
  else if (wordCount >= 5) score += 20
  if (/\b(i|we|my|our|the|a)\b/.test(t))           score += 25
  if (/\b(will|want|need|plan|aim|intend|achieve|complete|build|launch|learn|finish)\b/.test(t)) score += 25
  if (wordCount >= 20) score += 10
  score = Math.min(100, score)
  let feedback: string
  if (score >= 80)      feedback = 'Goal is well-defined with clear subject and action'
  else if (score >= 60) feedback = 'Goal could benefit from more specific details about what exactly you want to achieve'
  else                  feedback = 'Add specifics: who, what exactly you want to accomplish, and how'
  return { score, feedback }
}

export function scoreMeasurable(text: string): SmartScore {
  const t = text.toLowerCase()
  let score = 30
  if (/\d+/.test(t))    score += 35
  if (/\d+%|percent/i.test(t)) score += 10
  if (/\b(increase|decrease|improve|reduce|achieve|complete|finish|earn|save|lose|gain|reach|hit)\b/.test(t)) score += 15
  if (/\b(all|every|daily|weekly|monthly|times|occasions)\b/.test(t)) score += 10
  score = Math.min(100, score)
  let feedback: string
  if (score >= 80)      feedback = 'Goal includes quantifiable metrics or clear completion criteria'
  else if (score >= 55) feedback = 'Consider adding measurable targets — numbers, percentages, or completion markers'
  else                  feedback = 'Add specific numbers, amounts, or clearly defined success criteria'
  return { score, feedback }
}

export function scoreAchievable(
  text: string,
  remainingCapacityHours: number | null,
  activeGoalCount: number
): SmartScore {
  const t = text.toLowerCase()
  const hoursMatch = t.match(/(\d+)\s*hours?\s*(per|a|\/)\s*week/)
  const estimatedHours = hoursMatch ? parseInt(hoursMatch[1], 10) : null
  let score = 65
  if (/without any (funding|help|support|experience|money)/.test(t)) score -= 10
  if (/in \d+ (days?|hours?)/.test(t) && !/months?/.test(t))         score -= 15
  if (/overnight|instantly|immediately/.test(t))                     score -= 20
  if (remainingCapacityHours !== null && estimatedHours !== null) {
    if (remainingCapacityHours >= estimatedHours)  score = Math.max(score, 80)
    else if (remainingCapacityHours <= 0)           score = Math.min(score, 45)
    else score = Math.round(score * (remainingCapacityHours / estimatedHours))
  }
  const overloadPenalty = Math.max(0, (activeGoalCount - 5) * 5)
  score = Math.max(0, Math.min(100, score - overloadPenalty))
  let feedback: string
  if (score >= 75)      feedback = 'Goal appears realistic based on your current capacity and active goals'
  else if (score >= 55) feedback = 'Goal is challenging but potentially achievable — review your current commitments'
  else                  feedback = 'You may be over-capacity. Consider pausing a lower-priority goal before adding this one'
  return { score, feedback }
}

export function scoreRelevant(
  text: string,
  goalCategory: string,
  priorityStack: string[]
): SmartScore {
  const t = text.toLowerCase()
  let score: number
  if (priorityStack.length === 0) {
    score = 70
    if (/career|business|health|finance|family|relationship|travel|education|growth|skill|wealth|fitness/.test(t)) score += 10
    if (t.split(/\s+/).length >= 8) score += 5
    score = Math.min(95, score)
  } else {
    const rank = priorityStack.findIndex(cat => cat.toLowerCase() === goalCategory.toLowerCase())
    score = rank === -1 ? 60 : Math.max(40, 100 - rank * 10)
  }
  let feedback: string
  if (score >= 85)      feedback = 'Goal aligns strongly with your top priorities'
  else if (score >= 70) feedback = 'Goal connects well to your life priorities'
  else                  feedback = 'Consider how this goal connects to your top priorities — it may compete with higher-ranked areas'
  return { score, feedback }
}

export function scoreTimeBound(text: string): SmartScore {
  const t = text.toLowerCase()
  let score = 20
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(t)) score += 40
  if (/\bby\b/.test(t))                      score += 30
  if (/\bwithin\s+\d+/i.test(t))             score += 30
  if (/\bq[1-4]\b|\bquarter\b/i.test(t))    score += 25
  if (/\b(next|this)\s+(week|month|year)\b/.test(t)) score += 20
  if (/\bin\s+\d+\s+(days?|weeks?|months?)\b/.test(t)) score += 30
  if (/\bby\s+\d{4}\b/.test(t))             score += 28
  if (/202[5-9]|203\d/.test(t))             score += 32
  score = Math.min(100, score)
  let feedback: string
  if (score >= 80)      feedback = 'Goal has a clear deadline or timeframe'
  else if (score >= 55) feedback = 'Consider adding a more specific deadline or target quarter'
  else                  feedback = 'Add a target date or quarter (e.g., "by June", "within 3 months", "Q3 2026")'
  return { score, feedback }
}

export function evaluateGoal(
  text: string,
  goalCategory: string,
  priorityStack: string[],
  remainingCapacityHours: number | null,
  activeGoalCount: number
): SmartEvalResult {
  const specific   = scoreSpecific(text)
  const measurable = scoreMeasurable(text)
  const achievable = scoreAchievable(text, remainingCapacityHours, activeGoalCount)
  const relevant   = scoreRelevant(text, goalCategory, priorityStack)
  const timeBound  = scoreTimeBound(text)
  const overallScore = Math.round(
    (specific.score + measurable.score + achievable.score + relevant.score + timeBound.score) / 5
  )
  let quality: string
  if (overallScore >= 85)                        quality = 'Excellent goal quality'
  else if (overallScore >= 75)                   quality = 'Very good goal quality'
  else if (overallScore >= 62)                   quality = 'Good goal quality'
  else if (overallScore >= SMART_GATE_THRESHOLD) quality = 'Fair — consider refining'
  else                                           quality = 'Needs more definition'
  const { color: qualityColor, bg: qualityBg } = scoreColor(overallScore)
  return { specific, measurable, achievable, relevant, timeBound, overallScore, quality, qualityColor, qualityBg }
}

export function getScoreBadgeStyle(score: number) {
  return scoreColor(score)
}
