export type ProjectType = 'campaign' | 'study' | 'creative' | 'opportunity'
export type ProjectStatus = 'active' | 'planning' | 'paused' | 'completed' | 'archived'

export interface ProjectTask {
  id: string
  text: string
  completed: boolean
}

export interface Project {
  id: string
  title: string
  type: ProjectType
  status: ProjectStatus
  progress: number
  timeline?: string
  notes?: string
  linkedGoalIds?: string[]
  tasks?: ProjectTask[]
  createdAt: string
}

const KEY = 'cadence_projects'

const SEED: Project[] = [
  {
    id: 'p1', title: 'Design Portfolio Website', type: 'campaign', status: 'active',
    progress: 75, timeline: 'Mar – Apr 2026', createdAt: '2026-03-01',
    linkedGoalIds: [],
    tasks: [
      { id: 'pt1', text: 'Finalize homepage design', completed: true },
      { id: 'pt2', text: 'Build case study templates', completed: true },
      { id: 'pt3', text: 'Write about page copy', completed: false },
      { id: 'pt4', text: 'Set up analytics', completed: false },
    ],
  },
  {
    id: 'p2', title: '6-Month Savings Plan', type: 'study', status: 'active',
    progress: 50, timeline: 'Jan – Jun 2026', createdAt: '2026-01-01',
    linkedGoalIds: [],
    tasks: [
      { id: 'pt5', text: 'Open high-yield savings account', completed: true },
      { id: 'pt6', text: 'Set up automatic transfers', completed: true },
      { id: 'pt7', text: 'Review monthly spending', completed: false },
    ],
  },
  {
    id: 'p3', title: 'Short Story Collection', type: 'creative', status: 'planning',
    progress: 20, timeline: 'Q3 2026', createdAt: '2026-04-01',
    linkedGoalIds: [],
    tasks: [
      { id: 'pt8', text: 'Outline all 5 stories', completed: true },
      { id: 'pt9', text: 'Draft story 1', completed: false },
      { id: 'pt10', text: 'Draft story 2', completed: false },
      { id: 'pt11', text: 'Edit and revise', completed: false },
      { id: 'pt12', text: 'Format for publication', completed: false },
    ],
  },
]

function loadFromStorage(): Project[] {
  if (typeof window === 'undefined') return SEED
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return SEED
}

function saveToStorage(projects: Project[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(projects)) } catch { /* ignore */ }
}

export function getProjects(): Project[] {
  return loadFromStorage()
}

export function getProjectById(id: string): Project | undefined {
  return loadFromStorage().find(p => p.id === id)
}

export function saveProject(project: Project): Project[] {
  const all = loadFromStorage()
  const idx = all.findIndex(p => p.id === project.id)
  let updated: Project[]
  if (idx >= 0) {
    updated = all.map(p => p.id === project.id ? project : p)
  } else {
    updated = [...all, project]
  }
  saveToStorage(updated)
  return updated
}

export function archiveProject(id: string): Project[] {
  const all = loadFromStorage().map(p => p.id === id ? { ...p, status: 'archived' as ProjectStatus } : p)
  saveToStorage(all)
  return all
}

export function restoreProject(id: string): Project[] {
  const all = loadFromStorage().map(p => p.id === id ? { ...p, status: 'active' as ProjectStatus } : p)
  saveToStorage(all)
  return all
}

export function deleteProject(id: string): Project[] {
  const all = loadFromStorage().filter(p => p.id !== id)
  saveToStorage(all)
  return all
}

export function linkGoalToProject(projectId: string, goalId: string): void {
  const all = loadFromStorage()
  const updated = all.map(p => {
    if (p.id !== projectId) return p
    const ids = p.linkedGoalIds || []
    if (ids.includes(goalId)) return p
    return { ...p, linkedGoalIds: [...ids, goalId] }
  })
  saveToStorage(updated)
}

export function unlinkGoalFromProject(projectId: string, goalId: string): void {
  const all = loadFromStorage()
  const updated = all.map(p => {
    if (p.id !== projectId) return p
    return { ...p, linkedGoalIds: (p.linkedGoalIds || []).filter(id => id !== goalId) }
  })
  saveToStorage(updated)
}

export function getProjectsForGoal(goalId: string): Project[] {
  return loadFromStorage().filter(p => (p.linkedGoalIds || []).includes(goalId))
}

export function recalcProgress(project: Project): number {
  const tasks = project.tasks || []
  if (tasks.length === 0) return project.progress
  return Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
}
