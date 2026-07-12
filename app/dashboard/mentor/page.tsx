'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toDateStr, getMonday, formatTime, getCatStyle } from '@/lib/planData'
import { dailyVariant, COPY } from '@/lib/copy'
import {
  getTasksForDate, getTasksForWeek, toggleTask as dbToggleTask,
  recalcGoalProgressFromTasks, getMorningStreak,
  type DBTask,
} from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id: string
  text: string
  category: string
  status: string
  priority: number
  progress: number
  quarter?: string | null
  refined_goal?: string | null
  estimated_weekly_hours?: number | null
}

interface ChatAction {
  id: string
  type: 'confirm_task_done' | 'update_goal_progress' | 'update_goal_status'
  label: string
  payload: Record<string, unknown>
  applied?: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: ChatAction[]
}

interface MentorContext {
  goals: Goal[]
  todayTasks: DBTask[]
  weekTasks: DBTask[]
  score: number
  username: string
  streak: number
  lastReflection: { wins?: string | null; challenges?: string | null } | null
}

// ─── Task Impact Descriptions ─────────────────────────────────────────────────

const TASK_IMPACTS: Record<string, string[]> = {
  Career: [
    'Showcases your expertise to potential clients',
    'Builds professional credibility and visibility',
    'Advances your career trajectory this quarter',
    'Strengthens your professional portfolio',
  ],
  Finance: [
    'Ensures financial goals stay on track',
    'Builds awareness of spending patterns',
    'Moves you closer to your financial targets',
    'Supports your long-term financial security',
  ],
  Health: [
    'Compounds fitness gains over time',
    'Energizes your productivity for the day ahead',
    'Builds the physical foundation for peak performance',
    'Supports mental clarity and resilience',
  ],
  Creative: [
    'Builds your personal brand and authority',
    'Develops skills that differentiate you',
    'Creates assets with long-term value',
    'Expresses your unique voice and perspective',
  ],
  Education: [
    'Compounds knowledge for long-term advantage',
    'Builds skills that create new opportunities',
    'Invests in your future earning potential',
  ],
  'Personal Growth': [
    'Deepens self-awareness and emotional resilience',
    'Builds habits that compound over months',
    'Strengthens your foundation for everything else',
  ],
  Relationships: [
    'Deepens connections that matter most',
    'Builds the support network behind your success',
  ],
  Travel: [
    'Creates experiences that enrich your perspective',
    'Advances planning toward your travel goals',
  ],
}

function getTaskImpact(category: string, index: number): string {
  const impacts = TASK_IMPACTS[category] || ['Advances your goals for the quarter']
  return impacts[index % impacts.length]
}

// ─── Insight Generator ────────────────────────────────────────────────────────

function generateInsight(goals: Goal[], tasks: DBTask[], score: number): string {
  const h = new Date().getHours()
  const dow = new Date().getDay()
  const activeGoals = goals.filter(g => g.status === 'active')
  const cats = [...new Set(activeGoals.map(g => g.category))]
  const completedToday = tasks.filter(t => t.completed).length
  const totalToday = tasks.length

  // Evening (5pm – midnight)
  if (h >= 17) {
    const opts = [
      `You've shown up today — that consistency is exactly what separates goals that get achieved from ones that don't.`,
      `Every action you took today compounded your progress. The version of you months from now will thank today's effort.`,
      `Progress isn't always visible in the moment. Trust that what you built today is quietly stacking up.`,
      cats.length > 0
        ? `Your ${cats[0]} journey is built one day at a time. Today was one of those days.`
        : `Tonight, reflect on what moved the needle. Even small steps are steps forward.`,
      `The hardest part isn't starting — it's continuing. You're doing that. Keep going.`,
    ]
    return opts[(dow + Math.floor(score / 20)) % opts.length]
  }

  // Morning (before noon)
  if (h < 12) {
    const opts = [
      totalToday > 0
        ? `Your schedule today supports your top priorities. Small wins compound into big results.`
        : `A clear mind precedes a clear day. Set your intention and the schedule will follow.`,
      cats.length >= 2
        ? `Today's tasks span your ${cats[0]} and ${cats[1]} goals. Each one moves the whole picture forward.`
        : cats.length === 1
          ? `Today is a focused ${cats[0]} day. Deep work on one thing beats shallow effort on many.`
          : `Today is yours to design. What one task would make today feel like a success?`,
      score >= 70
        ? `Your momentum is strong. Protect your energy and let today's consistency build the streak.`
        : score > 0
          ? `Momentum is rebuilt one task at a time. Start with the smallest thing on your list.`
          : `Every high achiever started from zero. Today is where your streak begins.`,
      `The gap between where you are and where you want to be closes with today's decisions.`,
      dow === 1
        ? `New week, fresh slate. What you build this week echoes through the rest of the quarter.`
        : dow === 5
          ? `Finish strong. What you complete today carries momentum into the weekend.`
          : `Mid-week is where discipline outperforms motivation. Show up anyway.`,
    ]
    return opts[(dow + Math.floor(score / 25)) % opts.length]
  }

  // Afternoon
  const opts = [
    completedToday > 0
      ? `You've already moved the needle today. Keep that energy going into the afternoon.`
      : `The morning is gone, but the afternoon is yours. One focused hour can turn the whole day around.`,
    `Deep work in the afternoon requires defending your focus. Block the noise.`,
    cats.length > 0
      ? `Your ${cats[0]} goals don't advance on their own. Every task you complete today is a vote for the person you're becoming.`
      : `The best investment you can make right now is the next task on your list.`,
  ]
  return opts[dow % opts.length]
}

