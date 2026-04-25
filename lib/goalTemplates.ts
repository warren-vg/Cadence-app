// lib/goalTemplates.ts — Rules-based task generation for goal activation

import { toDateStr, addDays } from '@/lib/planData'
import { findBestSlot, type DBTask, type WorkSchedule } from '@/lib/db'

interface TaskTemplate {
  text: string
  duration: number         // hours
  energyType: string
  recurrence: 'once' | 'weekly'
  dayPreference: number    // 0=Mon … 6=Sun, -1=any
}

const CATEGORY_TEMPLATES: Record<string, TaskTemplate[]> = {
  Career: [
    { text: 'Deep work session: {goal}',     duration: 2,    energyType: 'deep',    recurrence: 'weekly', dayPreference: 0 },
    { text: 'Review progress on {goal}',     duration: 0.5,  energyType: 'light',   recurrence: 'weekly', dayPreference: 4 },
    { text: 'Research and planning: {goal}', duration: 1,    energyType: 'deep',    recurrence: 'weekly', dayPreference: 1 },
    { text: 'Networking / outreach',         duration: 0.5,  energyType: 'social',  recurrence: 'weekly', dayPreference: 2 },
  ],
  Finance: [
    { text: 'Review budget and progress',    duration: 0.5,  energyType: 'deep',    recurrence: 'weekly', dayPreference: 0 },
    { text: 'Research: {goal}',              duration: 1,    energyType: 'deep',    recurrence: 'once',   dayPreference: -1 },
    { text: 'Update financial tracker',      duration: 0.25, energyType: 'light',   recurrence: 'weekly', dayPreference: 4 },
  ],
  Health: [
    { text: 'Workout session',               duration: 1,    energyType: 'social',  recurrence: 'weekly', dayPreference: -1 },
    { text: 'Meal prep and planning',        duration: 1,    energyType: 'social',  recurrence: 'weekly', dayPreference: 6 },
    { text: 'Track health metrics',          duration: 0.25, energyType: 'light',   recurrence: 'weekly', dayPreference: 0 },
  ],
  Creative: [
    { text: 'Creative session: {goal}',      duration: 1.5,  energyType: 'creative',recurrence: 'weekly', dayPreference: -1 },
    { text: 'Review and edit work',          duration: 1,    energyType: 'creative',recurrence: 'weekly', dayPreference: 3 },
    { text: 'Gather inspiration / research', duration: 0.5,  energyType: 'light',   recurrence: 'once',   dayPreference: -1 },
  ],
  Education: [
    { text: 'Study session: {goal}',         duration: 1.5,  energyType: 'deep',    recurrence: 'weekly', dayPreference: -1 },
    { text: 'Review notes and practice',     duration: 0.5,  energyType: 'deep',    recurrence: 'weekly', dayPreference: 2 },
    { text: 'Apply learning: practice task', duration: 1,    energyType: 'deep',    recurrence: 'weekly', dayPreference: 4 },
  ],
  'Personal Growth': [
    { text: 'Reflection and journaling',     duration: 0.5,  energyType: 'light',   recurrence: 'weekly', dayPreference: 0 },
    { text: 'Read / learn: {goal}',          duration: 1,    energyType: 'light',   recurrence: 'weekly', dayPreference: -1 },
    { text: 'Practice: {goal}',              duration: 0.5,  energyType: 'creative',recurrence: 'weekly', dayPreference: 3 },
  ],
  Relationships: [
    { text: 'Reach out to someone important',duration: 0.25, energyType: 'social',  recurrence: 'weekly', dayPreference: -1 },
    { text: 'Plan quality time',             duration: 0.5,  energyType: 'social',  recurrence: 'weekly', dayPreference: 4 },
  ],
  Travel: [
    { text: 'Research and plan: {goal}',     duration: 1,    energyType: 'light',   recurrence: 'once',   dayPreference: -1 },
    { text: 'Book and arrange logistics',    duration: 0.5,  energyType: 'light',   recurrence: 'once',   dayPreference: -1 },
  ],
  Business: [
    { text: 'Strategy session: {goal}',      duration: 2,    energyType: 'deep',    recurrence: 'weekly', dayPreference: 0 },
    { text: 'Execute on priority task',      duration: 1.5,  energyType: 'deep',    recurrence: 'weekly', dayPreference: 2 },
    { text: 'Review metrics and adjust',     duration: 0.5,  energyType: 'light',   recurrence: 'weekly', dayPreference: 4 },
  ],
  Community: [
    { text: 'Contribute to community: {goal}',duration: 1,  energyType: 'social',  recurrence: 'weekly', dayPreference: -1 },
    { text: 'Connect and engage',            duration: 0.5,  energyType: 'social',  recurrence: 'weekly', dayPreference: 2 },
  ],
}

export function inferEnergyType(goalCategory: string): string {
  const map: Record<string, string> = {
    Career:           'deep',
    Business:         'deep',
    Finance:          'deep',
    Education:        'deep',
    'Personal Growth':'light',
    Relationships:    'social',
    Community:        'social',
    Health:           'social',
    Travel:           'social',
    Creative:         'creative',
  }
  return map[goalCategory] || 'light'
}

export function generateTasksForGoal(
  goal: { id: string; text: string; category: string },
  energyBlocks: Record<string, string>,
  workSchedule: WorkSchedule,
  startDate: Date = new Date()
): Omit<DBTask, 'id' | 'user_id' | 'completed_at' | 'created_at'>[] {
  const templates = (CATEGORY_TEMPLATES[goal.category] || CATEGORY_TEMPLATES['Personal Growth']).slice(0, 4)
  const today     = new Date(startDate)
  const todayDay  = today.getDay() // 0=Sun

  return templates.map((template, i) => {
    const goalShort = goal.text.split(' ').slice(0, 4).join(' ')
    const text      = template.text.replace('{goal}', goalShort)

    const targetDate = new Date(today)
    if (template.dayPreference >= 0) {
      // Convert 0=Mon…6=Sun spec to JS 0=Sun…6=Sat
      const targetJS  = template.dayPreference === 6 ? 0 : template.dayPreference + 1
      const daysAhead = (targetJS - todayDay + 7) % 7
      targetDate.setDate(today.getDate() + (daysAhead === 0 ? 7 : daysAhead))
    } else {
      targetDate.setDate(today.getDate() + i)
    }

    const slot = findBestSlot(
      { energyType: template.energyType, category: goal.category, duration: template.duration },
      targetDate,
      energyBlocks,
      [],
      workSchedule
    )

    return {
      text,
      date:           toDateStr(targetDate),
      scheduled_time: slot || '18:00',
      duration:       template.duration,
      category:       goal.category,
      priority:       i === 0 ? 'high' : 'medium',
      completed:      false,
      goal_id:        goal.id,
      project_id:     null,
    }
  })
}
