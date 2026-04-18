export interface PlanTask {
  id: string
  text: string
  date: string          // YYYY-MM-DD
  scheduledTime: string // HH:MM
  duration: number      // hours
  category: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

export interface ScheduleBlock {
  id: string
  title: string
  date: string
  startTime: string   // HH:MM
  duration: number    // minutes
  category: string    // work, personal, health, creative, break
  isFlexible: boolean
}

export interface WeeklyReflection {
  id: string
  weekOf: string
  wins: string
  challenges: string
  learnings: string
  nextWeekFocus: string
  weekScore: number
  timestamp: string
}

const TASKS_KEY = 'cadence_plan_tasks'
const SCHEDULE_KEY = 'cadence_schedule'
const REFLECTIONS_KEY = 'cadence_reflections'

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
  return r
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

export function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function generateSeedTasks(): PlanTask[] {
  const today = new Date()
  const todayStr = toDateStr(today)
  const monday = getMonday(today)

  const weekData = [
    {
      offset: 0,
      tasks: [
        { text: 'Deep work: Portfolio case study', time: '09:00', dur: 2, cat: 'Career', pri: 'high' as const },
        { text: 'Morning run - 5k', time: '07:00', dur: 0.5, cat: 'Health', pri: 'medium' as const },
        { text: 'Budget review', time: '14:00', dur: 1, cat: 'Finance', pri: 'medium' as const },
        { text: 'Blog post writing', time: '15:00', dur: 1.5, cat: 'Creative', pri: 'low' as const },
      ],
    },
    {
      offset: 1,
      tasks: [
        { text: 'Review monthly budget', time: '10:00', dur: 1, cat: 'Finance', pri: 'high' as const },
        { text: 'Team standup', time: '09:00', dur: 0.5, cat: 'Career', pri: 'medium' as const },
        { text: 'Write blog post draft', time: '14:00', dur: 2, cat: 'Creative', pri: 'medium' as const },
      ],
    },
    {
      offset: 2,
      tasks: [
        { text: 'Portfolio case study - deep work', time: '09:00', dur: 3, cat: 'Career', pri: 'high' as const },
        { text: 'LinkedIn content creation', time: '13:00', dur: 1, cat: 'Career', pri: 'medium' as const },
        { text: 'Gym workout', time: '07:00', dur: 1, cat: 'Health', pri: 'medium' as const },
      ],
    },
    {
      offset: 3,
      tasks: [
        { text: 'Morning run', time: '07:00', dur: 0.5, cat: 'Health', pri: 'medium' as const },
        { text: 'Email inbox zero', time: '09:00', dur: 1, cat: 'Career', pri: 'low' as const },
        { text: 'Short story writing session', time: '11:00', dur: 1.5, cat: 'Creative', pri: 'medium' as const },
      ],
    },
    {
      offset: 4,
      tasks: [
        { text: 'Portfolio final touches', time: '09:00', dur: 2, cat: 'Career', pri: 'high' as const },
        { text: 'Morning run', time: '07:00', dur: 0.5, cat: 'Health', pri: 'medium' as const },
        { text: 'Creative writing session', time: '14:00', dur: 1.5, cat: 'Creative', pri: 'medium' as const },
        { text: 'Financial review', time: '16:00', dur: 1, cat: 'Finance', pri: 'low' as const },
      ],
    },
    {
      offset: 5,
      tasks: [
        { text: 'Long run - 8k', time: '08:00', dur: 1, cat: 'Health', pri: 'high' as const },
        { text: 'Creative writing - chapter draft', time: '10:00', dur: 2, cat: 'Creative', pri: 'medium' as const },
      ],
    },
    {
      offset: 6,
      tasks: [
        { text: 'Weekly planning session', time: '10:00', dur: 1, cat: 'Career', pri: 'medium' as const },
      ],
    },
  ]

  const tasks: PlanTask[] = []
  weekData.forEach(day => {
    const date = toDateStr(addDays(monday, day.offset))
    day.tasks.forEach((t, i) => {
      tasks.push({
        id: `seed-${day.offset}-${i}`,
        text: t.text,
        date,
        scheduledTime: t.time,
        duration: t.dur,
        category: t.cat,
        priority: t.pri,
        completed: date < todayStr,
      })
    })
  })

  return tasks
}

function generateSeedSchedule(): ScheduleBlock[] {
  const today = new Date()
  const todayStr = toDateStr(today)

  return [
    { id: 's1', title: 'Morning Routine', date: todayStr, startTime: '07:00', duration: 30, category: 'personal', isFlexible: false },
    { id: 's2', title: 'Deep Work Block', date: todayStr, startTime: '07:30', duration: 120, category: 'work', isFlexible: false },
    { id: 's3', title: 'Break', date: todayStr, startTime: '09:30', duration: 15, category: 'break', isFlexible: true },
    { id: 's4', title: 'Creative Work', date: todayStr, startTime: '09:45', duration: 90, category: 'creative', isFlexible: false },
    { id: 's5', title: 'Lunch Break', date: todayStr, startTime: '11:15', duration: 60, category: 'break', isFlexible: true },
    { id: 's6', title: 'Light Tasks & Email', date: todayStr, startTime: '12:15', duration: 90, category: 'work', isFlexible: true },
    { id: 's7', title: 'Exercise', date: todayStr, startTime: '14:00', duration: 60, category: 'health', isFlexible: false },
    { id: 's8', title: 'Evening Wind Down', date: todayStr, startTime: '15:30', duration: 30, category: 'personal', isFlexible: true },
  ]
}

export function getAllTasks(): PlanTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    if (!raw) {
      const seed = generateSeedTasks()
      localStorage.setItem(TASKS_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveTasks(tasks: PlanTask[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
}

export function getTasksForDate(date: string): PlanTask[] {
  return getAllTasks()
    .filter(t => t.date === date)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
}

export function getTasksForWeek(monday: Date): PlanTask[] {
  const start = toDateStr(monday)
  const end = toDateStr(addDays(monday, 6))
  return getAllTasks().filter(t => t.date >= start && t.date <= end)
}

export function toggleTask(id: string): PlanTask[] {
  const tasks = getAllTasks()
  const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
  saveTasks(updated)
  return updated
}

export function addTask(task: Omit<PlanTask, 'id'>): PlanTask[] {
  const tasks = getAllTasks()
  const newTask: PlanTask = { ...task, id: `task-${Date.now()}` }
  const updated = [...tasks, newTask]
  saveTasks(updated)
  return updated
}

export function getMomentumScore(): number {
  const today = new Date()
  const monday = getMonday(today)
  const weekTasks = getTasksForWeek(monday)
  if (weekTasks.length === 0) return 0
  const completed = weekTasks.filter(t => t.completed).length
  return Math.round((completed / weekTasks.length) * 100)
}

export function getWeekSummary(monday: Date) {
  const tasks = getTasksForWeek(monday)
  const totalHours = parseFloat(tasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
  const completedHours = parseFloat(tasks.filter(t => t.completed).reduce((s, t) => s + t.duration, 0).toFixed(1))
  return {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.completed).length,
    totalHours,
    completedHours,
  }
}

export function getDayFocusCategories(date: string): string[] {
  const tasks = getTasksForDate(date)
  const cats = [...new Set(tasks.map(t => t.category))]
  return cats.slice(0, 2)
}

export function getAllSchedule(): ScheduleBlock[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (!raw) {
      const seed = generateSeedSchedule()
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function getScheduleForDate(date: string): ScheduleBlock[] {
  return getAllSchedule()
    .filter(s => s.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export function saveSchedule(items: ScheduleBlock[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(items))
}

export function getAllReflections(): WeeklyReflection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(REFLECTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveReflection(r: Omit<WeeklyReflection, 'id' | 'timestamp'>): void {
  const all = getAllReflections()
  const existing = all.findIndex(x => x.weekOf === r.weekOf)
  const entry: WeeklyReflection = { ...r, id: `ref-${Date.now()}`, timestamp: new Date().toISOString() }
  if (existing >= 0) {
    all[existing] = entry
  } else {
    all.push(entry)
  }
  localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(all))
}

export const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Career:           { bg: '#EFF6FF', color: '#3B7DFF' },
  Finance:          { bg: '#F0FFF4', color: '#16A34A' },
  Health:           { bg: '#FFF0F5', color: '#EC4899' },
  Creative:         { bg: '#FFF7ED', color: '#EA580C' },
  Travel:           { bg: '#F0F9FF', color: '#0284C7' },
  Relationships:    { bg: '#FDF4FF', color: '#9333EA' },
  Business:         { bg: '#FFFBEB', color: '#D97706' },
  Community:        { bg: '#F0FDF4', color: '#15803D' },
  'Personal Growth':{ bg: '#FDF4FF', color: '#9333EA' },
  Education:        { bg: '#EFF6FF', color: '#3B7DFF' },
}

export function getCatStyle(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: '#F2F2F7', color: '#8E8E93' }
}