// ─── Bottom Line Generator ─────────────────────────────────────────────────────

function generateBottomLine(tasks: DBTask[], goals: Goal[]): string {
  const cats = [...new Set(tasks.map(t => t.category))]
  const activeCount = goals.filter(g => g.status === 'active').length
  if (tasks.length === 0) return 'No tasks scheduled today. Head to your Plan tab to map out your day.'
  const catStr = cats.length >= 3
    ? `${cats.slice(0, 2).join(', ').toLowerCase()}, and ${cats[2].toLowerCase()}`
    : cats.map(c => c.toLowerCase()).join(' and ')
  return `Each task completed today compounds your progress. By the end of the day, you'll have tangible advancement across ${catStr}—moving you measurably closer to your ${activeCount > 0 ? activeCount + ' active' : ''} goal${activeCount !== 1 ? 's' : ''}.`
}

// ─── Mentor Chat Engine ────────────────────────────────────────────────────────

function buildMentorResponse(
  msg: string,
  ctx: MentorContext,
): { content: string; actions?: ChatAction[] } {
  const { goals, todayTasks, weekTasks, score, username, streak, lastReflection } = ctx
  const lower = msg.toLowerCase()
  const firstName = username.split(' ')[0] || 'you'
  const activeGoals = goals.filter(g => g.status === 'active')

  // ── Schedule / today ──────────────────────────────────────────────────────
  if (
    lower.includes('schedule') ||
    (lower.includes('what') && (lower.includes('today') || lower.includes('do i have'))) ||
    lower.includes('plan for today') ||
    lower.includes('today entail') ||
    lower.includes('tasks today') ||
    lower.includes('what should i')
  ) {
    if (todayTasks.length === 0) {
      const suggestion = activeGoals[0]
        ? `The most meaningful thing you could do right now is spend an hour on "${activeGoals[0].text}". Head to Plan to add it.`
        : `Head to your Plan tab and block some time — even one focused hour will move things forward.`
      return { content: `Nothing's on the schedule yet today. ${suggestion}` }
    }
    const done = todayTasks.filter(t => t.completed).length
    const remaining = todayTasks.filter(t => !t.completed)
    if (done === todayTasks.length) {
      return {
        content: `Everything on the list today is done — ${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} complete. That's a clean day. Take a moment, then think about what would make tomorrow equally strong.`,
      }
    }
    const nextUp = remaining[0]
    const names = remaining.slice(0, 3).map(t => `"${t.text}" at ${formatTime(t.scheduled_time)}`).join(', ')
    const moreTxt = remaining.length > 3 ? ` and ${remaining.length - 3} more` : ''
    return {
      content: `${done > 0 ? `You've finished ${done} of ${todayTasks.length} today.` : `${todayTasks.length} thing${todayTasks.length > 1 ? 's' : ''} on deck.`} Still ahead: ${names}${moreTxt}.\n\n${nextUp ? `Start with "${nextUp.text}" — it's the next one on the clock.` : ''}`,
    }
  }

  // ── Goals / progress ──────────────────────────────────────────────────────
  if (
    lower.includes('goal') ||
    lower.includes('how am i doing') ||
    (lower.includes('progress') && !lower.includes('%')) ||
    lower.includes('status')
  ) {
    if (activeGoals.length === 0) {
      return {
        content: `You don't have any active goals right now. Head to Goals, activate a few from your inbox, and I can help you build momentum around them.`,
      }
    }
    const avg = Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length)
    const sorted = [...activeGoals].sort((a, b) => (b.progress || 0) - (a.progress || 0))
    const top = sorted[0]
    const bottom = sorted[sorted.length - 1]
    const summary = activeGoals.slice(0, 4).map(g =>
      `• ${g.text} — ${g.progress || 0}%${g.quarter ? ` · ${g.quarter}` : ''}`
    ).join('\n')
    let tone = ''
    if (avg >= 65) {
      tone = `You're further along than most people get. The consistency is showing.`
    } else if (avg >= 30) {
      tone = top !== bottom
        ? `"${top.text}" is leading at ${top.progress || 0}%. If "${bottom.text.slice(0, 40)}" is lagging, that's worth a focused push this week.`
        : `You're in the execution phase — the work is happening, even when it doesn't feel like much.`
    } else {
      tone = lastReflection?.challenges
        ? `You mentioned some challenges recently: "${lastReflection.challenges.slice(0, 70).trim()}${lastReflection.challenges.length > 70 ? '...' : ''}" — early-stage progress can feel invisible. The compounding hasn't kicked in yet, but it will.`
        : `Early-stage progress can feel invisible. The compounding hasn't kicked in yet, but it will.`
    }
    return {
      content: `${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''}, averaging ${avg}%:\n\n${summary}\n\n${tone}`,
    }
  }

  // ── Momentum / performance ────────────────────────────────────────────────
  if (
    lower.includes('momentum') ||
    lower.includes('score') ||
    lower.includes('performing') ||
    lower.includes('streak') ||
    lower.includes('how have i')
  ) {
    const weekDone = weekTasks.filter(t => t.completed).length
    const streakTxt = streak > 1 ? ` You've been showing up ${streak} days in a row.` : streak === 1 ? ` Today is day 1 of a new streak.` : ''
    let body = ''
    if (score >= 75) {
      body = `${weekDone} tasks done this week — ${score}/100.${streakTxt} That kind of consistency makes goals feel inevitable.`
    } else if (score >= 45) {
      body = `${weekDone} of ${weekTasks.length} tasks this week, ${score}/100.${streakTxt} Solid. To push it higher, lead with your highest-priority task first thing each day.`
    } else if (score > 0) {
      body = `${weekDone} tasks done so far, ${score}/100.${streakTxt} You're showing up — that's the foundation. Completing one important task before end of day will move the score.`
    } else {
      body = `Momentum is at zero this week.${streak > 0 ? '' : ' That happens.'} The cleanest way to restart: complete one task today. Just one. That breaks the pattern.`
    }
    return { content: body }
  }

  // ── Timeline / on track ───────────────────────────────────────────────────
  if (
    lower.includes('timeline') ||
    lower.includes('deadline') ||
    lower.includes('on track') ||
    lower.includes('quarter') ||
    lower.includes('when will i')
  ) {
    const withDeadlines = activeGoals.filter(g => g.quarter)
    if (withDeadlines.length === 0) {
      return {
        content: `None of your active goals have target quarters set. Without a timeline there's no way to know if you're on pace. Head to any goal's detail page and assign a quarter — it turns a wish into a plan.`,
      }
    }
    const onTrack = withDeadlines.filter(g => (g.progress || 0) >= 25)
    const atRisk = withDeadlines.filter(g => (g.progress || 0) < 25)
    let response = `Timeline check — ${withDeadlines.length} goal${withDeadlines.length > 1 ? 's' : ''} with deadlines:\n\n`
    if (onTrack.length > 0) response += `On pace: ${onTrack.map(g => `"${g.text.slice(0, 40)}" (${g.quarter}, ${g.progress || 0}%)`).join('; ')}\n`
    if (atRisk.length > 0) {
      response += `Needs attention: ${atRisk.map(g => `"${g.text.slice(0, 40)}" (${g.quarter}, ${g.progress || 0}%)`).join('; ')}`
      const hrs = atRisk[0].estimated_weekly_hours || 3
      response += `\n\nFor the at-risk goal${atRisk.length > 1 ? 's' : ''}, block ${hrs}+ hours per week and treat those blocks as fixed appointments. Want help thinking through what that looks like?`
    }
    return { content: response }
  }

  // ── Gap / re-entry ────────────────────────────────────────────────────────
  if (
    lower.includes('struggling') ||
    lower.includes('behind') ||
    lower.includes('falling') ||
    lower.includes('off track') ||
    lower.includes('lost momentum') ||
    lower.includes('hard time') ||
    lower.includes('haven\'t been') ||
    lower.includes('been a while') ||
    lower.includes('gap') ||
    lower.includes('slipped')
  ) {
    const topGoal = activeGoals[0]
    const gapRef = lastReflection?.challenges
      ? `You mentioned "${lastReflection.challenges.slice(0, 70).trim()}${lastReflection.challenges.length > 70 ? '...' : ''}" as a recent challenge. That context matters.\n\n`
      : ''
    return {
      content: `${gapRef}Re-entry after a gap is one of the most common things I see — and the fix is almost always simpler than it feels.\n\nDon't try to catch up all at once. Pick one task${topGoal ? ` on "${topGoal.text}"` : ''} and complete it today. That single action breaks the pattern. After that, the next one is easier.\n\nWhat's the smallest thing you could do in the next hour?`,
    }
  }

  // ── Advice / suggestions ──────────────────────────────────────────────────
  if (
    lower.includes('advice') ||
    lower.includes('suggest') ||
    lower.includes('recommend') ||
    lower.includes('should i') ||
    lower.includes('what if') ||
    lower.includes('help me') ||
    lower.includes('pivot') ||
    lower.includes('adjust')
  ) {
    const nextTask = todayTasks.find(t => !t.completed)
    const topGoal = activeGoals[0]
    let advice = ''
    if (nextTask) {
      advice += `Most immediate: "${nextTask.text}" at ${formatTime(nextTask.scheduled_time)} — directly tied to your ${nextTask.category} work.\n\n`
    }
    if (topGoal) {
      const hrs = topGoal.estimated_weekly_hours || 3
      const pct = topGoal.progress || 0
      advice += `Your top goal is "${topGoal.text}" at ${pct}%. `
      if (pct < 30) {
        advice += `This early, what matters most is building the routine — aim for ${hrs}h/week in shorter daily sessions rather than one long push.`
      } else if (pct < 70) {
        advice += `You're in the hardest stretch — past the excitement, not yet at the finish. Protect your deep work blocks for this one.`
      } else {
        advice += `You're close. Don't let the momentum you've built slow down now — finish it.`
      }
    }
    return {
      content: advice || `I can give you specific guidance with a bit more detail. What's the decision or situation you're working through?`,
    }
  }

  // ── Mark task done ────────────────────────────────────────────────────────
  if (
    lower.includes('mark') ||
    (lower.includes('done') && !lower.includes('how am i doing')) ||
    lower.includes('complete') ||
    lower.includes('finish') ||
    lower.includes('checked off') ||
    lower.includes('knocked out')
  ) {
    const matchedTask = todayTasks.find(t =>
      !t.completed &&
      t.text.toLowerCase().split(' ').some(word => word.length > 3 && lower.includes(word))
    )
    if (matchedTask) {
      return {
        content: `Got it — want me to mark "${matchedTask.text}" as complete?`,
        actions: [{
          id: `toggle-${matchedTask.id}`,
          type: 'confirm_task_done',
          label: `✓ Mark "${matchedTask.text.slice(0, 40)}${matchedTask.text.length > 40 ? '...' : ''}" as done`,
          payload: { taskId: matchedTask.id },
        }],
      }
    }
    const pending = todayTasks.filter(t => !t.completed)
    if (pending.length === 0) {
      return { content: `Everything for today is already done. Nice work.` }
    }
    return {
      content: `Which task are you finishing?`,
      actions: pending.slice(0, 4).map(t => ({
        id: `toggle-${t.id}`,
        type: 'confirm_task_done' as const,
        label: `✓ ${t.text.slice(0, 42)}${t.text.length > 42 ? '...' : ''}`,
        payload: { taskId: t.id },
      })),
    }
  }

  // ── Update goal progress ──────────────────────────────────────────────────
  if ((lower.includes('update') || lower.includes('set') || lower.includes('change')) && lower.includes('%')) {
    const match = msg.match(/(\d+)\s*%/)
    const pct = match ? parseInt(match[1]) : null
    if (pct !== null && pct >= 0 && pct <= 100) {
      const matchedGoal = activeGoals.find(g =>
        g.text.toLowerCase().split(' ').some(word => word.length > 3 && lower.includes(word))
      )
      if (matchedGoal) {
        return {
          content: `Update "${matchedGoal.text}" to ${pct}%?`,
          actions: [{
            id: `progress-${matchedGoal.id}`,
            type: 'update_goal_progress',
            label: `Set to ${pct}%`,
            payload: { goalId: matchedGoal.id, progress: pct },
          }],
        }
      }
      return {
        content: `Which goal should I update to ${pct}%?`,
        actions: activeGoals.slice(0, 4).map(g => ({
          id: `progress-${g.id}`,
          type: 'update_goal_progress' as const,
          label: `${g.text.slice(0, 35)}... → ${pct}%`,
          payload: { goalId: g.id, progress: pct },
        })),
      }
    }
  }

  // ── Pause / archive ───────────────────────────────────────────────────────
  if (lower.includes('pause') || lower.includes('park') || lower.includes('archive') || lower.includes('put on hold')) {
    const newStatus = lower.includes('archive') ? 'archived' : 'parking'
    const label = newStatus === 'archived' ? 'Archive' : 'Pause'
    const matchedGoal = activeGoals.find(g =>
      g.text.toLowerCase().split(' ').some(word => word.length > 3 && lower.includes(word))
    )
    if (matchedGoal) {
      return {
        content: `${label}ing "${matchedGoal.text}" keeps it in your system but removes it from active focus. Sometimes clearing the plate is the right call. Should I ${label.toLowerCase()} it?`,
        actions: [{
          id: `status-${matchedGoal.id}`,
          type: 'update_goal_status',
          label: `${label} this goal`,
          payload: { goalId: matchedGoal.id, status: newStatus },
        }],
      }
    }
    return {
      content: `Which goal are you thinking of ${label.toLowerCase()}ing?`,
      actions: activeGoals.slice(0, 4).map(g => ({
        id: `status-${g.id}`,
        type: 'update_goal_status' as const,
        label: `${label}: ${g.text.slice(0, 35)}`,
        payload: { goalId: g.id, status: newStatus },
      })),
    }
  }

  // ── Focus / priority ──────────────────────────────────────────────────────
  if (
    lower.includes('focus') ||
    lower.includes('priorit') ||
    lower.includes('most important') ||
    lower.includes('what first') ||
    lower.includes('where to start')
  ) {
    const nextTask = todayTasks.find(t => !t.completed)
    if (nextTask) {
      return {
        content: `Start with "${nextTask.text}" — it's on for ${formatTime(nextTask.scheduled_time)} and it's your next scheduled block. After that, keep the thread going on "${activeGoals[0]?.text?.slice(0, 50) || 'your top goal'}".`,
      }
    }
    if (activeGoals[0]) {
      return {
        content: `Today's list is clear. The highest-value thing you can do right now is plan tomorrow around "${activeGoals[0].text}". Want some suggestions on how to structure it?`,
      }
    }
    return { content: `Set your first active goal from the Goals tab, then I can give you a specific focus.` }
  }

  // ── Last week / reflection ────────────────────────────────────────────────
  if (lower.includes('last week') || lower.includes('reflection') || lower.includes('how did i do last')) {
    if (lastReflection) {
      const winsPart = lastReflection.wins
        ? `Wins: "${lastReflection.wins.slice(0, 100)}${lastReflection.wins.length > 100 ? '...' : ''}"`
        : ''
      const challengePart = lastReflection.challenges
        ? `${winsPart ? '\n' : ''}Challenges: "${lastReflection.challenges.slice(0, 100)}${lastReflection.challenges.length > 100 ? '...' : ''}"`
        : ''
      return {
        content: `From your last weekly reflection:\n\n${winsPart}${challengePart}\n\nIs there something from last week you want to carry forward or address this week?`,
      }
    }
    return {
      content: `You haven't completed a weekly reflection recently. Head to Check-In → Weekly to log your wins and challenges — it's one of the most useful inputs I have for giving you relevant guidance.`,
    }
  }

  // ── Greeting ──────────────────────────────────────────────────────────────
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey') || lower.trim().length < 8) {
    const pending = todayTasks.filter(t => !t.completed).length
    return {
      content: `Hey ${firstName}! ${pending > 0 ? `You've got ${pending} task${pending > 1 ? 's' : ''} to work through today.` : activeGoals.length > 0 ? `${activeGoals.length} goals active.` : `No active goals yet.`} What would you like to dig into?`,
    }
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  const pending = todayTasks.filter(t => !t.completed).length
  return {
    content: `${firstName}, here's where things stand: ${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''}, ${pending} task${pending !== 1 ? 's' : ''} remaining today, momentum ${score}/100${streak > 1 ? `, ${streak}-day streak` : ''}. I can speak to your schedule, goal progress, timelines, or help you think through adjustments. What do you need?`,
  }
}

