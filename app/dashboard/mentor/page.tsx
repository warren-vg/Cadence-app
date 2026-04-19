'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  toDateStr, getMonday, getTasksForDate, getTasksForWeek, getMomentumScore,
  getAllTasks, saveTasks, formatTime, getCatStyle,
  type PlanTask,
} from '@/lib/planData'

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

function generateInsight(goals: Goal[], tasks: PlanTask[], score: number): string {
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

function generateBottomLine(tasks: PlanTask[], goals: Goal[]): string {
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
  goals: Goal[],
  todayTasks: PlanTask[],
  score: number,
  username: string,
): { content: string; actions?: ChatAction[] } {
  const lower = msg.toLowerCase()
  const firstName = username.split(' ')[0] || 'you'
  const activeGoals = goals.filter(g => g.status === 'active')

  // Schedule / today queries
  if (
    lower.includes('schedule') ||
    lower.includes('what') && (lower.includes('today') || lower.includes('do i have')) ||
    lower.includes('plan for today') ||
    lower.includes('today entail') ||
    lower.includes('tasks today')
  ) {
    if (todayTasks.length === 0) {
      return {
        content: `Your schedule for today is clear — no tasks planned yet. I'd recommend heading to your Plan tab and blocking time for your top priority. ${activeGoals[0] ? `Right now that's "${activeGoals[0].text}".` : 'Add a goal first, then we can break it into daily actions.'} Want some suggestions on how to structure the day?`,
      }
    }
    const done = todayTasks.filter(t => t.completed).length
    const taskList = todayTasks.map(t =>
      `• ${t.text} at ${formatTime(t.scheduledTime)} (${t.duration}h, ${t.category})`
    ).join('\n')
    return {
      content: `You have ${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} scheduled for today:\n\n${taskList}\n\n${done > 0 ? `You've already completed ${done} of them — solid progress.` : `None completed yet — get started with the first one to build momentum.`} ${done === todayTasks.length && done > 0 ? "You've finished everything for today. Outstanding." : ''} Need help prioritizing?`,
    }
  }

  // Goals / progress queries
  if (
    lower.includes('goal') ||
    lower.includes('how am i doing') ||
    lower.includes('progress') && !lower.includes('%') ||
    lower.includes('status')
  ) {
    if (activeGoals.length === 0) {
      return {
        content: `You don't have any active goals right now. Head to the Goals tab to activate some from your inbox, or evaluate a new one. The clearer your targets, the better I can guide you.`,
      }
    }
    const avg = Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length)
    const summary = activeGoals.slice(0, 4).map(g =>
      `• ${g.text} — ${g.progress || 0}% (${g.category}${g.quarter ? `, ${g.quarter}` : ''})`
    ).join('\n')
    return {
      content: `Here's where you stand across your ${activeGoals.length} active goal${activeGoals.length > 1 ? 's' : ''}:\n\n${summary}\n\nAverage progress: ${avg}%. ${avg >= 60 ? "You're ahead of the curve — keep the consistency." : avg >= 30 ? "You're building momentum. Double down on your highest priority goal this week." : "These goals are still early. The key is showing up consistently — progress compounds quietly."}`,
    }
  }

  // Momentum / performance queries
  if (
    lower.includes('momentum') ||
    lower.includes('score') ||
    lower.includes('performing') ||
    lower.includes('how have i')
  ) {
    const monday = getMonday(new Date())
    const weekTasks = getTasksForWeek(monday)
    const weekDone = weekTasks.filter(t => t.completed).length
    return {
      content: `Your momentum score is ${score}/100 this week. You've completed ${weekDone} of ${weekTasks.length} tasks. ${
        score >= 70
          ? "That's strong — you're building real traction. This consistency will show in your goal progress within weeks."
          : score >= 40
            ? "You're in the game. To push higher, prioritize your highest-value tasks first each day — even just completing those moves the score significantly."
            : "Momentum is built through small wins. Pick one task right now and complete it. That's how the upward spiral starts."
      }`,
    }
  }

  // Timeline / deadlines
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
        content: `None of your active goals have target quarters set. I'd recommend assigning timelines so we can track whether you're on pace. Head to any goal's detail page to set one — it's the difference between a dream and a plan.`,
      }
    }
    const onTrack = withDeadlines.filter(g => (g.progress || 0) >= 25)
    const atRisk = withDeadlines.filter(g => (g.progress || 0) < 25)
    let response = `Timeline check on your ${withDeadlines.length} goal${withDeadlines.length > 1 ? 's' : ''} with deadlines:\n\n`
    if (onTrack.length > 0) response += `✓ On track: ${onTrack.map(g => `${g.text.slice(0, 35)} (${g.quarter})`).join(', ')}\n`
    if (atRisk.length > 0) response += `⚠ Needs attention: ${atRisk.map(g => `${g.text.slice(0, 35)} (${g.quarter}, ${g.progress || 0}%)`).join(', ')}`
    if (atRisk.length > 0) {
      const hrs = atRisk[0].estimated_weekly_hours || 3
      response += `\n\nFor goals at risk, I'd suggest scheduling at least ${hrs} focused hours per week and breaking them into weekly milestones. Want me to help you think through a catch-up plan?`
    }
    return { content: response }
  }

  // Advice / suggestions / pivot
  if (
    lower.includes('advice') ||
    lower.includes('suggest') ||
    lower.includes('recommend') ||
    lower.includes('should i') ||
    lower.includes('what if') ||
    lower.includes('help me') ||
    lower.includes('pivot') ||
    lower.includes('adjust') ||
    lower.includes('struggling')
  ) {
    const nextTask = todayTasks.find(t => !t.completed)
    const topGoal = activeGoals[0]
    let advice = ''
    if (nextTask) {
      advice += `Your most immediate move is to complete "${nextTask.text}" — it's scheduled for ${formatTime(nextTask.scheduledTime)} and directly advances your ${nextTask.category} goal.\n\n`
    }
    if (topGoal) {
      const hrs = topGoal.estimated_weekly_hours || 3
      advice += `For your top goal — "${topGoal.text}" — aim for ${hrs} focused hours per week. `
      if ((topGoal.progress || 0) < 30) {
        advice += `At ${topGoal.progress || 0}% progress, the biggest lever is consistency over intensity. Short daily sessions beat occasional marathon sessions.`
      } else if ((topGoal.progress || 0) < 70) {
        advice += `At ${topGoal.progress || 0}% progress, you're in the execution phase. Protect your deep work blocks for this goal.`
      } else {
        advice += `At ${topGoal.progress || 0}% progress, you're in the home stretch. Don't take your foot off the gas now — finish strong.`
      }
    }
    return {
      content: advice || `Tell me more about what you're trying to decide — I can give specific guidance with more details. What specifically are you working through?`,
    }
  }

  // Mark task complete
  if (
    lower.includes('mark') ||
    lower.includes('done') && !lower.includes('how am i doing') ||
    lower.includes('complete') ||
    lower.includes('finish')
  ) {
    const matchedTask = todayTasks.find(t =>
      !t.completed &&
      t.text.toLowerCase().split(' ').some(word => word.length > 3 && lower.includes(word))
    )
    if (matchedTask) {
      return {
        content: `I can mark "${matchedTask.text}" as complete. Confirm below:`,
        actions: [{
          id: `toggle-${matchedTask.id}`,
          type: 'confirm_task_done',
          label: `✓ Mark "${matchedTask.text.slice(0, 35)}${matchedTask.text.length > 35 ? '...' : ''}" as done`,
          payload: { taskId: matchedTask.id },
        }],
      }
    }
    const pending = todayTasks.filter(t => !t.completed)
    if (pending.length === 0) return { content: `All your tasks for today are already complete! That's a great day. Start planning tomorrow or head to the weekly review.` }
    if (pending.length > 0) {
      return {
        content: `Which task would you like to mark as done?`,
        actions: pending.slice(0, 4).map(t => ({
          id: `toggle-${t.id}`,
          type: 'confirm_task_done' as const,
          label: `✓ ${t.text.slice(0, 40)}${t.text.length > 40 ? '...' : ''}`,
          payload: { taskId: t.id },
        })),
      }
    }
  }

  // Update goal progress
  if ((lower.includes('update') || lower.includes('set') || lower.includes('change')) && lower.includes('%')) {
    const match = msg.match(/(\d+)\s*%/)
    const pct = match ? parseInt(match[1]) : null
    if (pct !== null && pct >= 0 && pct <= 100) {
      const matchedGoal = activeGoals.find(g =>
        g.text.toLowerCase().split(' ').some(word => word.length > 3 && lower.includes(word))
      )
      if (matchedGoal) {
        return {
          content: `I'll update "${matchedGoal.text}" progress to ${pct}%. Confirm:`,
          actions: [{
            id: `progress-${matchedGoal.id}`,
            type: 'update_goal_progress',
            label: `Update to ${pct}%`,
            payload: { goalId: matchedGoal.id, progress: pct },
          }],
        }
      }
      return {
        content: `Which goal should I update to ${pct}%?`,
        actions: activeGoals.slice(0, 4).map(g => ({
          id: `progress-${g.id}`,
          type: 'update_goal_progress' as const,
          label: `${g.text.slice(0, 32)}... → ${pct}%`,
          payload: { goalId: g.id, progress: pct },
        })),
      }
    }
  }

  // Pause / archive a goal
  if (lower.includes('pause') || lower.includes('park') || lower.includes('archive') || lower.includes('put on hold')) {
    const newStatus = lower.includes('archive') ? 'archived' : 'parking'
    const label = newStatus === 'archived' ? 'Archive' : 'Pause'
    const matchedGoal = activeGoals.find(g =>
      g.text.toLowerCase().split(' ').some(word => word.length > 3 && lower.includes(word))
    )
    if (matchedGoal) {
      return {
        content: `${label}ing keeps the goal in your system but removes it from your active focus. Sometimes that's the right call — capacity is a real constraint. Should I ${label.toLowerCase()} "${matchedGoal.text}"?`,
        actions: [{
          id: `status-${matchedGoal.id}`,
          type: 'update_goal_status',
          label: `${label} this goal`,
          payload: { goalId: matchedGoal.id, status: newStatus },
        }],
      }
    }
    return {
      content: `Which goal are you thinking about ${label.toLowerCase()}ing? Here are your active ones:`,
      actions: activeGoals.slice(0, 4).map(g => ({
        id: `status-${g.id}`,
        type: 'update_goal_status' as const,
        label: `${label}: ${g.text.slice(0, 32)}...`,
        payload: { goalId: g.id, status: newStatus },
      })),
    }
  }

  // Priority / focus queries
  if (
    lower.includes('focus') ||
    lower.includes('priorit') ||
    lower.includes('most important') ||
    lower.includes('first')
  ) {
    const nextTask = todayTasks.find(t => !t.completed)
    if (nextTask) {
      return {
        content: `Right now, your highest priority is "${nextTask.text}" — scheduled for ${formatTime(nextTask.scheduledTime)}, ${nextTask.priority} priority, advancing your ${nextTask.category} goal.\n\nAfter that, your north star for the week is "${activeGoals[0]?.text || 'your top active goal'}". Every completed task today is a vote for who you're becoming.`,
      }
    }
    if (activeGoals[0]) {
      return {
        content: `All of today's tasks are done — nicely done! Your next focus should be planning tomorrow around "${activeGoals[0].text}". Would you like suggestions on how to break that into tomorrow's schedule?`,
      }
    }
  }

  // Greeting
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey') || lower.trim() === 'hey' || lower.trim() === 'hi') {
    return {
      content: `Hey ${firstName}! I'm fully up to speed on your goals, schedule, and progress. I can help you navigate priorities, review timelines, suggest adjustments, or just tell you where things stand. What would you like to work through?`,
    }
  }

  // Summary fallback
  const pending = todayTasks.filter(t => !t.completed).length
  return {
    content: `Here's your snapshot, ${firstName}: ${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''}, ${pending} task${pending !== 1 ? 's' : ''} remaining today, momentum score ${score}/100. I can speak to your schedule, goal progress, timelines, or help you think through any adjustments. What would you like to dig into?`,
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
  const [todayTasks, setTodayTasks] = useState<PlanTask[]>([])
  const [score, setScore] = useState(0)
  const [username, setUsername] = useState('')
  const [insight, setInsight] = useState('')
  const [loading, setLoading] = useState(true)
  const [needleOpen, setNeedleOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [typing, setTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: profile }, { data: goalsData }] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id).order('priority', { ascending: true }),
      ])

      const name = profile?.username || ''
      const fetchedGoals: Goal[] = goalsData || []
      const todayStr = toDateStr(new Date())
      const tasks = getTasksForDate(todayStr)
      const momentumScore = getMomentumScore()

      setUsername(name)
      setGoals(fetchedGoals)
      setTodayTasks(tasks)
      setScore(momentumScore)
      setInsight(generateInsight(fetchedGoals, tasks, momentumScore))

      const firstName = name.split(' ')[0] || 'there'
      setMessages([{
        id: 'init',
        role: 'assistant',
        content: `Hi ${firstName}! I'm your AI mentor. I can help you with questions about your goals, schedule, progress, and timeline. What would you like to know?`,
      }])

      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const refreshTasks = useCallback(() => {
    const todayStr = toDateStr(new Date())
    const updated = getTasksForDate(todayStr)
    setTodayTasks(updated)
    setScore(getMomentumScore())
  }, [])

  const applyAction = async (action: ChatAction, msgId: string) => {
    if (action.type === 'confirm_task_done') {
      const allTasks = getAllTasks()
      const updated = allTasks.map(t =>
        t.id === action.payload.taskId ? { ...t, completed: true } : t
      )
      saveTasks(updated)
      refreshTasks()
    } else if (action.type === 'update_goal_progress') {
      const { goalId, progress } = action.payload as { goalId: string; progress: number }
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, progress } : g))
      await supabase.from('goals').update({ progress }).eq('id', goalId)
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
        ? `Done! Task marked as complete. Your momentum score has been updated.`
        : action.type === 'update_goal_progress'
          ? `Progress updated to ${(action.payload as { progress: number }).progress}%. Keep pushing.`
          : `Goal status updated. Your active goals list has been refreshed.`,
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

    // Simulate processing delay
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600))

    const response = buildMentorResponse(text, goals, todayTasks, score, username)
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response.content,
      actions: response.actions,
    }

    setTyping(false)
    setMessages(prev => [...prev, assistantMsg])
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
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Your Mentor</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', marginTop: 3 }}>Guidance tailored to your journey</p>
      </div>

      {/* Today's Insight Card */}
      <div style={{
        background: 'linear-gradient(135deg, #6B3FFF 0%, #3B7DFF 100%)',
        borderRadius: 20, padding: '20px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
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
          letterSpacing: '-0.2px',
        }}>
          {insight}
        </p>
        <div style={{ marginTop: 16 }}>
          <SparkleIcon size={14} color="rgba(255,255,255,0.3)" />
        </div>
      </div>

      {/* Moving the Needle Card */}
      <div style={{
        background: 'white', borderRadius: 20, marginBottom: 14,
        border: '0.5px solid #E5E5EA', overflow: 'hidden',
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
                        background: '#FAFAFA', borderRadius: 14, padding: '14px',
                        border: task.completed ? '1px solid #D1FAE5' : '0.5px solid #E5E5EA',
                        opacity: task.completed ? 0.7 : 1,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: catStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                  border: '1px solid #A7F3D0',
                }}>
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
      <div style={{
        background: 'white', borderRadius: 20, marginBottom: 14,
        border: '0.5px solid #E5E5EA', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px 14px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Ask Your Mentor</h2>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: '3px 0 0' }}>
            Get insights about your goals, schedule, and progress
          </p>
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
        <div style={{ padding: '12px 14px 16px', borderTop: '0.5px solid #F2F2F7' }}>
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
          style={{
            background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 16,
            padding: '16px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
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
          style={{
            background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 16,
            padding: '16px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
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
