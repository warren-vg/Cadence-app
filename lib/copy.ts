// ─── Deterministic daily variant selector ─────────────────────────────────────
// Seed = userId + calendar date → consistent within a day, rotates daily,
// varies across users. SSR-safe (no Math.random).

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return Math.abs(h)
}

export function dailyVariant(
  pool: readonly string[],
  userId: string,
  date: Date = new Date(),
): string {
  const key = `${userId}:${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  return pool[hashSeed(key) % pool.length]
}

// ─── Copy pools ───────────────────────────────────────────────────────────────
// Brand voice: rhythm over hustle, intention counts, never shame, compound
// framing. Direct but warm. No exclamation points. No hollow affirmations.

export const COPY = {

  // ── Momentum score messages (5 tiers) ──────────────────────────────────────

  momentum_high: [
    "Your rhythm is locked in. That kind of consistency compounds.",
    "Strong work. The gap between where you started and where you are is real.",
    "Week is going well. Protect your energy and let the streak run.",
    "You've been showing up. That's all momentum ever is.",
    "Consistency at this level is rare. Trust the process.",
    "Your effort this week is doing what it's supposed to do.",
    "The work is landing. Keep the thread going.",
  ],

  momentum_good: [
    "Solid week so far. Each task is quietly compounding.",
    "You're making real progress. The second half of the week matters too.",
    "Good pace. Stay in the work — consistency beats intensity.",
    "Momentum is building. One focused push and this becomes a great week.",
    "You're in the work. That's more than most people manage.",
    "Steady progress. The key now is protecting your deep work blocks.",
    "Good week in motion. Don't let Friday sneak up on you.",
  ],

  momentum_building: [
    "Progress is happening, even when it doesn't feel like much.",
    "You're in the building phase. Consistency now pays dividends later.",
    "Mid-range momentum — the work is stacking up, even quietly.",
    "Keep showing up. This is where habits either form or fade.",
    "Small steps are still steps. The compounding is invisible until it isn't.",
    "You're doing the work. That always counts more than the number suggests.",
    "Getting there. One meaningful push each day will move this forward.",
  ],

  momentum_starting: [
    "Every pattern starts with a single move. This is yours.",
    "Early days. The most important thing right now is showing up again tomorrow.",
    "Just getting started — and that's exactly where it begins.",
    "The first few tasks are always the hardest. You're past them.",
    "Low momentum, but momentum. That's the foundation.",
    "One task at a time. Streaks are built exactly like this.",
    "The scoreboard doesn't matter yet. Showing up does.",
  ],

  momentum_zero: [
    "Today is a clean start. Complete one task and the score will follow.",
    "Zero is a starting point. Add one task to your day and go from there.",
    "The week resets every Monday. Schedule something and begin.",
    "No tasks completed yet — that changes the moment you start.",
    "A score of zero just means the week is ahead of you.",
    "Start anywhere. One completed task changes the whole picture.",
    "Today's the day to begin. Head to Plan and pick one thing.",
  ],

  // ── Dashboard header subtitle (STATE 2 — meaningful move already chosen) ───

  state2_subtitle: [
    "Today only needs one meaningful move.",
    "One thing done right matters more than five done halfway.",
    "Your move is set. Everything else is secondary.",
    "The move is chosen. Now it's just about execution.",
    "One intention. One move. That's a complete day.",
    "You've named your move. Now make it happen.",
    "The most important thing today is already decided.",
  ],

  // ── Carousel prompt (STATE 1 — choose your move) ──────────────────────────

  carousel_prompt_main: [
    "Today only needs one meaningful move.",
    "One task can anchor the whole day.",
    "The best move is the one you actually make.",
    "Pick the one thing that would make today feel like a win.",
    "One meaningful action sets the tone for everything else.",
    "Choose the task that would make today feel complete.",
    "A single focused move changes the energy of the whole day.",
  ],

  carousel_prompt_sub: [
    "Which one matters most?",
    "Which of these would move the needle?",
    "Which task has the biggest pull on your progress?",
    "Which one belongs to your most important goal?",
    "What's the one you'd regret skipping?",
    "Which task, if done, would make the rest easier?",
    "Which one are you most tempted to skip?",
  ],

  // ── Meaningful move hero card subtitle ────────────────────────────────────

  move_card_subtitle: [
    "Every intentional step compounds.",
    "Small consistent actions build the life you're working toward.",
    "One move, done with intention, is always enough.",
    "This is how progress gets built — one focused action at a time.",
    "The rhythm you're building here is the actual product.",
    "Showing up for this is what separates intention from achievement.",
    "Each time you do this, the next time gets easier.",
  ],

  // ── Completion modal ──────────────────────────────────────────────────────

  completion_heading: [
    "You made your move today.",
    "Move complete. That's the whole game.",
    "One meaningful thing, done.",
    "Your intention became action today.",
    "The work got done.",
    "You followed through.",
    "Done. That's what it looks like.",
  ],

  completion_subtext: [
    "This is what a good day looks like.",
    "The people who do this consistently get where they're going.",
    "That's real progress, not just a plan.",
    "Every good outcome started exactly like this.",
    "One move a day is 365 by the end of the year.",
    "Moments like this are what build momentum.",
    "Small, consistent, intentional. That's the formula.",
  ],

  // ── Evening reflection ────────────────────────────────────────────────────

  evening_completed: [
    "You made your move today — your rhythm is holding.",
    "The move is done. That's what a good day looks like from the inside.",
    "You followed through today. That matters more than you think.",
    "Done. The compounding is quiet, but it's happening.",
    "Your move is complete. Everything else was extra.",
    "Today's action is banked. The streak continues.",
    "You showed up and did the thing. That's the whole formula.",
  ],

  evening_incomplete: [
    "You set an intention this morning. Even naming it matters.",
    "You showed up today in ways that don't always get counted.",
    "Naming what you want to do is still a form of progress.",
    "Tomorrow is a clean start. The intention was real.",
    "Progress isn't always visible. Today still counted.",
    "Every reflection is part of the pattern — even this one.",
    "You're still here, still thinking about it. That's not nothing.",
  ],

  // ── Goals ─────────────────────────────────────────────────────────────────

  goals_subtitle: [
    "Track and refine your priorities",
    "Where focus goes, progress follows",
    "Your goals, your momentum",
    "The foundation of your Cadence",
    "Clarity on what matters most",
    "Build the future you're working toward",
    "Intentions become outcomes here",
  ],

  goals_empty_body: [
    "Goals are the foundation of your Cadence. Define what matters most and start building real momentum.",
    "Everything in Cadence flows from your goals. Set one and the whole system comes to life.",
    "Goals give your daily tasks meaning. Add one to start turning intention into progress.",
    "Progress requires direction. Your first goal is the starting point for everything.",
    "Without goals, tasks are just items. With them, every action compounds into something real.",
    "The best time to set a goal was yesterday. The second best time is right now.",
    "Goals are how you tell Cadence what matters. Set one and watch the pieces fall into place.",
  ],

  // ── Mentor ────────────────────────────────────────────────────────────────

  mentor_subtitle: [
    "Guidance tailored to your journey",
    "Context-aware coaching, always on",
    "Your goals, your data, your direction",
    "Insight grounded in your actual progress",
    "Advice rooted in where you actually are",
    "A thinking partner who knows your work",
    "Built from your goals and your progress",
  ],

} as const
