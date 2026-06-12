export type UserProfile = {
  goalCount: number
  weeklyCapacity: number
  primaryTimeOfDay?: string
  employmentType?: string
}

export type InsightTemplate = {
  id: string
  title: string
  body: string
  matchWhen?: (p: UserProfile) => boolean
}

const INSIGHTS: InsightTemplate[] = [
  {
    id: 'implementation_intention',
    title: 'When + where = done',
    body: "Peter Gollwitzer's research found that deciding exactly when and where you'll act on a goal makes you 2–3× more likely to follow through. Cadence schedules your goals at specific times so this effect works automatically.",
    matchWhen: p => p.goalCount >= 2,
  },
  {
    id: 'peak_performance',
    title: 'Your energy window is your edge',
    body: 'Peak cognitive performance lasts only 2–4 hours per day. By protecting your best hours for your top goals, you accomplish more in less time than those who work without structure.',
    matchWhen: p => p.primaryTimeOfDay === 'morning',
  },
  {
    id: 'weekly_review',
    title: 'The review loop is the secret',
    body: 'People who do a brief weekly review accomplish 43% more of their goals over 12 weeks. Cadence builds this loop directly into your workflow so it becomes automatic rather than optional.',
    matchWhen: p => p.weeklyCapacity >= 5,
  },
  {
    id: 'focus_depth',
    title: 'Fewer goals, bigger results',
    body: "Deep work research shows that focused, uninterrupted effort produces exponentially more value than shallow multitasking. Limiting your active goals is the first step toward depth.",
    matchWhen: p => p.goalCount <= 2,
  },
  {
    id: 'consistency_beats_intensity',
    title: 'Consistency beats intensity',
    body: 'People who make small, daily progress toward a goal are 76% more likely to maintain those habits 6 months later. Cadence schedules regular, sustainable sessions instead of marathon bursts.',
    matchWhen: p => p.weeklyCapacity < 5,
  },
  {
    id: 'evening_advantage',
    title: 'Night owls have a real edge',
    body: 'Evening workers often have fewer interruptions and benefit from the day\'s cognitive consolidation. Scheduling creative or reflective work at night aligns with natural cortisol patterns for later chronotypes.',
    matchWhen: p => p.primaryTimeOfDay === 'night',
  },
  {
    id: 'afternoon_flow',
    title: 'Afternoons are underrated',
    body: 'Research on ultradian rhythms shows that a second cognitive peak typically occurs in the mid-afternoon. Afternoon workers who protect this window report higher task completion rates than those who schedule ad hoc.',
    matchWhen: p => p.primaryTimeOfDay === 'afternoon',
  },
  {
    id: 'identity_precedes_action',
    title: 'Identity precedes action',
    body: 'Habit research shows that people who view goal work as part of their identity are significantly more consistent than those who treat it as a chore. Your weekly schedule is your identity made visible.',
  },
  {
    id: 'zeigarnik_effect',
    title: 'Your brain wants to finish what it starts',
    body: 'The Zeigarnik effect shows that unfinished tasks stay active in working memory, creating mental drag. Breaking goals into scheduled tasks gives your brain clear stopping points and reduces cognitive load.',
    matchWhen: p => p.goalCount >= 3,
  },
  {
    id: 'self_employed_autonomy',
    title: 'Autonomy needs a container',
    body: "Studies on self-employed workers show that those who create explicit time blocks for their own goals — separate from client work — report 60% higher life satisfaction scores than those who work reactively.",
    matchWhen: p => p.employmentType === 'self-employed',
  },
  {
    id: 'student_spaced_practice',
    title: 'Spacing is the superpower',
    body: 'Spaced practice research shows that working on a skill across multiple short sessions dramatically outperforms single long sessions. Your distributed weekly schedule is already optimized for this.',
    matchWhen: p => p.employmentType === 'not-working',
  },
]

export function selectInsight(profile: UserProfile): InsightTemplate {
  const matched = INSIGHTS.find(i => i.matchWhen?.(profile))
  return matched ?? INSIGHTS[7]
}
