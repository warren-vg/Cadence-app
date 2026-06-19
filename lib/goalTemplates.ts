// lib/goalTemplates.ts — Rules-based task generation for goal activation

import { toDateStr } from '@/lib/planData'
import { findBestSlot, type DBTask, type WorkSchedule, type RecurrenceRule } from '@/lib/db'

// ─── V1: Original task generation (preserved) ────────────────────────────────
// Callers: plan/weekly, check-in/quarterly, onboarding/priorities

export const ENERGY_TO_CATEGORIES: Record<string, string[]> = {
  deep:     ['Career', 'Education', 'Finance', 'Business'],
  light:    ['Career', 'Finance', 'Education', 'Personal Growth', 'Relationships', 'Community'],
  creative: ['Creative', 'Personal Growth', 'Education'],
  social:   ['Health', 'Relationships', 'Community', 'Travel'],
  recovery: [],
}

interface TaskTemplate {
  text: string
  duration: number         // hours
  energyType: string
  recurrence: 'once' | 'weekly'
  dayPreference: number    // 0=Mon … 6=Sun, -1=any
}

const CATEGORY_TEMPLATES: Record<string, TaskTemplate[]> = {
  Career: [
    { text: 'Get started: {goal}',           duration: 1,    energyType: 'deep',    recurrence: 'once',   dayPreference: -1 },
    { text: 'Deep work session: {goal}',     duration: 2,    energyType: 'deep',    recurrence: 'weekly', dayPreference: 0 },
    { text: 'Review progress on {goal}',     duration: 0.5,  energyType: 'light',   recurrence: 'weekly', dayPreference: 4 },
    { text: 'Research and planning: {goal}', duration: 1,    energyType: 'deep',    recurrence: 'weekly', dayPreference: 1 },
  ],
  Finance: [
    { text: 'Get started: {goal}',           duration: 0.5,  energyType: 'deep',    recurrence: 'once',   dayPreference: -1 },
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
    { text: 'Get started: {goal}',           duration: 1,    energyType: 'deep',    recurrence: 'once',   dayPreference: -1 },
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

function getDefaultSlot(category: string, workSchedule: WorkSchedule, index: number): string {
  const [startH] = (workSchedule.workStartTime ?? '09:00').split(':').map(Number)
  const careerSlots = [startH, startH + 2, startH + 4, startH + 1]
    .map(h => `${String(Math.min(h, 17)).padStart(2, '0')}:00`)
  const offWorkSlots = ['18:00', '07:00', '19:00', '20:00']
  return (category === 'Career' ? careerSlots : offWorkSlots)[index % 4]
}

export function generateTasksForGoal(
  goal: { id: string; text: string; category: string; project_id?: string | null },
  energyBlocks: Record<string, string>,
  workSchedule: WorkSchedule,
  startDate: Date = new Date(),
  alreadyScheduled: { date: string; scheduled_time: string }[] = []
): Omit<DBTask, 'id' | 'user_id' | 'completed_at' | 'created_at'>[] {
  const templates = (CATEGORY_TEMPLATES[goal.category] || CATEGORY_TEMPLATES['Personal Growth']).slice(0, 4)
  const today    = new Date(startDate)
  const todayDay = today.getDay() // 0=Sun

  const results: Omit<DBTask, 'id' | 'user_id' | 'completed_at' | 'created_at'>[] = []

  for (let i = 0; i < templates.length; i++) {
    const template  = templates[i]
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

    const dateStr = toDateStr(targetDate)
    const occupiedOnDay = [
      ...alreadyScheduled.filter(t => t.date === dateStr),
      ...results.filter(t => t.date === dateStr),
    ]

    const slot = findBestSlot(
      { energyType: template.energyType, category: goal.category, duration: template.duration },
      targetDate,
      energyBlocks,
      occupiedOnDay,
      workSchedule
    )

    results.push({
      text,
      date:           dateStr,
      scheduled_time: slot || getDefaultSlot(goal.category, workSchedule, i),
      duration:       template.duration,
      category:       goal.category,
      priority:       i === 0 ? 'high'
                    : (i === templates.length - 1 && template.energyType === 'light') ? 'low'
                    : 'medium',
      completed:      false,
      goal_id:        goal.id,
      milestone_id:   null,
      project_id:     goal.project_id ?? null,
    })
  }

  return results
}

// ─── V2: Smart Enhanced Task Generation ──────────────────────────────────────
// Callers: dashboard/goals/[id], dashboard/goals

interface EnhancedTaskTemplate {
  text: string
  duration: number
  energyType: 'deep' | 'light' | 'creative' | 'social'
  complexity_tier: 'habit' | 'project' | 'venture'
  keywords: string[]
  is_recurring: boolean
  frequency?: 'daily' | 'weekly'
  days_of_week?: number[]   // JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  priority: 'high' | 'medium' | 'low'
  dayPreference: number     // -1=any, 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
}

export type OnetimeTaskPayload = Omit<DBTask, 'id' | 'user_id' | 'completed_at' | 'created_at'>

export type RecurringTaskPayload = {
  taskData: Omit<DBTask,
    'id' | 'user_id' | 'created_at' | 'completed_at' | 'date' | 'completed' |
    'is_recurrence_template' | 'recurrence_template_id' | 'recurrence_rule'>
  rule: RecurrenceRule
}

export type GeneratedTaskV2 =
  | { kind: 'onetime';   task: OnetimeTaskPayload }
  | { kind: 'recurring'; payload: RecurringTaskPayload }

// ─── Template builder helpers ─────────────────────────────────────────────────

function h(
  text: string,
  duration: number,
  energyType: EnhancedTaskTemplate['energyType'],
  keywords: string[],
  freq: 'daily' | 'weekly' = 'daily',
  days?: number[],
): EnhancedTaskTemplate {
  return {
    text, duration, energyType, complexity_tier: 'habit', keywords,
    is_recurring: true, frequency: freq,
    ...(days ? { days_of_week: days } : {}),
    priority: 'medium', dayPreference: -1,
  }
}

function p(
  text: string,
  duration: number,
  energyType: EnhancedTaskTemplate['energyType'],
  keywords: string[],
  priority: EnhancedTaskTemplate['priority'] = 'medium',
  dayPref = -1,
): EnhancedTaskTemplate {
  return {
    text, duration, energyType, complexity_tier: 'project', keywords,
    is_recurring: false, priority, dayPreference: dayPref,
  }
}

function v(
  text: string,
  duration: number,
  energyType: EnhancedTaskTemplate['energyType'],
  keywords: string[],
  priority: EnhancedTaskTemplate['priority'] = 'medium',
  dayPref = -1,
): EnhancedTaskTemplate {
  return {
    text, duration, energyType, complexity_tier: 'venture', keywords,
    is_recurring: false, priority, dayPreference: dayPref,
  }
}

// ─── Default time per energy type (for recurring task scheduling) ─────────────

const ENERGY_TIME_MAP: Record<string, string> = {
  deep:     '09:00',
  light:    '14:00',
  creative: '10:00',
  social:   '18:00',
}

// ─── Enhanced template pool: 50 per category (10 habit + 20 project + 20 venture) ───

const ENHANCED_TEMPLATES: Record<string, EnhancedTaskTemplate[]> = {

  // ── HEALTH ────────────────────────────────────────────────────────────────
  Health: [
    // Habits
    h('Morning workout session',                               1,    'social',   ['workout','exercise','gym','fitness','train','lift','strength']),
    h('Log today\'s food and nutrition',                       0.25, 'light',    ['nutrition','diet','eat','food','calories','macro','weight','lose']),
    h('Drink 8 glasses of water today',                        0.1,  'light',    ['water','hydrate','drink','hydration']),
    h('10-minute stretch or mobility work',                    0.17, 'light',    ['stretch','mobility','flexibility','yoga','posture']),
    h('Meditate or breathe for 10 minutes',                    0.17, 'light',    ['meditate','meditation','stress','calm','mindful','breathe']),
    h('Track sleep hours and quality',                         0.1,  'light',    ['sleep','rest','energy','fatigue','recovery']),
    h('Evening walk — 20 minutes',                             0.33, 'social',   ['walk','steps','cardio','active','move']),
    h('Weekly weigh-in and body metrics',                      0.25, 'light',    ['weight','body','fat','scale','track','lose'], 'weekly', [0]),
    h('Meal prep for the week',                                1.5,  'social',   ['meal','prep','cook','nutrition','diet','eat','food'], 'weekly', [0]),
    h('Healthy grocery run',                                   1,    'social',   ['grocery','food','shop','nutrition','healthy'], 'weekly', [6]),

    // Project
    p('Research your fitness baseline — take initial measurements', 0.5, 'light', ['fitness','baseline','measure','start','health'], 'high'),
    p('Set specific targets: weight, strength, or endurance',       0.5, 'deep',  ['target','goal','weight','strength','specific','improve'], 'high'),
    p('Book an appointment with a doctor or personal trainer',      0.25,'light', ['doctor','trainer','coach','appointment','consult'], 'high'),
    p('Create a workout schedule for the next 30 days',             1,   'deep',  ['workout','schedule','plan','gym','routine'], 'high'),
    p('Research a nutrition approach that fits your goal',          1,   'deep',  ['nutrition','diet','food','research','plan','eat'], 'medium'),
    p('Join a gym, class, or fitness community',                    0.5, 'social',['gym','class','join','community','fitness','group'], 'medium'),
    p('Stock the pantry with healthy staples',                      1,   'social',['pantry','food','grocery','healthy','stock','nutrition'], 'medium'),
    p('Set up a habit-tracking app or journal',                     0.5, 'light', ['track','app','journal','log','habit','monitor'], 'medium'),
    p('Run a baseline fitness test: mile, push-ups, or flexibility',1,   'social',['baseline','test','run','fitness','mile','strength'], 'medium'),
    p('Find 5 healthy recipes you\'ll actually enjoy',              1,   'creative',['recipe','cook','healthy','food','meal','eat'], 'low'),
    p('Identify your biggest nutrition pitfalls',                   0.5, 'deep',  ['nutrition','diet','pitfall','habit','sugar','snack'], 'medium'),
    p('Set up a sleep-optimization wind-down routine',              0.5, 'light', ['sleep','routine','rest','recovery','wind'], 'medium'),
    p('Complete a week-long food diary',                            0.25,'light', ['food','diary','track','nutrition','eat','log'], 'medium'),
    p('Find an accountability partner or fitness buddy',            0.25,'social',['accountability','partner','friend','gym','buddy'], 'low'),
    p('Research local fitness classes or sports groups',            0.5, 'light', ['class','local','group','fitness','yoga','crossfit'], 'low'),
    p('Develop a rest-day and recovery strategy',                   0.5, 'deep',  ['recovery','rest','sleep','overtraining'], 'low'),
    p('Review 4-week progress and adjust your plan',                1,   'deep',  ['review','progress','adjust','plan','week','results'], 'medium'),
    p('Document your starting point: photos and measurements',      0.25,'light', ['before','photo','measure','track','start','baseline'], 'high'),
    p('Schedule monthly health check-ins in your calendar',         0.25,'light', ['schedule','checkin','monthly','calendar'], 'low'),
    p('Identify the 3 habits with the biggest health impact',       0.5, 'deep',  ['habit','impact','identify','priority','health'], 'medium'),

    // Venture
    v('Hire a certified personal trainer or strength coach',        0.5, 'social',['trainer','coach','hire','certified','personal'], 'high'),
    v('Select and commit to a structured 90-day program',           1,   'deep',  ['program','90','structured','commit','training','75'], 'high'),
    v('Book a DEXA scan or InBody body composition analysis',        0.5, 'light', ['dexa','body','composition','scan','fat'], 'medium'),
    v('Sign up for a race, competition, or challenge event',         0.5, 'social',['race','competition','marathon','event','run','5k','10k','triathlon'], 'high'),
    v('Build or equip a home gym for consistent access',             2,   'deep',  ['home','gym','build','equip','equipment'], 'medium'),
    v('Consult a registered dietitian for a custom meal plan',       1,   'social',['dietitian','nutritionist','custom','meal','plan','consult'], 'high'),
    v('Commission a full blood panel and hormone-level workup',      0.5, 'light', ['blood','labs','hormone','panel','test','testosterone'], 'high'),
    v('Build a periodized 12-month training plan with phases',       2,   'deep',  ['periodized','annual','training','phases','plan'], 'medium'),
    v('Research evidence-based supplements relevant to your goal',   1,   'deep',  ['supplement','protein','creatine','evidence','research'], 'low'),
    v('Build a full recovery protocol: massage, sauna, sleep',       1,   'deep',  ['recovery','sauna','massage','protocol','sleep','optimize'], 'medium'),
    v('Train for and finish your first marathon or triathlon',        2,   'social',['marathon','triathlon','train','race','distance','run','first'], 'high'),
    v('Develop a macro-based nutrition plan with caloric targets',   1,   'deep',  ['macro','calorie','nutrition','plan','protein','carbs'], 'medium'),
    v('Set a 90-day body transformation timeline with milestones',   1,   'deep',  ['transformation','90','timeline','photos','milestone','body'], 'high'),
    v('Join a competitive team or coached group training program',   0.5, 'social',['competitive','team','coached','group','program','train'], 'medium'),
    v('Pilot a new training modality: powerlifting, BJJ, or rowing', 1,   'social',['powerlifting','bjj','rowing','swim','crossfit','try','new'], 'medium'),
    v('Document and share your transformation publicly',              0.5, 'creative',['document','share','transformation','blog','inspire'], 'low'),
    v('Build a sustainable performance-eating framework',            1,   'deep',  ['performance','eating','sustain','routine','food','energy'], 'medium'),
    v('Get a VO2 max test and calibrate your training zones',        0.5, 'social',['vo2','test','zones','cardio','aerobic','max'], 'medium'),
    v('Work with a sports physiotherapist to address imbalances',    1,   'social',['physio','imbalance','injury','pain','prevent','rehab'], 'high'),
    v('Build a year-round health and performance rhythm by season',  2,   'deep',  ['annual','year','season','rhythm','performance','long'], 'medium'),
  ],

  // ── CAREER ────────────────────────────────────────────────────────────────
  Career: [
    // Habits
    h('Review today\'s priorities and top 3 tasks',            0.25, 'light',  ['priorities','tasks','review','plan','morning']),
    h('30-minute professional reading or podcast',             0.5,  'light',  ['reading','learn','professional','podcast','book']),
    h('Log one win or key lesson from today',                  0.1,  'light',  ['win','lesson','reflect','log','growth']),
    h('2-hour deep focus block: {goal}',                       2,    'deep',   ['focus','deep','work','block','productivity']),
    h('Clear email inbox and capture action items',            0.5,  'light',  ['email','inbox','communication','action']),
    h('Weekly career reflection: what moved the needle?',      0.5,  'light',  ['reflection','career','weekly','review','progress'], 'weekly', [5]),
    h('Reach out to one contact in your network',              0.25, 'social', ['network','outreach','connection','contact'], 'weekly', [1]),
    h('Prepare for upcoming meetings and presentations',       0.5,  'deep',   ['meeting','presentation','prepare','agenda'], 'weekly', [1]),
    h('Review 90-day career goal progress',                    0.5,  'deep',   ['career','goal','90','progress','review'], 'weekly', [5]),
    h('30-minute skill-building practice: {goal}',             0.5,  'deep',   ['skill','practice','build','learn','improve'], 'weekly', [3]),

    // Project
    p('Define your 12-month career target in writing',                  0.5, 'deep',   ['12','month','career','target','goal','define'], 'high'),
    p('Audit current skills vs. target role requirements',              1,   'deep',   ['audit','skills','gap','role','requirements','career'], 'high'),
    p('Update your resume, LinkedIn, and portfolio',                    2,   'light',  ['resume','linkedin','portfolio','update','profile'], 'high'),
    p('Research 5 target companies or roles',                           1,   'deep',   ['research','company','role','target','jobs'], 'medium'),
    p('Request a performance review or structured feedback session',    0.5, 'social', ['performance','review','feedback','manager','1on1'], 'high'),
    p('Identify who can sponsor or advocate for you internally',        0.5, 'social', ['sponsor','advocate','champion','mentor','internal'], 'medium'),
    p('List 10 people to reach out to this quarter',                    0.5, 'light',  ['network','list','contacts','outreach','people'], 'medium'),
    p('Enroll in a course or certification relevant to {goal}',         0.5, 'deep',   ['course','certification','enroll','learn','skill'], 'high'),
    p('Shadow someone in your target role for a day',                   4,   'social', ['shadow','target','role','observe','learn'], 'medium'),
    p('Take on one stretch project outside your comfort zone',          2,   'deep',   ['stretch','project','challenge','growth','visibility'], 'medium'),
    p('Negotiate your compensation in your next conversation',          1,   'deep',   ['negotiate','salary','compensation','raise','offer'], 'high'),
    p('Build your personal board of advisors — 3 to 5 people',         1,   'social', ['advisors','board','mentor','network','personal'], 'medium'),
    p('Publish one article or post demonstrating your expertise',       2,   'creative',['publish','article','post','expertise','thought'], 'medium'),
    p('Attend an industry event or conference this quarter',            4,   'social', ['conference','event','industry','attend','network'], 'low'),
    p('Document your promotion criteria explicitly',                    0.5, 'deep',   ['promotion','criteria','ladder','level','criteria'], 'high'),
    p('Compile your accomplishments for the past 6 months',             1,   'light',  ['accomplishments','impact','wins','document','brag'], 'medium'),
    p('Practice the top 10 interview questions for your target role',   1,   'deep',   ['interview','practice','questions','prepare'], 'medium'),
    p('Identify your single biggest career bottleneck right now',       0.5, 'deep',   ['bottleneck','blocker','identify','career','stuck'], 'high'),
    p('Build a 90-day career action plan',                              1,   'deep',   ['90','day','plan','action','career','roadmap'], 'high'),
    p('Schedule monthly career development reviews',                    0.25,'light',  ['schedule','monthly','review','career','development'], 'low'),

    // Venture
    v('Map out a role transition that increases comp by 30%+',          2,   'deep',   ['role','transition','salary','comp','30','increase','move'], 'high'),
    v('Build a personal brand and content presence in your niche',      2,   'creative',['personal','brand','content','niche','presence','online'], 'medium'),
    v('Develop a signature framework or methodology in your field',     3,   'deep',   ['framework','methodology','signature','develop','publish'], 'medium'),
    v('Launch a consulting practice or advisory offering',              2,   'deep',   ['consulting','advisory','launch','practice','clients'], 'high'),
    v('Secure a senior sponsor or executive champion at your company',  1,   'social', ['sponsor','executive','champion','senior','internal'], 'high'),
    v('Submit a proposal to speak at a major industry conference',      1,   'creative',['speak','conference','keynote','proposal','stage'], 'medium'),
    v('Write and publish a guide or online course in your field',       4,   'creative',['write','publish','guide','course','teach','expertise'], 'medium'),
    v('Build and develop your first direct report or small team',       2,   'social', ['team','hire','manage','develop','report','lead'], 'high'),
    v('Become the go-to person for {goal} in your organization',       3,   'deep',   ['expert','goto','recognized','organization','known'], 'medium'),
    v('Develop a mentoring relationship with a senior leader',          1,   'social', ['mentor','senior','leader','relationship','guidance'], 'medium'),
    v('Land a board seat, advisory role, or industry committee seat',   1,   'social', ['board','advisory','committee','seat','governance'], 'high'),
    v('Develop and launch a digital product from your expertise',       4,   'creative',['digital','product','launch','course','template','expertise'], 'high'),
    v('Build a thought-leadership platform: newsletter or podcast',     2,   'creative',['newsletter','podcast','platform','audience','content'], 'medium'),
    v('Secure a keynote or major paid speaking contract',               1,   'social', ['keynote','speaking','paid','contract','stage'], 'medium'),
    v('Execute a major cross-functional project for visibility',        4,   'deep',   ['cross','functional','project','visibility','impact'], 'high'),
    v('Build a portfolio of 3 major wins documented this year',        1,   'deep',   ['portfolio','wins','impact','document','showcase'], 'medium'),
    v('Design a 3-year leadership development roadmap',                 2,   'deep',   ['leadership','3 year','roadmap','development','plan'], 'medium'),
    v('Transition to a new industry or function at senior level',       3,   'deep',   ['transition','industry','function','senior','pivot'], 'high'),
    v('Create an industry-relevant certification or training program',  4,   'creative',['certification','program','training','industry','create'], 'medium'),
    v('Build a strategic partnership with a peer or organization',      2,   'social', ['partnership','strategic','peer','organization','build'], 'high'),
  ],

  // ── FINANCE ───────────────────────────────────────────────────────────────
  Finance: [
    // Habits
    h('Review transactions and categorize spending',           0.25, 'deep',   ['spending','transactions','categorize','track','budget']),
    h('Check savings and investment balances',                 0.1,  'light',  ['savings','investments','balances','check','portfolio']),
    h('Log every expense in your tracking tool',               0.1,  'light',  ['expense','log','track','money','spend']),
    h('Read one finance article or book chapter',              0.5,  'light',  ['finance','read','learn','investing','money','book']),
    h('Weekly budget review: actual vs. planned',              0.5,  'deep',   ['budget','review','actual','planned','weekly'], 'weekly', [0]),
    h('Update your net-worth tracker',                         0.25, 'deep',   ['net worth','tracker','update','assets','liabilities'], 'weekly', [0]),
    h('Review investment portfolio performance',               0.25, 'deep',   ['investment','portfolio','performance','returns','stocks'], 'weekly', [5]),
    h('Confirm automated savings transfer processed',          0.1,  'light',  ['savings','automated','transfer','auto'], 'weekly', [1]),
    h('Review credit card and bank statements',                0.5,  'light',  ['credit card','bank','statement','charges','review'], 'weekly', [6]),
    h('Audit recurring charges and subscriptions',             0.5,  'light',  ['subscriptions','recurring','charges','audit','cancel'], 'weekly', [6]),

    // Project
    p('Build a complete monthly budget with every category',          1,   'deep',  ['budget','monthly','categories','build','plan'], 'high'),
    p('Calculate your current net worth: assets minus liabilities',   1,   'deep',  ['net worth','assets','liabilities','calculate','wealth'], 'high'),
    p('Open a high-yield savings or investment account',              0.5, 'light', ['savings','account','open','high yield','invest'], 'high'),
    p('List all debts: balances, interest rates, minimum payments',   0.5, 'deep',  ['debt','balances','interest','minimum','list','owe'], 'high'),
    p('Set up automatic savings contributions each payday',           0.5, 'deep',  ['automatic','savings','automate','payday','contribute'], 'high'),
    p('Choose a debt payoff strategy — avalanche or snowball',        0.5, 'deep',  ['debt','payoff','avalanche','snowball','strategy'], 'medium'),
    p('Build a 6-month emergency fund savings plan',                  1,   'deep',  ['emergency','fund','6 month','savings','plan'], 'high'),
    p('Audit and cancel unnecessary subscriptions',                   0.5, 'light', ['subscriptions','cancel','audit','streaming','unnecessary'], 'medium'),
    p('Meet with an accountant or fee-only financial advisor',        1,   'social',['accountant','advisor','financial','meet','consult'], 'high'),
    p('Understand your 401(k) match and maximize contributions',      0.5, 'deep',  ['401k','match','retirement','contribute','employer'], 'high'),
    p('Pull a free credit report and dispute any errors',             0.5, 'light', ['credit','report','dispute','errors','score'], 'medium'),
    p('Research 3 investment vehicles for your timeline',             1,   'deep',  ['investment','vehicles','research','etf','index','bond'], 'medium'),
    p('Launch one side income experiment this month',                 2,   'creative',['side','income','experiment','hustle','freelance','extra'], 'high'),
    p('Identify your top 3 spending leaks and close them',            0.5, 'deep',  ['spending','leaks','identify','cut','reduce'], 'high'),
    p('Build a simple 5-year financial projection',                   1,   'deep',  ['5 year','projection','forecast','financial','plan'], 'medium'),
    p('Automate all bill payments to avoid late fees',                0.5, 'light', ['automate','bills','payments','auto pay','late'], 'medium'),
    p('Research refinancing options to lower debt interest rates',    1,   'deep',  ['refinance','rates','lower','interest','mortgage','loan'], 'medium'),
    p('Set a monthly savings rate target and automate it',            0.5, 'deep',  ['savings rate','monthly','target','automate','percent'], 'high'),
    p('Pre-fund and plan for a known upcoming major expense',         0.5, 'light', ['upcoming','expense','plan','fund','major','prepare'], 'medium'),
    p('Define your financial independence or retirement number',      1,   'deep',  ['financial independence','retirement','number','fire','target'], 'high'),

    // Venture
    v('Build a $X investment portfolio with a defined allocation',    2,   'deep',   ['investment','portfolio','allocation','build','stocks','wealth'], 'high'),
    v('Acquire a cash-flowing rental property',                       3,   'deep',   ['rental','property','real estate','cash flow','acquire'], 'high'),
    v('Build 6+ months of living expenses in passive income',         2,   'deep',   ['passive','income','6 months','living','expenses','build'], 'high'),
    v('Map a path to financial independence by your target date',     2,   'deep',   ['financial independence','path','target date','fire','plan'], 'high'),
    v('Scale a side business to $X/month in profit',                  3,   'deep',   ['side business','scale','profit','monthly','revenue','income'], 'high'),
    v('Build 3+ income streams across different asset classes',       2,   'deep',   ['income streams','diversify','assets','multiple','build'], 'high'),
    v('Research and execute an angel or startup investment',          2,   'deep',   ['angel','startup','invest','equity','venture','stake'], 'high'),
    v('Create a digital product generating passive income',           3,   'creative',['digital','product','passive','income','create','sell'], 'high'),
    v('Max out all tax-advantaged accounts this year',                1,   'deep',   ['401k','ira','hsa','max out','tax','advantaged'], 'high'),
    v('Hire a fee-only fiduciary financial planner',                  1,   'social', ['fee only','fiduciary','planner','advisor','hire','financial'], 'high'),
    v('Build a real estate portfolio with multiple cash-flowing units',3,  'deep',   ['real estate','portfolio','units','cash flow','doors'], 'high'),
    v('Develop a dividend income strategy for early retirement',      2,   'deep',   ['dividend','income','retirement','early','strategy'], 'medium'),
    v('Create a donor-advised fund or charitable giving strategy',    1,   'deep',   ['donate','charitable','giving','fund','daf','philanthropy'], 'medium'),
    v('Research private equity, syndications, or alternative assets', 2,   'deep',   ['private equity','syndication','alternative','assets','invest'], 'medium'),
    v('Build a generational wealth plan with an estate attorney',     2,   'deep',   ['generational','wealth','estate','plan','trust','legacy'], 'high'),
    v('Systematize a business so it generates income without you',    3,   'deep',   ['systematize','business','passive','income','delegate'], 'high'),
    v('Research and acquire a small business or franchise',           3,   'deep',   ['acquire','business','franchise','purchase','buy'], 'high'),
    v('Develop deep expertise in one investment niche',               2,   'deep',   ['niche','expertise','investment','specialize','deep'], 'medium'),
    v('Document and teach your financial framework to others',        2,   'creative',['teach','document','framework','financial','others','share'], 'medium'),
    v('Build a tax optimization strategy with your CPA',              1,   'deep',   ['tax','optimization','cpa','strategy','reduce','planning'], 'high'),
  ],

  // ── EDUCATION ─────────────────────────────────────────────────────────────
  Education: [
    // Habits
    h('Study for 45 minutes: {goal}',                          0.75, 'deep',    ['study','learn','course','subject','class','material']),
    h('Review flashcards or practice problems',                0.5,  'deep',    ['flashcards','practice','review','problems','quiz']),
    h('Read 20 pages of subject material',                     0.5,  'light',   ['read','pages','book','material','chapter']),
    h('Write one insight or key takeaway from today',          0.25, 'light',   ['insight','takeaway','write','journal','learn','capture']),
    h('Watch one lecture or educational video',                0.5,  'deep',    ['lecture','video','watch','course','online']),
    h('Weekly review: what did I master this week?',           0.5,  'deep',    ['weekly','review','master','learn','progress'], 'weekly', [5]),
    h('Practice one skill for 30 minutes',                     0.5,  'deep',    ['practice','skill','30 min','deliberate'], 'weekly', [3]),
    h('Quiz yourself on recent material',                      0.5,  'deep',    ['quiz','test','self','recent','review'], 'weekly', [0]),
    h('Discuss your learning with a peer or study group',      0.5,  'social',  ['discuss','peer','study group','explain','share'], 'weekly', [4]),
    h('Apply one concept in a real-world context',             0.5,  'creative',['apply','real','context','concept','practice'], 'weekly', [6]),

    // Project
    p('Define your learning goal with a specific deadline',              0.5, 'deep',    ['learning','goal','deadline','define','specific'], 'high'),
    p('Research the best courses, books, and resources for {goal}',     1,   'deep',    ['research','courses','books','resources','best'], 'high'),
    p('Build a 30-day structured study plan',                           1,   'deep',    ['30 day','study','plan','structured','schedule'], 'high'),
    p('Identify a mentor or expert in {goal} to learn from',            0.5, 'social',  ['mentor','expert','identify','learn','guidance'], 'high'),
    p('Enroll in a course, bootcamp, or certification program',         0.5, 'light',   ['enroll','course','bootcamp','certification','program'], 'high'),
    p('Form or join a study group for accountability',                  0.5, 'social',  ['study group','join','form','accountability','peers'], 'medium'),
    p('Complete the first module or chapter of your course',            1,   'deep',    ['first','module','chapter','complete','start'], 'high'),
    p('Take a practice test and identify knowledge gaps',               1,   'deep',    ['practice','test','gaps','identify','assess'], 'medium'),
    p('Build a hands-on project to apply your learning',               2,   'creative', ['hands on','project','apply','build','portfolio'], 'medium'),
    p('Get feedback on your work from an expert or peer',               0.5, 'social',  ['feedback','expert','peer','review','improve'], 'medium'),
    p('Set up a personal knowledge base or note-taking system',         0.5, 'light',   ['knowledge base','notes','system','organize','notion'], 'medium'),
    p('Teach a concept you learned to someone else',                    0.5, 'social',  ['teach','explain','concept','others','feynman'], 'medium'),
    p('Write a summary or reference guide from your notes',             1,   'creative', ['summary','guide','reference','write','notes'], 'medium'),
    p('Track your study hours and maintain a learning log',             0.1, 'light',   ['track','hours','log','study','record'], 'low'),
    p('Set up spaced-repetition review in Anki or equivalent',          0.5, 'deep',    ['spaced repetition','anki','review','flashcards','memory'], 'medium'),
    p('Attend a workshop, webinar, or live training event',             2,   'social',  ['workshop','webinar','event','attend','live'], 'medium'),
    p('Identify the 20% of concepts that give 80% of results',          0.5, 'deep',    ['pareto','20 percent','80','core','essential'], 'high'),
    p('Complete the course and earn the certificate',                   1,   'deep',    ['complete','certificate','finish','earn','credential'], 'high'),
    p('Build a post-learning plan: retention and application',          0.5, 'deep',    ['retention','apply','after','plan','reinforce'], 'medium'),
    p('Create a portfolio piece proving your competence in {goal}',     3,   'creative', ['portfolio','piece','prove','competence','showcase'], 'high'),

    // Venture
    v('Earn a graduate degree in {goal}: Master\'s, MBA, or PhD',       4,   'deep',    ['graduate','degree','masters','mba','phd','earn'], 'high'),
    v('Complete a prestigious certification: CPA, CFA, PMP, or PE',     3,   'deep',    ['cpa','cfa','pmp','pe','certification','prestigious','bar'], 'high'),
    v('Publish original research or writing in a peer-reviewed venue',  3,   'deep',    ['publish','research','peer reviewed','journal','writing'], 'high'),
    v('Build and launch a course or curriculum from your expertise',    4,   'creative', ['course','curriculum','launch','build','teach','online'], 'high'),
    v('Become a recognized expert or consultant in {goal}',             2,   'deep',    ['expert','recognized','consultant','authority','known'], 'high'),
    v('Complete an intensive bootcamp and transition into a new career', 3,  'deep',    ['bootcamp','intensive','transition','career','new','change'], 'high'),
    v('Learn a language to B2 professional fluency',                    2,   'creative', ['language','fluency','b2','professional','speak','foreign'], 'high'),
    v('Complete a multi-year learning curriculum with progressive depth',2,  'deep',    ['multi year','curriculum','progressive','depth','systematic'], 'high'),
    v('Master a technical skill and build a public portfolio',          3,   'deep',    ['technical','skill','master','portfolio','public','build'], 'medium'),
    v('Go from beginner to expert in {goal} in 12 months',             2,   'deep',    ['beginner','expert','12 months','mastery','zero'], 'high'),
    v('Develop original research or a thesis in your domain',           4,   'deep',    ['research','thesis','original','develop','domain'], 'high'),
    v('Read and synthesize 50+ books on your core topic',               1,   'light',   ['50 books','read','synthesize','core','topic','library'], 'medium'),
    v('Complete a structured fellowship, residency, or apprenticeship', 4,   'social',  ['fellowship','residency','apprenticeship','structured','program'], 'high'),
    v('Learn a craft or trade to journeyman or master level',           2,   'creative', ['craft','trade','journeyman','master','artisan'], 'medium'),
    v('Study 10 top thinkers in {goal} and synthesize their frameworks',2,  'deep',    ['thinkers','synthesize','frameworks','top','study'], 'medium'),
    v('Earn a degree while working full-time',                          2,   'deep',    ['degree','full time','working','earn','part time'], 'high'),
    v('Build T-shaped expertise: depth in {goal} plus breadth',        2,   'deep',    ['t shaped','depth','breadth','expertise','specialist'], 'medium'),
    v('Develop a personal learning operating system',                   1,   'deep',    ['learning system','operating','personal','develop','meta'], 'medium'),
    v('Complete a capstone project proving mastery of {goal}',         3,   'creative', ['capstone','project','mastery','prove','complete'], 'high'),
    v('Build expertise in two complementary fields simultaneously',    2,   'deep',    ['two fields','complementary','expertise','interdisciplinary'], 'medium'),
  ],

  // ── PERSONAL GROWTH ───────────────────────────────────────────────────────
  'Personal Growth': [
    // Habits
    h('Morning journaling: gratitude, intention, reflection',  0.25, 'light',   ['journal','gratitude','morning','intention','reflect','write']),
    h('Evening review: what went well, what to improve',       0.25, 'light',   ['evening','review','reflect','journal','improve','day']),
    h('Read 20 pages of a personal development book',          0.5,  'light',   ['read','pages','book','development','learn','personal']),
    h('15-minute meditation or mindfulness session',           0.25, 'light',   ['meditate','mindfulness','meditation','calm','present','breathe']),
    h('One deliberate act outside your comfort zone',          0.5,  'creative',['comfort zone','courage','discomfort','growth','fear','bold']),
    h('Weekly values alignment check',                        0.5,  'light',   ['values','alignment','check','weekly','integrity'], 'weekly', [0]),
    h('Set your top 3 weekly intentions',                     0.25, 'light',   ['intentions','weekly','set','plan','focus'], 'weekly', [1]),
    h('30-minute deep self-reflection session',               0.5,  'light',   ['reflection','deep','session','self','explore'], 'weekly', [0]),
    h('Identify and reframe one limiting belief',              0.5,  'creative',['limiting belief','reframe','identify','mindset','shift'], 'weekly', [3]),
    h('Review your personal development plan progress',        0.5,  'deep',   ['review','plan','progress','development','goals'], 'weekly', [5]),

    // Project
    p('Define your top 5 core values in writing',                        0.5, 'light',   ['values','core','define','write','5','identity'], 'high'),
    p('Write a personal mission statement',                              1,   'creative', ['mission','statement','purpose','write','personal'], 'high'),
    p('Complete a strengths assessment (StrengthsFinder or VIA)',         0.5, 'light',   ['strengths','assessment','finder','via','clifton'], 'medium'),
    p('Identify your top limiting belief and craft a reframe',           0.5, 'deep',    ['limiting','belief','reframe','identify','mindset'], 'high'),
    p('Break one unhealthy habit over the next 30 days',                 1,   'deep',    ['break','habit','unhealthy','30 days','quit','stop'], 'high'),
    p('Build one new keystone habit over 30 days',                       1,   'deep',    ['keystone','habit','30 days','build','routine','new'], 'high'),
    p('Read one transformative personal development book',               2,   'light',   ['book','read','transformative','development','personal'], 'medium'),
    p('Start sessions with a therapist, coach, or mentor',               0.5, 'social',  ['therapist','coach','mentor','sessions','start','support'], 'high'),
    p('Complete a 21-day gratitude journal',                             0.1, 'light',   ['gratitude','journal','21 days','practice','appreciate'], 'medium'),
    p('Take a personality or archetype assessment',                      0.5, 'light',   ['personality','mbti','enneagram','assessment','type'], 'medium'),
    p('Build a 90-day personal development plan',                        1,   'deep',    ['90 day','plan','development','personal','roadmap'], 'high'),
    p('Practice a new emotional regulation or coping skill',             0.5, 'light',   ['emotional','regulation','coping','skill','practice'], 'medium'),
    p('Do a 7-day digital detox and document what shifts',               1,   'light',   ['digital','detox','7 days','phone','social media','off'], 'medium'),
    p('Leverage your top strengths in a new context this month',         1,   'creative', ['strengths','leverage','new','context','apply','use'], 'medium'),
    p('Plan and take a personal retreat or reflection day',              4,   'light',   ['retreat','reflection','day','personal','rest','clarity'], 'medium'),
    p('Write a letter to your future 1-year and 5-year self',            0.5, 'creative', ['future','letter','self','1 year','5 year','vision'], 'low'),
    p('Complete a life-wheel assessment across all 8 areas',             0.5, 'light',   ['life wheel','assessment','8 areas','balance','score'], 'high'),
    p('Do one thing each week that expands your comfort zone',           0.5, 'creative', ['comfort zone','expand','weekly','courage','new'], 'medium'),
    p('Reflect on and capture 10 lessons from the last 12 months',      1,   'light',   ['lessons','reflect','12 months','capture','review','year'], 'medium'),
    p('Build a morning routine that sets the tone for your day',         1,   'deep',    ['morning','routine','build','tone','ritual','habit'], 'high'),

    // Venture
    v('Commit to 12+ months of therapy or transformative coaching',     1,   'social',  ['therapy','coaching','12 months','commit','transform'], 'high'),
    v('Complete a multi-year meditation or contemplative practice',     0.5, 'light',   ['meditation','multi year','practice','contemplative','long'], 'high'),
    v('Develop a personal philosophy and live it with consistency',     2,   'deep',    ['philosophy','personal','develop','live','consistently'], 'high'),
    v('Publish a memoir or personal growth story',                      3,   'creative', ['memoir','publish','story','write','personal','journey'], 'medium'),
    v('Design a values-aligned lifestyle from the ground up',           2,   'deep',    ['lifestyle','design','values','aligned','intentional'], 'high'),
    v('Complete a major transformative experience: retreat or program',  4,   'social',  ['retreat','transformative','program','immersive','experience'], 'high'),
    v('Develop emotional intelligence to an expert level',              2,   'deep',    ['emotional intelligence','eq','expert','develop','empathy'], 'high'),
    v('Build a legacy project that reflects your deepest values',       3,   'creative', ['legacy','project','values','deepest','build','lasting'], 'high'),
    v('Master your inner world and become a resource for others',       2,   'deep',    ['inner','master','resource','others','guide','wisdom'], 'medium'),
    v('Build a sustainable self-development operating system',          2,   'deep',    ['system','self development','sustainable','operating','build'], 'high'),
    v('Develop deep expertise in psychological resilience',             2,   'deep',    ['resilience','psychological','expertise','develop','inner'], 'medium'),
    v('Practice radical authenticity for 12 months',                   1,   'social',  ['authenticity','radical','12 months','practice','honest'], 'medium'),
    v('Design and execute a year of 12 deliberate experiments',        1,   'creative', ['experiments','12','year','deliberate','design','try'], 'medium'),
    v('Build a daily practice that compounds over 5+ years',            0.5, 'light',   ['daily','practice','compound','5 years','long term'], 'high'),
    v('Face your biggest fear and integrate the experience',            2,   'social',  ['fear','face','biggest','integrate','courage','overcome'], 'high'),
    v('Develop a coaching or teaching practice for others',             2,   'social',  ['coach','teach','practice','others','develop','guide'], 'medium'),
    v('Read 50+ transformative books and synthesize the insights',     1,   'light',   ['50 books','transformative','read','synthesize','insights'], 'medium'),
    v('Train in a healing or wisdom modality',                          2,   'social',  ['healing','wisdom','train','modality','therapy','somatic'], 'medium'),
    v('Document and share your personal growth story',                  1,   'creative', ['document','share','story','growth','personal','inspire'], 'medium'),
    v('Become the most developed version of yourself by design',       2,   'deep',    ['best version','develop','design','intentional','become'], 'high'),
  ],

  // ── RELATIONSHIPS ─────────────────────────────────────────────────────────
  Relationships: [
    // Habits
    h('Send one thoughtful message to someone who matters',    0.1,  'social',  ['message','reach out','connect','text','thoughtful']),
    h('Express genuine gratitude to someone close to you',     0.1,  'social',  ['gratitude','appreciate','express','close','love']),
    h('Practice active listening in a key conversation today', 0.25, 'social',  ['listen','active','conversation','present','focus']),
    h('Check in on a family member or close friend',           0.1,  'social',  ['checkin','family','friend','care','support']),
    h('Weekly quality time with your partner or family',       2,    'social',  ['partner','family','quality time','date','together'], 'weekly', [5]),
    h('Capture one relationship insight this week',            0.25, 'light',   ['insight','relationship','journal','capture','reflection'], 'weekly', [0]),
    h('Make one meaningful introduction or connection',        0.25, 'social',  ['introduce','connect','introduce','network','meaningful'], 'weekly', [3]),
    h('Attend or organize a regular social gathering',         2,    'social',  ['gather','social','event','friends','attend'], 'weekly', [6]),
    h('Review which key relationships need more attention',    0.25, 'light',   ['review','attention','key','relationship','who'], 'weekly', [0]),
    h('Reach out to a distant friend or family member',        0.25, 'social',  ['distant','friend','family','reach out','reconnect'], 'weekly', [4]),

    // Project
    p('Identify the 5 most important relationships in your life',       0.5, 'light',  ['5','important','relationships','identify','key'], 'high'),
    p('Write what you value most in each key relationship',             0.5, 'light',  ['values','write','key','relationship','meaning'], 'high'),
    p('Have one honest and vulnerable conversation this month',         1,   'social', ['honest','vulnerable','conversation','deep','open'], 'high'),
    p('Plan a meaningful shared experience with your partner or family',1,   'social', ['plan','experience','partner','family','shared'], 'high'),
    p('Schedule regular 1:1 time with each person you care about',     0.5, 'light',  ['schedule','1on1','regular','person','care'], 'medium'),
    p('Reach out to repair or reconnect with an estranged relationship',0.5, 'social', ['repair','reconnect','estranged','apologize','mend'], 'high'),
    p('Take a relationship assessment or quiz with your partner',       1,   'social', ['assessment','quiz','partner','couple','relationship'], 'medium'),
    p('Start one new shared ritual or tradition',                       0.5, 'creative',['ritual','tradition','new','shared','start','couple'], 'medium'),
    p('Identify one communication pattern to improve',                  0.5, 'deep',   ['communication','pattern','improve','identify','habit'], 'high'),
    p('Read one book on relationships, communication, or love',        2,   'light',  ['book','relationships','communication','love','read'], 'medium'),
    p('Plan a special experience for someone you love',                 1,   'creative',['special','experience','plan','love','surprise'], 'medium'),
    p('Create a list of 10 people to grow closer to this year',        0.5, 'light',  ['list','10','people','closer','grow','year'], 'medium'),
    p('Identify and address one recurring conflict pattern',            0.5, 'deep',   ['conflict','pattern','recurring','address','resolve'], 'high'),
    p('Attend a couples workshop or communication course',              4,   'social', ['couples','workshop','communication','course','attend'], 'medium'),
    p('Write appreciation letters to your 3 closest people',           0.5, 'creative',['appreciation','letters','write','close','gratitude'], 'medium'),
    p('Build a shared vision or goals with your partner',              1,   'deep',   ['shared','vision','goals','partner','together','build'], 'high'),
    p('Host a dinner, gathering, or meaningful event this month',      3,   'social', ['host','dinner','gathering','event','people','invite'], 'low'),
    p('Reconnect with 3 people you\'ve lost touch with',               0.5, 'social', ['reconnect','lost touch','3','people','reach','catch up'], 'medium'),
    p('Create a monthly relationship investment ritual',                0.5, 'light',  ['monthly','ritual','relationship','invest','regular'], 'medium'),
    p('Apologize or make amends for something long unresolved',        0.5, 'social', ['apologize','amends','unresolved','make right','repair'], 'high'),

    // Venture
    v('Build an extraordinary long-term partnership or marriage',       2,   'social',  ['partnership','marriage','extraordinary','long term','build'], 'high'),
    v('Cultivate a community of 50+ meaningful relationships',          2,   'social',  ['community','50','meaningful','cultivate','relationships'], 'medium'),
    v('Raise children with intentionality, presence, and values',       2,   'social',  ['children','raise','intentional','presence','values','parenting'], 'high'),
    v('Create a family legacy project: memoir, archive, or estate plan',2,  'creative', ['family','legacy','memoir','archive','estate','plan'], 'medium'),
    v('Become known as a trusted connector in your field or community', 1,   'social',  ['connector','trusted','field','community','known','network'], 'medium'),
    v('Build a lasting friendship group that grows across decades',     1,   'social',  ['friendship','lasting','group','decades','build','deep'], 'medium'),
    v('Create a meaningful community or support network from scratch',  2,   'social',  ['community','support','network','create','scratch','build'], 'high'),
    v('Develop deep expertise in communication and human connection',   2,   'deep',    ['communication','expertise','human','connection','develop'], 'medium'),
    v('Build a multi-generational family vision and plan',              2,   'deep',    ['generational','family','vision','plan','multi','legacy'], 'medium'),
    v('Heal a significant fractured relationship',                      2,   'social',  ['heal','fractured','significant','repair','restore','relationship'], 'high'),
    v('Build a mentoring relationship that transforms someone\'s life', 1,   'social',  ['mentor','transforming','life','relationship','develop'], 'high'),
    v('Build a close-knit community around shared values',              2,   'social',  ['close knit','community','values','shared','build','tribe'], 'medium'),
    v('Practice radical generosity in your key relationships',          1,   'social',  ['generosity','radical','relationships','give','practice'], 'medium'),
    v('Create a family foundation or charitable giving initiative',     2,   'deep',    ['foundation','family','charitable','giving','create','philanthropy'], 'medium'),
    v('Build a network that opens access to any opportunity',           2,   'social',  ['network','access','opportunity','build','doors','connections'], 'medium'),
    v('Travel with your closest people to build shared memories',       3,   'social',  ['travel','memories','closest','shared','experience','adventure'], 'medium'),
    v('Document and share your relationship philosophy',                1,   'creative', ['document','philosophy','share','relationship','write'], 'low'),
    v('Develop conflict resolution skills to an expert level',          2,   'deep',    ['conflict','resolution','expert','develop','mediate','skills'], 'medium'),
    v('Build a support system that sustains you through any challenge', 2,   'social',  ['support','system','sustain','challenge','build','resilient'], 'high'),
    v('Lead or facilitate a relationship or communication workshop',    2,   'social',  ['lead','facilitate','workshop','communication','relationship'], 'medium'),
  ],

  // ── TRAVEL ────────────────────────────────────────────────────────────────
  Travel: [
    // Habits
    h('Set aside a fixed amount for the travel fund today',    0.1,  'light',   ['save','fund','travel','money','budget','set aside']),
    h('Spend 15 minutes exploring destination inspiration',    0.25, 'light',   ['explore','inspiration','destination','browse','discover']),
    h('Learn 5 new phrases in the destination language',       0.25, 'creative',['language','phrases','learn','destination','speak','words']),
    h('Review and refine the trip itinerary',                  0.25, 'light',   ['itinerary','refine','review','trip','plan'], 'weekly', [1]),
    h('Research one attraction or neighborhood in depth',      0.5,  'light',   ['research','attraction','neighborhood','destination','explore'], 'weekly', [2]),
    h('Book one activity, restaurant, or experience in advance',0.25,'light',   ['book','activity','restaurant','reserve','advance'], 'weekly', [3]),
    h('Connect with a local or traveler from the destination', 0.25, 'social',  ['connect','local','traveler','destination','community'], 'weekly', [4]),
    h('Track travel savings vs. budget target',                0.25, 'light',   ['track','savings','budget','target','progress'], 'weekly', [6]),
    h('Practice destination language on a learning app',       0.25, 'creative',['duolingo','language','app','practice','speak'], 'weekly', [3]),
    h('Read about history or culture of the destination',      0.5,  'light',   ['history','culture','read','destination','background'], 'weekly', [0]),

    // Project
    p('Choose your destination and lock in a travel date',             0.5, 'light',   ['destination','choose','date','lock in','travel'], 'high'),
    p('Set your trip budget and open a dedicated travel savings fund', 0.5, 'deep',    ['budget','savings','fund','travel','dedicated'], 'high'),
    p('Research visa and entry requirements and apply if needed',      1,   'deep',    ['visa','entry','requirements','apply','passport'], 'high'),
    p('Book flights after comparing options and prices',               1,   'light',   ['flights','book','compare','prices','tickets'], 'high'),
    p('Research and book accommodation in the right area',             1,   'light',   ['accommodation','book','hotel','airbnb','area'], 'high'),
    p('Draft a day-by-day itinerary for your trip',                    1,   'creative', ['itinerary','day by day','draft','plan','schedule'], 'medium'),
    p('Identify and list must-see attractions and experiences',        0.5, 'light',   ['attractions','must see','list','experiences','best'], 'medium'),
    p('Purchase travel insurance before your departure date',          0.5, 'light',   ['insurance','travel','purchase','protect','cover'], 'high'),
    p('Book high-demand experiences and restaurants in advance',       1,   'light',   ['book','advance','restaurant','experience','reserve'], 'medium'),
    p('Create a packing list and gather any needed gear',              0.5, 'light',   ['packing','list','gear','kit','prepare'], 'low'),
    p('Set up travel-friendly banking and notify your card provider',  0.5, 'light',   ['banking','card','notify','travel','forex'], 'high'),
    p('Learn destination language basics via Duolingo or phrasebook',  1,   'creative', ['language','basics','duolingo','phrasebook','learn'], 'medium'),
    p('Research local customs, etiquette, and cultural norms',         0.5, 'light',   ['customs','etiquette','culture','norms','local'], 'medium'),
    p('Arrange international phone service or local SIM card',         0.5, 'light',   ['phone','sim','international','service','data'], 'medium'),
    p('Plan ground transportation within the destination',             0.5, 'light',   ['transport','ground','local','metro','rental'], 'medium'),
    p('Review health and vaccination requirements',                    0.5, 'deep',    ['health','vaccination','requirements','shots','medical'], 'high'),
    p('Share your itinerary with a trusted contact back home',         0.25,'light',   ['share','itinerary','safety','contact','emergency'], 'medium'),
    p('Complete a 48-hour pre-departure checklist',                    1,   'light',   ['checklist','48 hours','pre departure','final','pack'], 'medium'),
    p('Capture and document your trip (journal, photos, videos)',      0.5, 'creative', ['document','journal','photos','capture','memory'], 'low'),
    p('Write a trip debrief: lessons and what you\'d do differently',  0.5, 'creative', ['debrief','lessons','differently','review','trip'], 'low'),

    // Venture
    v('Plan and execute a 3-month sabbatical or slow travel trip',     3,   'deep',    ['sabbatical','3 month','slow travel','extended','long'], 'high'),
    v('Build a lifestyle that lets you work and travel simultaneously', 3,   'deep',    ['work and travel','lifestyle','remote','nomad','build'], 'high'),
    v('Visit all 7 continents in your lifetime',                       2,   'social',  ['7 continents','visit','lifetime','all','world'], 'high'),
    v('Create and run a group travel experience or retreat',           3,   'social',  ['group travel','experience','retreat','run','create'], 'high'),
    v('Become a full-time digital nomad for a minimum of one year',   2,   'deep',    ['digital nomad','full time','year','remote','nomad'], 'high'),
    v('Live abroad for 6+ months in a new country',                   2,   'social',  ['abroad','6 months','live','country','expat'], 'high'),
    v('Visit 50+ countries and document the journey',                  2,   'social',  ['50 countries','visit','document','world','journey'], 'medium'),
    v('Build a travel blog, channel, or brand with a real audience',   3,   'creative', ['blog','channel','brand','audience','travel','build'], 'medium'),
    v('Create a 100-destination bucket list and start executing it',  1,   'light',   ['bucket list','100','destinations','execute','create'], 'medium'),
    v('Complete a multi-week overland, sailing, or thru-hike journey',3,   'social',  ['overland','sailing','thru hike','multi week','epic'], 'high'),
    v('Build a sustainable annual travel rhythm of 4+ trips per year',2,   'deep',    ['annual','rhythm','4 trips','sustainable','year'], 'medium'),
    v('Complete a major multi-stage pilgrimage or long trail',         3,   'social',  ['pilgrimage','trail','camino','long distance','stage'], 'high'),
    v('Plan and execute a family gap year or adventure',               3,   'social',  ['family','gap year','adventure','together','plan'], 'high'),
    v('Organize an epic group trip for 10+ people end to end',        3,   'social',  ['group trip','organize','10 people','logistics','plan'], 'medium'),
    v('Build a 10-year travel vision with specific destinations',      1,   'light',   ['10 year','vision','specific','destinations','plan'], 'medium'),
    v('Achieve financial independence that enables travel anytime',    2,   'deep',    ['financial','independence','travel','anytime','freedom'], 'high'),
    v('Learn a language to conversational fluency before a trip',     2,   'creative', ['language','fluency','conversational','learn','before'], 'high'),
    v('Complete a meaningful volunteer or impact travel experience',   2,   'social',  ['volunteer','impact','meaningful','travel','service'], 'medium'),
    v('Build relationships with locals in 10+ countries you visit',   2,   'social',  ['locals','relationships','10 countries','build','deep'], 'medium'),
    v('Develop a sustainable travel practice that minimizes impact',   1,   'deep',    ['sustainable','impact','minimal','eco','travel'], 'medium'),
  ],

  // ── CREATIVE ──────────────────────────────────────────────────────────────
  Creative: [
    // Habits
    h('Create for 30 minutes: {goal}',                         0.5,  'creative',['create','make','build','craft','produce','practice']),
    h('Capture one idea, sketch, or creative spark',           0.1,  'creative',['idea','capture','spark','sketch','note','inspiration']),
    h('Study one creator or work in your field',               0.25, 'creative',['study','creator','work','inspiration','learn','master']),
    h('Practice your core creative skill for 20 minutes',      0.33, 'creative',['practice','skill','core','daily','deliberate','improve']),
    h('Share one piece of work or progress publicly',          0.25, 'social',  ['share','publish','post','progress','public'], 'weekly', [5]),
    h('Weekly creative review: what am I most proud of?',      0.5,  'creative',['review','proud','creative','weekly','best'], 'weekly', [0]),
    h('Seek feedback on one piece of your creative work',      0.25, 'social',  ['feedback','seek','work','peer','improve'], 'weekly', [3]),
    h('Experiment with a new technique or style',              0.5,  'creative',['experiment','technique','style','new','try'], 'weekly', [6]),
    h('Spend 15 minutes studying a master in your medium',     0.25, 'creative',['master','study','medium','technique','great'], 'weekly', [2]),
    h('Dedicate one extended 3-hour creative session',         3,    'creative',['extended','session','deep','3 hour','focused'], 'weekly', [6]),

    // Project
    p('Define the creative project you want to complete',               0.5, 'creative', ['define','project','complete','creative','what'], 'high'),
    p('Set a deadline and working title for {goal}',                    0.25,'light',    ['deadline','title','set','project','commit'], 'high'),
    p('Research techniques and styles that serve {goal}',              1,   'creative', ['research','techniques','styles','serve','learn'], 'medium'),
    p('Build or organize a dedicated creative workspace',               1,   'light',    ['workspace','creative','organize','build','environment'], 'medium'),
    p('Complete a rough first draft or initial prototype',              2,   'creative', ['draft','prototype','first','rough','complete'], 'high'),
    p('Share early work with a trusted audience for feedback',          0.5, 'social',   ['share','early','audience','feedback','trusted'], 'high'),
    p('Study 3 creators you admire and extract one lesson each',        1,   'creative', ['study','creators','admire','lesson','extract','3'], 'medium'),
    p('Complete one creative piece from start to finish',               3,   'creative', ['complete','piece','start','finish','whole'], 'high'),
    p('Submit your work to one publication, show, or platform',         0.5, 'light',    ['submit','publish','show','platform','send'], 'medium'),
    p('Curate your 5–10 best pieces into a portfolio',                  1,   'creative', ['portfolio','best','pieces','curate','showcase'], 'high'),
    p('Take a workshop or class in your creative medium',               3,   'creative', ['workshop','class','take','learn','medium'], 'medium'),
    p('Define your unique creative voice, aesthetic, or perspective',   1,   'creative', ['voice','aesthetic','define','unique','perspective'], 'high'),
    p('Collaborate on one piece with another creative',                 2,   'social',   ['collaborate','piece','another','creator','together'], 'medium'),
    p('Document your creative process in a journal or video log',       0.25,'creative', ['document','process','journal','video','log'], 'low'),
    p('Experiment with a technique outside your comfort zone',          1,   'creative', ['experiment','outside','comfort zone','technique','try'], 'medium'),
    p('Identify your main creative block and make a plan',              0.5, 'deep',     ['block','creative','identify','plan','overcome'], 'high'),
    p('Build a creative routine that protects your best hours',         0.5, 'deep',     ['routine','creative','protect','hours','time'], 'high'),
    p('Complete a 30-day daily creative challenge',                     0.5, 'creative', ['30 day','challenge','daily','creative','streak'], 'medium'),
    p('Research how to share, exhibit, or monetize your work',          0.5, 'light',    ['monetize','share','exhibit','sell','market','revenue'], 'medium'),
    p('Define the creative standard you\'re aiming for in {goal}',     0.5, 'creative', ['standard','quality','aim','define','creative','bar'], 'medium'),

    // Venture
    v('Complete and release a major creative work: book, album, or film',4,  'creative', ['major','work','release','book','album','film','complete'], 'high'),
    v('Build an audience of 10,000+ around your creative work',         3,   'creative', ['audience','10000','build','following','creative'], 'high'),
    v('Launch a creative studio, agency, or independent practice',      3,   'deep',     ['studio','agency','launch','creative','practice','business'], 'high'),
    v('Generate $X in revenue from your creative work',                 2,   'deep',     ['revenue','income','generate','creative','sell','earn'], 'high'),
    v('Land a gallery show, record deal, publishing contract, or commission',1,'social',  ['gallery','record deal','publishing','commission','contract','land'], 'high'),
    v('Collaborate with established names in your creative field',      2,   'social',   ['collaborate','established','names','field','creative'], 'high'),
    v('Develop a signature style that\'s immediately recognizable',     2,   'creative', ['signature','style','recognizable','develop','unique'], 'high'),
    v('Build a creative brand with merchandise or licensing potential', 2,   'creative', ['brand','merchandise','licensing','creative','build'], 'medium'),
    v('Release a body of work that defines your creative voice',        3,   'creative', ['body of work','defines','voice','release','creative'], 'high'),
    v('Win a meaningful award, grant, or recognition in your field',    1,   'light',    ['award','grant','recognition','win','field','honor'], 'high'),
    v('Build a teaching practice around your creative expertise',       2,   'social',   ['teaching','practice','expertise','build','creative'], 'medium'),
    v('Create a peer community of collaborators and co-creators',       2,   'social',   ['community','collaborators','co creators','create','peer'], 'medium'),
    v('Place your work in a major publication, platform, or venue',     1,   'light',    ['place','major','publication','platform','venue','feature'], 'high'),
    v('Complete a multi-year ambitious creative project',               4,   'creative', ['multi year','ambitious','project','creative','complete'], 'high'),
    v('Build a residency or creative studio program for others',        3,   'social',   ['residency','studio','program','others','build','creative'], 'medium'),
    v('Develop a creative IP that generates ongoing royalties',         3,   'deep',     ['ip','royalties','creative','develop','licensing'], 'high'),
    v('Launch a creative agency, production company, or studio',        3,   'deep',     ['agency','production','studio','launch','creative','company'], 'high'),
    v('Build a consistent output discipline: one major work per year', 2,   'creative', ['output','discipline','annual','major','work','year'], 'medium'),
    v('Write and publish your creative manifesto',                      1,   'creative', ['manifesto','write','publish','creative','philosophy'], 'medium'),
    v('Sustain a creative practice for 10+ years with consistent output',1,  'creative', ['sustain','10 years','consistent','output','practice','long term'], 'high'),
  ],

  // ── BUSINESS ──────────────────────────────────────────────────────────────
  Business: [
    // Habits
    h('Review key business metrics: revenue, leads, pipeline',  0.25, 'deep',   ['metrics','revenue','leads','pipeline','business','kpi']),
    h('Reach out to one potential client, partner, or collaborator',0.25,'social',['client','outreach','partner','leads','prospect']),
    h('Review and respond to customer feedback',                0.25, 'light',  ['customer','feedback','respond','review','nps']),
    h('Post or engage on one business content channel',         0.25, 'creative',['post','content','channel','social','engage','brand']),
    h('Weekly team standup and priority alignment',             0.5,  'social', ['standup','team','alignment','priorities','meeting'], 'weekly', [1]),
    h('Review weekly revenue vs. target',                       0.25, 'deep',   ['revenue','target','weekly','vs','compare'], 'weekly', [5]),
    h('Spend 30 minutes working ON the business strategy',      0.5,  'deep',   ['strategy','on the business','30 min','think','plan'], 'weekly', [1]),
    h('Review pipeline and follow up on warm leads',            0.5,  'light',  ['pipeline','leads','follow up','warm','crm'], 'weekly', [3]),
    h('Review P&L and cash flow position',                      0.5,  'deep',   ['pl','profit loss','cash flow','finance','review'], 'weekly', [5]),
    h('Capture one competitive insight or market observation',  0.25, 'light',  ['competitive','market','insight','observe','capture']),

    // Project
    p('Define your core business model and revenue streams',          1,   'deep',   ['business model','revenue','streams','define','core'], 'high'),
    p('Research your ideal customer and build an ICP document',       1,   'deep',   ['ideal customer','icp','research','profile','persona'], 'high'),
    p('Validate your offer with 10 potential customers',              2,   'social', ['validate','offer','customers','10','test','research'], 'high'),
    p('Write a lean one-page business plan',                          1,   'deep',   ['business plan','one page','lean','write','strategy'], 'high'),
    p('Register your business and set up legal and banking',          1,   'light',  ['register','legal','banking','llc','structure'], 'high'),
    p('Build a landing page or pre-launch waitlist for {goal}',       3,   'creative',['landing page','waitlist','pre launch','build','website'], 'high'),
    p('Launch a minimum viable product or service',                   4,   'deep',   ['mvp','minimum viable','launch','product','service'], 'high'),
    p('Set up a CRM and start tracking every lead',                   1,   'deep',   ['crm','tracking','leads','setup','sales'], 'high'),
    p('Price your offer with a clear rationale and margin',           1,   'deep',   ['pricing','offer','margin','rationale','price'], 'high'),
    p('Build a 90-day marketing and acquisition plan',                1,   'deep',   ['marketing','90 day','acquisition','plan','strategy'], 'medium'),
    p('Map your top 3 competitors and articulate your differentiation',1,  'deep',   ['competitors','differentiate','map','3','compare'], 'high'),
    p('Build a referral or affiliate program',                        1,   'creative',['referral','affiliate','program','word of mouth','build'], 'medium'),
    p('Set up bookkeeping, invoicing, and expense tracking',          1,   'light',  ['bookkeeping','invoicing','expenses','accounting','track'], 'high'),
    p('Build a simple customer acquisition funnel',                   2,   'deep',   ['funnel','acquisition','customer','build','leads'], 'high'),
    p('Develop a repeatable sales process or call script',            1,   'deep',   ['sales','process','script','repeatable','develop'], 'high'),
    p('Hire or contract your first team member or specialist',        1,   'social', ['hire','contract','team','first','contractor'], 'high'),
    p('Define a 90-day revenue target and reverse-engineer it',       0.5, 'deep',   ['90 day','revenue','target','reverse engineer','actions'], 'high'),
    p('Run a pilot or beta with 5 paying customers',                  2,   'social', ['pilot','beta','5','paying','customers','test'], 'high'),
    p('Build a content strategy for thought leadership',              1,   'creative',['content','strategy','thought leadership','brand','positioning'], 'medium'),
    p('Document your core operational and delivery processes',        2,   'deep',   ['document','processes','operations','delivery','sop'], 'medium'),

    // Venture
    v('Scale revenue to $X/month with a repeatable system',           3,   'deep',   ['scale','revenue','monthly','system','repeatable'], 'high'),
    v('Build a self-managing team with clear roles and SOPs',         3,   'deep',   ['self managing','team','sop','roles','build'], 'high'),
    v('Raise a funding round: pre-seed, seed, or Series A',           3,   'deep',   ['raise','funding','seed','series a','investors','round'], 'high'),
    v('Expand into a new geographic market or customer segment',      2,   'deep',   ['expand','geographic','market','segment','new','launch'], 'high'),
    v('Build a strategic distribution channel partnership',           2,   'social', ['distribution','channel','partnership','strategic','partner'], 'high'),
    v('Launch a second product line or service offering',             3,   'deep',   ['second','product','line','launch','new','offering'], 'high'),
    v('Reach product-market fit with strong NPS and retention',       2,   'deep',   ['product market fit','nps','retention','strong','pmf'], 'high'),
    v('Build a franchise or licensing model for {goal}',              3,   'deep',   ['franchise','licensing','model','build','scale'], 'high'),
    v('Develop and execute an exit or acquisition strategy',          2,   'deep',   ['exit','acquisition','strategy','sell','merge'], 'high'),
    v('Scale from zero to 6-figure annual revenue',                   3,   'deep',   ['zero','6 figure','100k','scale','revenue','annual'], 'high'),
    v('Build a brand that generates significant inbound demand',      3,   'creative',['brand','inbound','demand','build','attract'], 'high'),
    v('Develop a proprietary technology, method, or IP advantage',   3,   'deep',   ['proprietary','technology','ip','moat','advantage'], 'high'),
    v('Build a key channel with 20+ active distribution partners',   2,   'social', ['channel','partners','20','distribution','active'], 'high'),
    v('Hire a leadership team: CRO, CFO, COO, or equivalent',        2,   'social', ['leadership','team','cro','cfo','coo','hire'], 'high'),
    v('Launch a recurring revenue model: SaaS, membership, retainer',3,   'deep',   ['recurring','revenue','saas','membership','retainer','launch'], 'high'),
    v('Design a 3-year growth roadmap with quarterly milestones',     2,   'deep',   ['3 year','roadmap','growth','quarterly','milestones'], 'high'),
    v('Build a community-led growth engine around your brand',        2,   'creative',['community','growth','engine','brand','led'], 'medium'),
    v('Reach profitability while sustaining meaningful growth',       2,   'deep',   ['profitability','profitable','growth','reach','sustain'], 'high'),
    v('Document your business playbook for scale and delegation',     2,   'creative',['playbook','document','scale','delegate','sop'], 'medium'),
    v('Build a business that grows without you in it daily',          3,   'deep',   ['self running','grows','without','daily','systematize'], 'high'),
  ],

  // ── COMMUNITY ─────────────────────────────────────────────────────────────
  Community: [
    // Habits
    h('Complete one act of service or community contribution',  0.5,  'social',  ['service','contribution','community','act','help']),
    h('Share a useful resource or insight with your community', 0.25, 'light',   ['share','resource','insight','community','useful']),
    h('Engage meaningfully on your community platform',         0.25, 'social',  ['engage','platform','community','post','respond']),
    h('Read local news or updates relevant to {goal}',          0.25, 'light',   ['local','news','updates','current','read','community']),
    h('Attend or host a recurring community gathering',         1.5,  'social',  ['gather','attend','host','community','recurring'], 'weekly', [6]),
    h('Check in on a community member who may need support',    0.25, 'social',  ['checkin','member','support','community','care'], 'weekly', [3]),
    h('Contribute to an ongoing community project or initiative',1,   'social',  ['contribute','project','initiative','community','ongoing'], 'weekly', [4]),
    h('Identify one way to make your community better this week',0.25,'deep',    ['identify','improve','community','better','opportunity'], 'weekly', [0]),
    h('Volunteer for a recurring community service role',       2,    'social',  ['volunteer','recurring','role','service','community'], 'weekly', [6]),
    h('Make a financial contribution to a cause you believe in',0.1,  'light',   ['donate','contribution','financial','cause','give'], 'weekly', [1]),

    // Project
    p('Define the community cause or initiative you\'re committed to', 0.5, 'deep',   ['define','cause','initiative','committed','community'], 'high'),
    p('Research existing organizations working on {goal}',              1,   'deep',   ['research','organizations','working','existing','goal'], 'high'),
    p('Volunteer with one organization for a full month',               4,   'social', ['volunteer','organization','month','full','commit'], 'high'),
    p('Attend a community meeting, town hall, or planning session',     2,   'social', ['attend','meeting','town hall','planning','session'], 'medium'),
    p('Connect with 3 community leaders in your area',                  0.5, 'social', ['connect','leaders','3','community','area'], 'medium'),
    p('Organize one community event, cleanup, or gathering',            3,   'social', ['organize','event','cleanup','gathering','community'], 'high'),
    p('Recruit 5 people to join the community initiative',              0.5, 'social', ['recruit','5','join','initiative','people'], 'medium'),
    p('Research grant or funding sources for your community goal',      1,   'deep',   ['grant','funding','research','sources','community'], 'medium'),
    p('Start a neighborhood, online, or local community group',         1,   'social', ['start','group','neighborhood','online','community'], 'high'),
    p('Create a resource guide or directory for your community',        2,   'creative',['resource','guide','directory','create','community'], 'medium'),
    p('Complete a skills-based volunteer project using your expertise', 3,   'deep',   ['skills based','volunteer','expertise','project','use'], 'high'),
    p('Partner with a local organization on a shared initiative',       1,   'social', ['partner','local','organization','shared','initiative'], 'high'),
    p('Run a personal fundraising campaign for your cause',             2,   'social', ['fundraise','campaign','personal','cause','raise'], 'high'),
    p('Host a workshop or educational event for your community',        3,   'social', ['host','workshop','educational','event','community'], 'medium'),
    p('Mentor one person from a community you care about',              1,   'social', ['mentor','person','community','care','support'], 'high'),
    p('Write a community improvement proposal or petition',             1,   'creative',['proposal','petition','write','improvement','community'], 'medium'),
    p('Collect and preserve community stories worth remembering',       2,   'creative',['collect','stories','preserve','history','community'], 'medium'),
    p('Facilitate a community dialogue or listening session',           2,   'social', ['facilitate','dialogue','listening','session','community'], 'medium'),
    p('Build a coalition around a shared community goal',               1,   'social', ['coalition','build','shared','goal','community'], 'high'),
    p('Measure and report your community impact to stakeholders',       1,   'deep',   ['measure','report','impact','stakeholders','community'], 'medium'),

    // Venture
    v('Build and lead a community organization with 100+ active members',3,  'social', ['build','lead','100','members','organization','community'], 'high'),
    v('Launch a nonprofit, cooperative, or social enterprise',          3,   'deep',   ['nonprofit','cooperative','social enterprise','launch','build'], 'high'),
    v('Earn a leadership position: board seat, council, or office',     2,   'social', ['leadership','board','council','office','position','earn'], 'high'),
    v('Secure grant funding or major donations for the initiative',     2,   'deep',   ['grant','funding','donations','secure','major'], 'high'),
    v('Build a movement with regional or national visibility',          3,   'social', ['movement','national','regional','visibility','build'], 'high'),
    v('Develop partnerships with government, business, or philanthropy',2,   'social', ['government','business','philanthropy','partnership','develop'], 'high'),
    v('Secure major institutional funding for a community program',     2,   'deep',   ['institutional','funding','program','secure','major'], 'high'),
    v('Build a lasting institution: school, center, or foundation',     4,   'deep',   ['institution','school','center','foundation','lasting'], 'high'),
    v('Build a self-sustaining community or membership platform',       3,   'deep',   ['sustaining','membership','platform','community','self'], 'high'),
    v('Train and develop a team of community leaders',                  2,   'social', ['train','develop','team','leaders','community'], 'high'),
    v('Create a model or program replicated in other communities',      3,   'deep',   ['model','replicated','other communities','create','scale'], 'high'),
    v('Run a community campaign that achieves a policy change',         3,   'social', ['campaign','policy','change','achieve','run'], 'high'),
    v('Build a recognizable community brand or identity',               2,   'creative',['brand','identity','recognizable','community','build'], 'medium'),
    v('Write and publish a book on community building',                 3,   'creative',['book','publish','write','community building'], 'medium'),
    v('Create a 5-year strategic plan for your community organization', 2,   'deep',   ['5 year','strategic plan','organization','community'], 'high'),
    v('Develop a community health, education, or economic initiative',  3,   'social', ['health','education','economic','initiative','develop'], 'high'),
    v('Build alliances across community factions or competing groups',  2,   'social', ['alliances','factions','competing','groups','bridge'], 'high'),
    v('Establish a community foundation with long-term endowment',      3,   'deep',   ['foundation','endowment','long term','establish','community'], 'high'),
    v('Train the next generation of leaders in {goal}',                 2,   'social', ['next generation','leaders','train','future','develop'], 'high'),
    v('Document and publish your community-building playbook',          2,   'creative',['playbook','document','publish','community building'], 'medium'),
  ],
}

// ─── Complexity assessment ────────────────────────────────────────────────────

function assessGoalComplexity(goalText: string, category: string): {
  score: number
  tier: 'habit' | 'project' | 'venture'
  taskCount: number
} {
  const text = goalText.toLowerCase()
  let score = 0

  // Category baseline
  const baselines: Record<string, number> = {
    Business: 30, Career: 20, Finance: 15,
    Education: 10, Creative: 10, Travel: 10, Community: 10,
    Health: 5, 'Personal Growth': 5, Relationships: 5,
  }
  score += baselines[category] ?? 10

  // Venture signals (+8 each)
  const ventureWords = [
    'launch', 'build', 'start', 'create', 'establish', 'grow', 'scale',
    'develop', 'portfolio', 'business', 'revenue', 'clients', 'product',
    'service', 'company', 'brand', 'platform', 'strategy', 'invest',
    'income', 'enterprise',
  ]
  for (const word of ventureWords) {
    if (text.includes(word)) score += 8
  }

  // Project signals (+4 each)
  const projectWords = [
    'learn', 'complete', 'finish', 'achieve', 'reach', 'improve', 'earn',
    'certification', 'degree', 'course', 'skill', 'travel', 'plan',
    'organize', 'write', 'publish', 'run', 'marathon', 'race',
  ]
  for (const word of projectWords) {
    if (text.includes(word)) score += 4
  }

  // Habit signals (−5 each)
  const habitWords = [
    'daily', 'routine', 'habit', 'drink', 'walk', 'sleep', 'meditate',
    'journal', 'read', 'exercise', 'workout', 'practice', 'every day', 'each day',
  ]
  for (const word of habitWords) {
    if (text.includes(word)) score -= 5
  }

  // Dollar amounts or large numbers
  if (/\$[\d,]+k?|\b\d+k\b/i.test(text)) score += 20
  if (/\b\d{4,}\b/.test(text.replace(/,/g, ''))) score += 10

  // Compound goals
  const andCount = (text.match(/\band\b/g) || []).length
  const commaCount = (text.match(/,/g) || []).length
  score += (andCount + commaCount) * 5

  score = Math.max(0, Math.min(100, score))

  let tier: 'habit' | 'project' | 'venture'
  let taskCount: number

  if (score < 25) {
    tier = 'habit'
    taskCount = 3 + Math.round(score * 0.08)
  } else if (score < 55) {
    tier = 'project'
    taskCount = 5 + Math.round((score - 25) * 0.23)
  } else {
    tier = 'venture'
    taskCount = 12 + Math.round((score - 55) * 0.26)
  }

  return { score, tier, taskCount }
}

// ─── Template selection ───────────────────────────────────────────────────────

function selectTemplates(
  tier: 'habit' | 'project' | 'venture',
  templates: EnhancedTaskTemplate[],
  goalText: string,
  count: number,
): EnhancedTaskTemplate[] {
  const text = goalText.toLowerCase()

  // Tier eligibility
  const allowed: Record<string, EnhancedTaskTemplate['complexity_tier'][]> = {
    habit:   ['habit'],
    project: ['habit', 'project'],
    venture: ['habit', 'project', 'venture'],
  }
  const eligible = templates.filter(t => allowed[tier].includes(t.complexity_tier))

  // Score by keyword overlap
  const scored = eligible.map(t => ({
    t,
    score: t.keywords.filter(k => text.includes(k)).length,
  }))

  const priorityRank = { high: 2, medium: 1, low: 0 } as const

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return priorityRank[b.t.priority] - priorityRank[a.t.priority]
  })

  // Deduplicate: max 1 daily recurring per energy type, max 3 weekly recurring total
  const dailyEnergyUsed = new Set<string>()
  let weeklyRecurringCount = 0
  const selected: EnhancedTaskTemplate[] = []

  for (const { t } of scored) {
    if (selected.length >= count) break
    if (t.is_recurring) {
      if (t.frequency === 'daily') {
        if (dailyEnergyUsed.has(t.energyType)) continue
        dailyEnergyUsed.add(t.energyType)
      } else {
        if (weeklyRecurringCount >= 3) continue
        weeklyRecurringCount++
      }
    }
    selected.push(t)
  }

  return selected
}