// ─── Sparkle SVG ──────────────────────────────────────────────────────────────

function SparkleIcon({ size = 18, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
    </svg>
  )
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default function MentorPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [todayTasks, setTodayTasks] = useState<DBTask[]>([])
  const [weekTasks, setWeekTasks] = useState<DBTask[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [username, setUsername] = useState('')
  const [streak, setStreak] = useState(0)
  const [lastReflection, setLastReflection] = useState<{ wins?: string | null; challenges?: string | null } | null>(null)
  const [insight, setInsight] = useState('')
  const [loading, setLoading] = useState(true)
  const [needleOpen, setNeedleOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [typing, setTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionIdRef = useRef<string>('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Generate a per-page-visit session ID for grouping new messages
      sessionIdRef.current = crypto.randomUUID()

      const [
        profileResult,
        goalsResult,
        historyResult,
        fetchedStreak,
        reflectionResult,
      ] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id).order('priority', { ascending: true }),
        supabase.from('mentor_messages')
          .select('role, content')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(20),
        getMorningStreak(user.id),
        supabase.from('weekly_reflections')
          .select('wins, challenges')
          .eq('user_id', user.id)
          .order('week_of', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const name         = profileResult.data?.full_name || ''
      const firstName    = name.split(' ')[0] || 'there'
      const fetchedGoals: Goal[] = goalsResult.data || []
      const historyData  = historyResult.data || []
      const reflection   = reflectionResult.data
        ? { wins: reflectionResult.data.wins, challenges: reflectionResult.data.challenges }
        : null

      const todayStr = toDateStr(new Date())
      const monday   = getMonday(new Date())
      const [todayData, weekData] = await Promise.all([
        getTasksForDate(user.id, todayStr),
        getTasksForWeek(user.id, monday),
      ])
      const completedInWeek = weekData.filter(t => t.completed).length
      const momentumScore   = weekData.length > 0 ? Math.round((completedInWeek / weekData.length) * 100) : 0

      setUserId(user.id)
      setUsername(name)
      setGoals(fetchedGoals)
      setTodayTasks(todayData)
      setWeekTasks(weekData)
      setScore(momentumScore)
      setStreak(fetchedStreak)
      setLastReflection(reflection)
      setInsight(generateInsight(fetchedGoals, todayData, momentumScore))

      // Reconstruct history as ChatMessage objects
      const historyMessages: ChatMessage[] = historyData.map((m, i) => ({
        id: `history-${i}`,
        role: m.role as 'user' | 'assistant',
        content: m.content || '',
      }))

      const activeGoals  = fetchedGoals.filter(g => g.status === 'active')
      const avgProgress  = activeGoals.length > 0
        ? Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length)
        : 0
      const doneToday    = todayData.filter(t => t.completed).length
      const hasHistory   = historyMessages.length > 0

      let openingMessage: ChatMessage
      if (hasHistory) {
        // Returning user — brief welcome back with current snapshot
        openingMessage = {
          id: 'welcome-back',
          role: 'assistant',
          content: `Welcome back, ${firstName}. ${activeGoals.length > 0 ? `${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''} · ${avgProgress}% avg · ${momentumScore}/100 momentum${fetchedStreak > 1 ? ` · ${fetchedStreak}-day streak` : ''}.` : `No active goals yet.`} What's on your mind?`,
        }
      } else {
        // First-time user — full contextual greeting
        const openingContent = activeGoals.length > 0
          ? `Hi ${firstName}! Here's where you stand:\n\n• ${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''} · ${avgProgress}% avg progress\n• ${todayData.length} task${todayData.length !== 1 ? 's' : ''} today · ${doneToday} completed\n• Momentum: ${momentumScore}/100\n\n${generateInsight(fetchedGoals, todayData, momentumScore)}\n\nAsk me about your goals, today's schedule, timelines, or anything you need to think through.`
          : `Hi ${firstName}! I'm your Cadence mentor — I'm connected to your goals, schedule, and progress. You don't have any active goals yet. Head to the Goals tab to set some up and I'll help you build a plan around them. What's on your mind?`
        openingMessage = { id: 'init', role: 'assistant', content: openingContent }
      }

      // Show the last 10 history messages + opening message
      setMessages([...historyMessages.slice(-10), openingMessage])
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const refreshTasks = useCallback(async () => {
    if (!userId) return
    const todayStr = toDateStr(new Date())
    const monday = getMonday(new Date())
    const [todayData, weekData] = await Promise.all([
      getTasksForDate(userId, todayStr),
      getTasksForWeek(userId, monday),
    ])
    setTodayTasks(todayData)
    setWeekTasks(weekData)
    const completed = weekData.filter(t => t.completed).length
    setScore(weekData.length > 0 ? Math.round((completed / weekData.length) * 100) : 0)
  }, [userId])

  const applyAction = async (action: ChatAction, msgId: string) => {
    if (action.type === 'confirm_task_done') {
      const taskId = action.payload.taskId as string
      setTodayTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t))
      setWeekTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t))
      await dbToggleTask(taskId, false)
      // Recalc goal progress from actual task completion so it stays consistent
      // with the daily plan toggle path
      const task = [...todayTasks, ...weekTasks].find(t => t.id === taskId)
      if (task?.goal_id && userId) {
        const newProgress = await recalcGoalProgressFromTasks(task.goal_id, userId)
        if (newProgress !== null) {
          setGoals(prev => prev.map(g => g.id === task.goal_id ? { ...g, progress: newProgress } : g))
        }
      }
      refreshTasks()
    } else if (action.type === 'update_goal_progress') {
      const { goalId, progress } = action.payload as { goalId: string; progress: number }
      // Prefer task-based recalc; fall back to AI value only when goal has no tasks
      const taskBasedProgress = userId ? await recalcGoalProgressFromTasks(goalId, userId) : null
      const finalProgress = taskBasedProgress ?? progress
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, progress: finalProgress } : g))
      if (taskBasedProgress === null) {
        await supabase.from('goals').update({ progress }).eq('id', goalId)
      }
    } else if (action.type === 'update_goal_status') {
      const { goalId, status } = action.payload as { goalId: string; status: string }
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status } : g))
      await supabase.from('goals').update({ status }).eq('id', goalId)
    }

    // Mark action as applied
    setMessages(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, actions: m.actions?.map(a => a.id === action.id ? { ...a, applied: true } : a) }
        : m
    ))

    // Follow-up confirmation
    const confirmMsg: ChatMessage = {
      id: `confirm-${Date.now()}`,
      role: 'assistant',
      content: action.type === 'confirm_task_done'
        ? `Done — task marked as complete.`
        : action.type === 'update_goal_progress'
          ? `Progress updated to ${(action.payload as { progress: number }).progress}%.`
          : `Goal status updated.`,
    }
    setMessages(prev => [...prev, confirmMsg])
  }

  const sendMessage = async () => {
    const text = inputText.trim()
    if (!text || typing) return
    setInputText('')

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setTyping(true)

    // Simulate a natural thinking pause
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600))

    const ctx: MentorContext = { goals, todayTasks, weekTasks, score, username, streak, lastReflection }
    const response = buildMentorResponse(text, ctx)
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response.content,
      actions: response.actions,
    }

    setTyping(false)
    setMessages(prev => [...prev, assistantMsg])

    // Persist both sides of the exchange to mentor_messages
    if (userId && sessionIdRef.current) {
      await supabase.from('mentor_messages').insert([
        { user_id: userId, session_id: sessionIdRef.current, role: 'user',      content: text },
        { user_id: userId, session_id: sessionIdRef.current, role: 'assistant', content: response.content },
      ])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const bottomLine = generateBottomLine(todayTasks, goals)
  const catGroups = [...new Set(todayTasks.map(t => t.category))]

  return (
    <div style={{ padding: '56px 16px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: 0, letterSpacing: '-0.4px' }}>Your Mentor</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', marginTop: 3 }}>{dailyVariant(COPY.mentor_subtitle, userId || '')}</p>
      </div>

      {/* Today's Insight Card */}
      <div className="card-enter" style={{
        animationDelay: '60ms',
        background: 'linear-gradient(135deg, #6B3FFF 0%, #3B7DFF 100%)',
        borderRadius: 24, padding: '20px', marginBottom: 14,
        position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 4px 24px rgba(107,63,255,0.24), 0 1px 4px rgba(59,125,255,0.14)',
      }}>
        <div className="card-glass-shimmer" />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <SparkleIcon size={16} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              Today&apos;s Insight
            </span>
          </div>
          <SparkleIcon size={22} color="rgba(255,255,255,0.4)" />
        </div>
        <p style={{
          fontSize: 18, fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.45,
          letterSpacing: '-0.3px', position: 'relative',
        }}>
          {insight}
        </p>
        <div style={{ marginTop: 16, position: 'relative' }}>
          <SparkleIcon size={14} color="rgba(255,255,255,0.3)" />
        </div>
      </div>

      {/* Moving the Needle Card */}
      <div className="card-enter" style={{
        animationDelay: '140ms',
        background: 'white', borderRadius: 24, marginBottom: 14,
        border: '0.5px solid #E5E5EA', overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 28px rgba(0,0,0,0.08)',
      }}>
        <button
          onClick={() => setNeedleOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 20px', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(22,163,74,0.20), 0 1px 2px rgba(0,0,0,0.06)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>
              How You&apos;ll Move the Needle Today
            </p>
            <p style={{ fontSize: 13, color: '#8E8E93', margin: '2px 0 0' }}>
              {needleOpen ? 'Hide breakdown' : 'Detailed impact breakdown'}
            </p>
          </div>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#8E8E93" strokeWidth="2" strokeLinecap="round"
            style={{ transform: needleOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {needleOpen && (
          <div style={{ padding: '0 20px 20px' }}>
            {todayTasks.length === 0 ? (
              <div style={{
                background: '#F2F2F7', borderRadius: 12, padding: '16px',
                textAlign: 'center', color: '#8E8E93',
              }}>
                <p style={{ fontSize: 14, margin: 0 }}>No tasks scheduled for today.</p>
                <p style={{ fontSize: 12, margin: '4px 0 0' }}>Head to Plan to schedule your day.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#3C3C43', marginBottom: 14, lineHeight: 1.5 }}>
                  Completing today&apos;s {todayTasks.length} task{todayTasks.length > 1 ? 's' : ''} will advance you across {catGroups.length} goal area{catGroups.length > 1 ? 's' : ''}. Here&apos;s the specific impact:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {todayTasks.map((task, i) => {
                    const catStyle = getCatStyle(task.category)
                    const impact = getTaskImpact(task.category, i)
                    const linkedGoal = activeGoals.find(g =>
                      g.category === task.category || g.text.toLowerCase().includes(task.category.toLowerCase())
                    )
                    return (
                      <div key={task.id} style={{
                        background: '#FAFAFA', borderRadius: 16, padding: '14px',
                        border: task.completed ? '1px solid #D1FAE5' : '0.5px solid #E5E5EA',
                        opacity: task.completed ? 0.7 : 1,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: catStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 2px 8px ${catStyle.color}30, 0 1px 2px rgba(0,0,0,0.05)`,
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={catStyle.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill={catStyle.color} />
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{
                              fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: 0,
                              textDecoration: task.completed ? 'line-through' : 'none',
                            }}>
                              {task.text}
                            </p>
                            <p style={{ fontSize: 12, color: '#8E8E93', margin: '2px 0 0' }}>
                              Goal: {linkedGoal?.category || task.category}
                            </p>
                          </div>
                        </div>
                        <div style={{
                          background: '#F0FFF4', borderRadius: 8, padding: '8px 10px',
                          border: '0.5px solid #BBFAD6',
                        }}>
                          <p style={{ fontSize: 12, color: '#16A34A', margin: 0, fontWeight: 500 }}>
                            <span style={{ fontWeight: 700 }}>Impact:</span> {impact}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Bottom Line */}
                <div style={{
                  background: 'linear-gradient(135deg, #F0FDFA 0%, #ECFDF5 100%)',
                  borderRadius: 14, padding: '14px 16px',
                  border: '1px solid rgba(167,243,208,0.8)',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(16,185,129,0.10)',
                }}>
                  <div className="card-glass-shimmer-light" />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#065F46', margin: '0 0 6px' }}>
                    Bottom Line
                  </p>
                  <p style={{ fontSize: 13, color: '#047857', margin: 0, lineHeight: 1.5 }}>
                    {bottomLine}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Ask Your Mentor */}
      <div className="card-enter" style={{
        animationDelay: '220ms',
        background: 'white', borderRadius: 24, marginBottom: 14,
        border: '0.5px solid #E5E5EA', overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 28px rgba(0,0,0,0.08)',
      }}>
        <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(107,63,255,0.20), 0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B3FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="9" r="5" />
              <path d="M9 14.5A3 3 0 009 20h6a3 3 0 000-5.5" />
              <line x1="12" y1="18" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Ask Your Mentor</h2>
            <p style={{ fontSize: 13, color: '#8E8E93', margin: '2px 0 0' }}>
              Get personalized advice anytime
            </p>
          </div>
        </div>

        {/* Chat Messages */}
        <div style={{
          padding: '0 14px', maxHeight: 380, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {messages.map(msg => (
            <div key={msg.id} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 6,
            }}>
              {msg.role === 'assistant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED' }}>Mentor</span>
                </div>
              )}
              <div style={{
                maxWidth: '86%',
                background: msg.role === 'user' ? '#3B7DFF' : '#F2F2F7',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '10px 13px',
              }}>
                <p style={{
                  fontSize: 14, margin: 0, lineHeight: 1.5,
                  color: msg.role === 'user' ? 'white' : '#1C1C1E',
                  whiteSpace: 'pre-line',
                }}>
                  {msg.content}
                </p>
              </div>

              {/* Action buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '86%' }}>
                  {msg.actions.map(action => (
                    <button
                      key={action.id}
                      onClick={() => !action.applied && applyAction(action, msg.id)}
                      className={action.applied ? undefined : 'card-press'}
                      style={{
                        background: action.applied ? '#F0FFF4' : 'white',
                        border: action.applied ? '1px solid #A7F3D0' : '1px solid #3B7DFF',
                        borderRadius: 10, padding: '8px 12px',
                        fontSize: 13, fontWeight: 600,
                        color: action.applied ? '#16A34A' : '#3B7DFF',
                        cursor: action.applied ? 'default' : 'pointer',
                        fontFamily: 'inherit', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      {action.applied ? '✓ Applied' : action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div style={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED' }}>Mentor</span>
              </div>
              <div style={{
                background: '#F2F2F7', borderRadius: '18px 18px 18px 4px',
                padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#8E8E93',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} style={{ height: 8 }} />
        </div>

        {/* Input area */}
        <div data-tour="mentor-input" style={{ padding: '12px 14px 16px', borderTop: '0.5px solid #F2F2F7' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              background: '#F2F2F7', borderRadius: 22, padding: '10px 16px',
            }}>
              <input
                ref={inputRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your goals, schedule, or progress."
                className="cadence-input"
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit',
                }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || typing}
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: inputText.trim() && !typing ? '#3B7DFF' : '#D1D1D6',
                cursor: inputText.trim() && !typing ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#8E8E93', margin: 0, paddingLeft: 4 }}>
            Ask about goals, timelines, tasks, schedules, or progress
          </p>
        </div>
      </div>

      {/* Quick Nav */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <button
          onClick={() => router.push('/dashboard/goals')}
          className="card-press"
          style={{
            background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 16,
            padding: '16px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 28px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="#3B7DFF" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>View Goals</p>
        </button>

        <button
          onClick={() => router.push('/dashboard/plan')}
          className="card-press"
          style={{
            background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 16,
            padding: '16px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 28px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>View Schedule</p>
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
