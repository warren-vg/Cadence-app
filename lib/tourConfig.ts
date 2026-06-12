// Tour step configuration — shared by both first-run auto-tour and Settings replay.
// One source of truth. Do not duplicate.
//
// ctaAction semantics:
//   'next'     — advance to the next step, stay on same route
//   'navigate' — advance the tour AND push to the next step's route
//   'try'      — open/focus the feature on this screen (no data written)
//   'finish'   — end the tour (last step)
//
// anchor: a stable data-tour="<id>" attribute added to the target element.
// arrowDirection: which side of the card the caret points toward the anchored element.

export type TourCtaAction = 'next' | 'navigate' | 'try' | 'finish'
export type ArrowDirection = 'up' | 'down' | 'left' | 'right' | 'none'

export interface TourStep {
  id: string
  route: string
  anchor: string
  title: string
  body: string
  ctaLabel: string
  ctaAction: TourCtaAction
  arrowDirection: ArrowDirection
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'home-base',
    route: '/dashboard',
    anchor: 'home-today-card',
    title: 'This is your home base',
    body: "Your daily focus, active goals, and momentum score all live here.",
    ctaLabel: 'Got it',
    ctaAction: 'navigate',
    arrowDirection: 'up',
  },
  {
    id: 'goals-intro',
    route: '/dashboard/goals',
    anchor: 'goals-fab',
    title: 'Set goals that pull you forward',
    body: "Goals are the foundation of your Cadence. Add one here and the app builds your plan around it.",
    ctaLabel: 'Got it',
    // 'try' would open the add-goal sheet — safe, no data written until user submits
    ctaAction: 'try',
    arrowDirection: 'up',
  },
  {
    id: 'plan-weekly',
    route: '/dashboard/plan',
    anchor: 'plan-build-week',
    title: 'Build your week in minutes',
    body: "Cadence turns your goals into a suggested weekly schedule. One tap fills your week with intention.",
    ctaLabel: 'Got it',
    // 'try' would trigger Build Week which generates tasks — that writes data.
    // Demoted to 'navigate' to avoid side effects without user intent.
    ctaAction: 'navigate',
    arrowDirection: 'down',
  },
  {
    id: 'daily-plan',
    route: '/dashboard/plan/daily',
    anchor: 'daily-plan-list',
    title: "Today's plan at a glance",
    body: "Each morning, your day is laid out here — tasks timed to your energy rhythm, ready to tick off.",
    ctaLabel: 'Got it',
    ctaAction: 'navigate',
    arrowDirection: 'up',
  },
  {
    id: 'progress-trends',
    route: '/dashboard/progress',
    anchor: 'progress-momentum-chart',
    title: 'Watch your momentum build',
    body: "Trends appear in your second week. Keep checking in and the charts tell your story.",
    ctaLabel: 'Got it',
    ctaAction: 'navigate',
    arrowDirection: 'up',
  },
  {
    id: 'mentor-intro',
    route: '/dashboard/mentor',
    anchor: 'mentor-input',
    title: 'Your AI mentor knows your plan',
    body: "Ask anything — progress, priorities, what to tackle next. It has full context on your goals and schedule.",
    ctaLabel: 'Got it',
    ctaAction: 'navigate',
    arrowDirection: 'down',
  },
  {
    id: 'community',
    route: '/dashboard/progress/community',
    anchor: 'community-add-friend',
    title: 'Build your accountability circle',
    body: "Add friends to share progress and celebrate wins. People with accountability partners are 65% more likely to hit their goals.",
    ctaLabel: 'Got it',
    ctaAction: 'finish',
    arrowDirection: 'up',
  },
]