// ─── V2 generator ─────────────────────────────────────────────────────────────

export function generateTasksForGoalV2(
  goal: { id: string; text: string; category: string; project_id?: string | null },
  energyBlocks: Record<string, string>,
  workSchedule: WorkSchedule,
  startDate: Date = new Date(),
  alreadyScheduled: { date: string; scheduled_time: string }[] = [],
): GeneratedTaskV2[] {
  const { tier, taskCount } = assessGoalComplexity(goal.text, goal.category)
  const pool      = ENHANCED_TEMPLATES[goal.category] ?? ENHANCED_TEMPLATES['Personal Growth']
  const selected  = selectTemplates(tier, pool, goal.text, taskCount)

  const results: GeneratedTaskV2[] = []
  const today     = new Date(startDate)
  const todayDay  = today.getDay()

  // ends_on: 6 months from today for recurring tasks
  const sixMonths = new Date(today)
  sixMonths.setMonth(sixMonths.getMonth() + 6)
  const endsOn    = toDateStr(sixMonths)

  const onetimeSlots: { date: string; scheduled_time: string }[] = [...alreadyScheduled]
  let onetimeIndex = 0

  for (const t of selected) {
    const goalShort = goal.text.split(' ').slice(0, 4).join(' ')
    const text      = t.text.replace('{goal}', goalShort)

    const base = {
      text,
      duration:     t.duration,
      category:     goal.category,
      priority:     t.priority,
      goal_id:      goal.id,
      milestone_id: null as string | null,
      project_id:   goal.project_id ?? null,
      source:       'auto' as const,
    }

    if (t.is_recurring) {
      const rule: RecurrenceRule = {
        frequency:    t.frequency ?? 'daily',
        ...(t.days_of_week?.length ? { days_of_week: t.days_of_week } : {}),
        ends_on:      endsOn,
      }
      results.push({
        kind: 'recurring',
        payload: {
          taskData: {
            ...base,
            scheduled_time: ENERGY_TIME_MAP[t.energyType] ?? '09:00',
          },
          rule,
        },
      })
    } else {
      // Spread one-time tasks across coming days
      const targetDate = new Date(today)
      if (t.dayPreference >= 0) {
        const targetJS  = t.dayPreference === 6 ? 0 : t.dayPreference + 1
        const daysAhead = (targetJS - todayDay + 7) % 7
        targetDate.setDate(today.getDate() + (daysAhead === 0 ? 7 : daysAhead))
      } else {
        targetDate.setDate(today.getDate() + onetimeIndex * 2)
      }

      const dateStr       = toDateStr(targetDate)
      const occupiedOnDay = onetimeSlots.filter(s => s.date === dateStr)

      const slot = findBestSlot(
        { energyType: t.energyType, category: goal.category, duration: t.duration },
        targetDate,
        energyBlocks,
        occupiedOnDay,
        workSchedule,
      ) ?? getDefaultSlot(goal.category, workSchedule, onetimeIndex)

      onetimeSlots.push({ date: dateStr, scheduled_time: slot })

      results.push({
        kind: 'onetime',
        task: {
          ...base,
          date:           dateStr,
          scheduled_time: slot,
          completed:      false,
        },
      })
      onetimeIndex++
    }
  }

  return results
}
