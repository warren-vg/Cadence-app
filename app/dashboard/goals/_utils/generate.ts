// Deterministic AI-style goal generation — same input always produces same output.

export interface Milestone {
  id: string
  text: string
  completed: boolean
}

export interface GoalDetails {
  refinedGoal: string
  metric: string
  purpose: string
  steps: string[]
  milestones: Milestone[]
  whyItWorks: { key: string; explanation: string }[]
}

// ─── Hash helper ──────────────────────────────────────────────────────────────

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

// ─── Category templates ───────────────────────────────────────────────────────

interface Templates {
  verbs: string[]
  refineSuffixes: string[]
  metrics: string[]
  purposes: string[]
  stepSets: string[][]
  milestoneSets: string[][]
  whySets: { key: string; explanation: string }[][]
}

const TEMPLATES: Record<string, Templates> = {
  Career: {
    verbs: ['Build and launch', 'Develop and establish', 'Create and grow'],
    refineSuffixes: [
      'generating consistent revenue and client outcomes',
      'with a strong portfolio and measurable client results',
      'supported by a clear positioning and outreach strategy',
    ],
    metrics: [
      'Secure 3 paid clients and generate $5,000 in revenue',
      'Complete 5 projects with documented outcomes and 5-star reviews',
      'Publish 10 portfolio pieces and sign 2 long-term contracts',
    ],
    purposes: [
      'Establish professional independence and creative freedom',
      'Build income from work that aligns with skills and values',
      'Create a sustainable career path outside traditional employment',
    ],
    stepSets: [
      [
        'Define service offerings and pricing structure',
        'Build portfolio website with 3+ case studies',
        'Create client proposal and contract templates',
        'Reach out to 20 warm contacts in your network',
        'Publish weekly content to build thought leadership',
      ],
      [
        'Research target clients and their pain points',
        'Set up LinkedIn and professional profiles',
        'Create a lead generation and follow-up system',
        'Schedule discovery calls with 5 prospects',
        'Refine offer based on feedback and close first client',
      ],
    ],
    milestoneSets: [
      ['Portfolio site live', 'First case study published', 'First paying client secured'],
      ['Service offerings defined', 'First outreach campaign sent', 'Revenue milestone reached'],
    ],
    whySets: [
      [
        { key: 'Specific timeline:', explanation: 'Adding a quarter creates urgency and a clear deadline to work backward from' },
        { key: 'Measurable outcome:', explanation: 'Client count and revenue targets make success easy to track' },
        { key: 'Clear method:', explanation: 'Portfolio + outreach defines exactly how the goal will be achieved' },
      ],
      [
        { key: 'Action-oriented:', explanation: 'Strong verb sets the tone for decisive progress from day one' },
        { key: 'Outcome-focused:', explanation: 'Defines what success looks like, not just the activity' },
        { key: 'Time-bound:', explanation: 'A fixed deadline prevents indefinite delay and creates momentum' },
      ],
    ],
  },

  Finance: {
    verbs: ['Save and grow', 'Build and secure', 'Establish and maintain'],
    refineSuffixes: [
      'through automated monthly contributions and tracked milestones',
      'with a zero-based budget and consistent savings habit',
      'by reducing unnecessary expenses and redirecting funds',
    ],
    metrics: [
      'Reach savings target with automated monthly contributions',
      'Automate $X per month and track progress in a weekly review',
      'Reduce discretionary spending by 15% and redirect to savings goal',
    ],
    purposes: [
      'Build financial security and eliminate money-related stress',
      'Create a safety net that enables future opportunities and freedom',
      'Gain full control of finances to support long-term life goals',
    ],
    stepSets: [
      [
        'Calculate monthly income, fixed costs, and discretionary spending',
        'Open a dedicated high-yield savings account',
        'Set up automated monthly transfer on payday',
        'Cut 3 non-essential subscriptions or recurring expenses',
        'Review spending weekly and adjust in a monthly money check-in',
      ],
      [
        'Review current budget and identify 3 spending gaps',
        'Research high-yield savings and investment options',
        'Create a 12-month savings schedule with monthly targets',
        'Find one additional income stream or side project',
        'Track net worth monthly and celebrate milestone wins',
      ],
    ],
    milestoneSets: [
      ['Savings account opened and automation set', '25% of goal reached', 'Full target amount achieved'],
      ['Budget plan created and reviewed', '50% milestone hit', 'Emergency fund complete'],
    ],
    whySets: [
      [
        { key: 'Specific amount:', explanation: 'A dollar target removes ambiguity and makes progress measurable' },
        { key: 'Automated system:', explanation: 'Automation removes willpower from the equation' },
        { key: 'Clear deadline:', explanation: 'A timeline creates monthly contribution math and urgency' },
      ],
      [
        { key: 'Concrete target:', explanation: 'Exact savings amount makes tracking and progress obvious' },
        { key: 'Behavioral change:', explanation: 'Budget review creates the habit of financial awareness' },
        { key: 'Time-bound:', explanation: 'Month-by-month milestones prevent the goal feeling distant' },
      ],
    ],
  },

  Health: {
    verbs: ['Build and maintain', 'Develop a consistent', 'Establish a sustainable'],
    refineSuffixes: [
      'with a structured weekly training and nutrition plan',
      'through daily habits tracked with measurable weekly check-ins',
      'building progressive intensity toward a clear performance target',
    ],
    metrics: [
      'Complete target workouts per week for 12 consecutive weeks',
      'Reach measurable health goal with weekly progress documentation',
      'Hit a fitness benchmark (event, distance, or performance marker)',
    ],
    purposes: [
      'Increase energy levels and feel confident and strong in my body',
      'Build long-term health habits that support longevity and wellbeing',
      'Improve mental clarity and physical performance in daily life',
    ],
    stepSets: [
      [
        'Block weekly workouts in your calendar as non-negotiable appointments',
        'Plan and meal prep healthy options for the week on Sundays',
        'Find an accountability partner, coach, or group',
        'Track daily progress using an app or journal',
        'Schedule recovery and sleep as part of the plan',
      ],
      [
        'Define your specific health target and starting baseline',
        'Choose a proven training program suited to your schedule',
        'Stock home with nutritious staples to reduce poor food choices',
        'Set up a weekly self-check-in routine every Monday morning',
        'Celebrate small wins and adjust approach monthly',
      ],
    ],
    milestoneSets: [
      ['First full week of consistent training complete', 'Halfway point reached', 'Goal achieved and maintained'],
      ['Routine and habits established', 'First measurable progress noted', 'Target metric hit'],
    ],
    whySets: [
      [
        { key: 'Measurable target:', explanation: 'A specific health metric makes it easy to know when you\'ve succeeded' },
        { key: 'Consistent timeline:', explanation: 'Weekly structure is how lasting habits are actually built' },
        { key: 'Clear purpose:', explanation: 'Connecting to how you want to feel makes motivation intrinsic' },
      ],
      [
        { key: 'Specific outcome:', explanation: 'Naming the benchmark removes vagueness and tracks progress' },
        { key: 'Habit-based:', explanation: 'Daily practice beats sporadic intensity for lasting results' },
        { key: 'Time-bound:', explanation: 'A deadline prevents the goal from drifting into "someday"' },
      ],
    ],
  },

  Creative: {
    verbs: ['Complete and publish', 'Build and launch', 'Develop and share'],
    refineSuffixes: [
      'with a consistent creation schedule and public launch date',
      'through dedicated practice sessions and iterative feedback',
      'growing an engaged audience along the creative journey',
    ],
    metrics: [
      'Complete and publish a finished creative work by the target date',
      'Produce and share content consistently for 90+ days',
      'Build an audience of 500+ engaged followers around the work',
    ],
    purposes: [
      'Express myself authentically and share my perspective with the world',
      'Develop a unique creative voice and build lasting skills',
      'Turn creative passion into a sustainable and joyful practice',
    ],
    stepSets: [
      [
        'Define the scope, format, and creative brief for your project',
        'Block 3 dedicated creation hours per week in your calendar',
        'Share work-in-progress with a trusted feedback group',
        'Iterate based on feedback and refine craft weekly',
        'Set a launch date and publish publicly to hold accountability',
      ],
      [
        'Create a vision document with inspiration and reference points',
        'Build a consistent daily or weekly creation routine',
        'Study the work of creators you admire in your field',
        'Join a creative community for accountability and support',
        'Document your process and share it as additional content',
      ],
    ],
    milestoneSets: [
      ['First draft or prototype complete', 'Feedback gathered and revisions made', 'Work published or publicly launched'],
      ['Creative routine established', 'First piece shared publicly', 'Full project completed'],
    ],
    whySets: [
      [
        { key: 'Clear deliverable:', explanation: 'Naming the finished work avoids the trap of endless iteration' },
        { key: 'Measurable output:', explanation: 'A defined format and launch date creates creative urgency' },
        { key: 'Audience alignment:', explanation: 'Connecting with an audience adds purpose beyond personal satisfaction' },
      ],
      [
        { key: 'Specific format:', explanation: 'Defining the medium prevents scope creep and decision fatigue' },
        { key: 'Consistent practice:', explanation: 'Weekly creation blocks protect time in a busy schedule' },
        { key: 'Public commitment:', explanation: 'Sharing work externally accelerates growth through feedback' },
      ],
    ],
  },

  Travel: {
    verbs: ['Plan and complete', 'Book and experience', 'Research and embark on'],
    refineSuffixes: [
      'with a full itinerary, confirmed bookings, and travel budget secured',
      'with all logistics arranged 3 months in advance',
      'creating immersive local experiences beyond tourist highlights',
    ],
    metrics: [
      'All travel and accommodation confirmed 3 months before departure',
      'Full travel budget saved and trip completed by the target date',
      'All planned destinations visited with documented experiences',
    ],
    purposes: [
      'Expand perspective and create lifelong memories through new experiences',
      'Recharge and reconnect with myself through exploration and culture',
      'Fulfill a long-held personal dream and prove I prioritize myself',
    ],
    stepSets: [
      [
        'Research destination, visa requirements, and ideal travel season',
        'Create a detailed travel budget including buffer for surprises',
        'Book flights and accommodation at least 3 months out',
        'Plan a rough itinerary with must-see and off-the-beaten-path spots',
        'Arrange travel insurance, vaccinations, and emergency contacts',
      ],
      [
        'Open a dedicated travel savings account and automate contributions',
        'Follow travel blogs and communities for destination tips',
        'Learn key phrases in the local language using an app',
        'Connect with locals or expats through online communities',
        'Pack intentionally with a researched, minimal packing list',
      ],
    ],
    milestoneSets: [
      ['Budget saved and flights booked', 'Accommodation and itinerary confirmed', 'Trip completed and documented'],
      ['Research phase complete', 'All bookings finalized', 'Travel experience fully lived'],
    ],
    whySets: [
      [
        { key: 'Concrete destination:', explanation: 'A specific place replaces a vague wish with a real plan' },
        { key: 'Measurable budget:', explanation: 'Financial planning removes the biggest barrier to travel' },
        { key: 'Fixed date:', explanation: 'A departure date turns a dream into a commitment' },
      ],
      [
        { key: 'Specific location:', explanation: 'Naming the destination starts the research and planning process' },
        { key: 'Booking milestone:', explanation: 'Confirmed tickets create accountability and excitement' },
        { key: 'Timeline clarity:', explanation: 'A target date allows backward planning from departure' },
      ],
    ],
  },

  Relationships: {
    verbs: ['Deepen and invest in', 'Build and strengthen', 'Nurture and grow'],
    refineSuffixes: [
      'through consistent quality time and intentional shared experiences',
      'with regular communication rituals and meaningful moments',
      'showing up fully and creating lasting memories together',
    ],
    metrics: [
      'Dedicated quality time weekly and one meaningful shared experience monthly',
      'Reach out to 3 key people monthly and plan one special experience quarterly',
      'Complete a relationship milestone or shared goal together',
    ],
    purposes: [
      'Build deeper connections that bring lasting joy and meaning to life',
      'Invest in the relationships that matter most before time slips away',
      'Create a foundation of trust, love, and shared experience',
    ],
    stepSets: [
      [
        'Identify the 3 most important relationships to actively invest in',
        'Schedule recurring connection time in your calendar each week',
        'Plan one meaningful shared experience this quarter',
        'Be fully present — no devices during dedicated connection time',
        'Express appreciation and gratitude regularly and explicitly',
      ],
      [
        'Reach out to people you haven\'t connected with recently',
        'Create monthly connection rituals (calls, dinners, walks)',
        'Show up for the important moments in the people you love',
        'Listen actively and ask thoughtful, curious questions',
        'Build traditions that anchor the relationship over time',
      ],
    ],
    milestoneSets: [
      ['Connection routine established', 'First meaningful shared experience planned', 'Relationship goal achieved'],
      ['Priority relationships identified', 'Monthly check-ins scheduled', 'Shared milestone reached'],
    ],
    whySets: [
      [
        { key: 'Intentional focus:', explanation: 'Naming who you\'re investing in prevents spreading effort too thin' },
        { key: 'Consistent ritual:', explanation: 'Regular scheduled time beats sporadic grand gestures' },
        { key: 'Shared experience:', explanation: 'Doing things together creates the memories that define relationships' },
      ],
      [
        { key: 'Priority people:', explanation: 'Relationships require deliberate investment, not just good intentions' },
        { key: 'Measurable time:', explanation: 'Scheduling connection makes it real, not just a hope' },
        { key: 'Quality presence:', explanation: 'Showing up fully is more valuable than showing up often' },
      ],
    ],
  },

  Business: {
    verbs: ['Launch and grow', 'Build and scale', 'Establish and operate'],
    refineSuffixes: [
      'reaching profitability with validated product-market fit',
      'acquiring first 10 customers with a repeatable sales system',
      'with clear revenue targets and a lean, scalable operation',
    ],
    metrics: [
      'Reach $X in monthly revenue with 10 paying customers in the pipeline',
      'Acquire first 10 customers and achieve measurable product-market fit',
      'Launch MVP and generate first revenue within 90 days of starting',
    ],
    purposes: [
      'Build financial independence and creative control through entrepreneurship',
      'Create genuine value for customers while building personal wealth',
      'Prove the concept and create a scalable system before scaling investment',
    ],
    stepSets: [
      [
        'Validate idea with 10 real conversations with target customers',
        'Define the MVP and core value proposition in one clear sentence',
        'Build or source the minimum viable product or service',
        'Launch a simple landing page and manual sales funnel',
        'Close the first 3 paying customers through direct outreach',
      ],
      [
        'Conduct market research and analyze 3 competitors in depth',
        'Write a one-page business plan with financial projections',
        'Register business entity and set up essential operations',
        'Build initial customer acquisition and follow-up system',
        'Track 3 key metrics weekly and iterate on what isn\'t working',
      ],
    ],
    milestoneSets: [
      ['MVP built and first customer conversation held', 'First paying customer acquired', 'Revenue target reached'],
      ['Market validated through conversations', 'Product publicly launched', 'Profitability milestone hit'],
    ],
    whySets: [
      [
        { key: 'Revenue milestone:', explanation: 'A specific dollar target makes success concrete and trackable' },
        { key: 'Customer validation:', explanation: 'Paying customers prove the idea before you over-invest' },
        { key: 'Timeline urgency:', explanation: 'A quarter creates enough pressure to move fast and learn quickly' },
      ],
      [
        { key: 'Lean approach:', explanation: 'Starting with MVP avoids building what customers don\'t want' },
        { key: 'First revenue focus:', explanation: 'Early paying customers validate the model better than any plan' },
        { key: 'Fixed horizon:', explanation: 'A launch deadline forces decisions and prevents perfectionism' },
      ],
    ],
  },

  'Personal Growth': {
    verbs: ['Develop and master', 'Build and sustain', 'Learn and apply'],
    refineSuffixes: [
      'with structured daily practice and measurable skill milestones',
      'through immersive learning and real-world application',
      'reaching a defined proficiency level with documented outcomes',
    ],
    metrics: [
      'Complete structured learning program and apply skills in 3 real projects',
      'Dedicate daily practice sessions with documented improvement markers',
      'Reach conversational or professional proficiency level by target date',
    ],
    purposes: [
      'Expand capabilities and unlock opportunities previously out of reach',
      'Invest in myself through skills that compound value over a lifetime',
      'Grow beyond current comfort zones and become who I want to be',
    ],
    stepSets: [
      [
        'Define the specific skill and target level of proficiency',
        'Find the best structured course or learning resource available',
        'Block daily practice sessions (even 20-30 mins) in your calendar',
        'Find a practice partner, tutor, or accountability community',
        'Apply skills in a real-world context at least monthly',
      ],
      [
        'Research the optimal learning path for this specific skill',
        'Set weekly learning goals and track progress in a journal',
        'Join forums, communities, or groups around this skill',
        'Build projects that require applying what you\'re learning',
        'Review and adjust your learning approach every 4 weeks',
      ],
    ],
    milestoneSets: [
      ['Learning resource selected and first session complete', '50% proficiency milestone reached', 'Goal level achieved and tested'],
      ['Daily practice habit established', 'First real-world application complete', 'Full skill goal demonstrated'],
    ],
    whySets: [
      [
        { key: 'Specific skill:', explanation: 'Naming the exact proficiency level creates a clear target to aim for' },
        { key: 'Daily practice:', explanation: 'Consistent short sessions beat irregular long ones for skill building' },
        { key: 'Applied learning:', explanation: 'Real-world application cements skills in a way passive learning cannot' },
      ],
      [
        { key: 'Defined proficiency:', explanation: 'A clear level (conversational, professional) removes ambiguity' },
        { key: 'Structured system:', explanation: 'A chosen course or path prevents aimless, slow progress' },
        { key: 'Accountability:', explanation: 'Community and partnership accelerate growth through shared commitment' },
      ],
    ],
  },

  Community: {
    verbs: ['Build and lead', 'Create and grow', 'Establish and support'],
    refineSuffixes: [
      'with clear impact metrics and sustained community engagement',
      'engaging at least 50 people and completing 3 impact initiatives',
      'leaving a lasting structure that continues beyond personal involvement',
    ],
    metrics: [
      'Engage 50 community members and deliver 3 measurable impact initiatives',
      'Launch 3 programs with documented participation and feedback',
      'Build a platform with consistent monthly engagement and growth',
    ],
    purposes: [
      'Create positive impact and contribute to something bigger than myself',
      'Build meaningful connections while serving and lifting others',
      'Leave a lasting legacy in the community that matters to me',
    ],
    stepSets: [
      [
        'Define the specific community need you are positioned to address',
        'Connect with 10 key stakeholders and potential collaborators',
        'Plan and host your first community event or initiative',
        'Build a communication channel (newsletter, group, platform)',
        'Measure impact, gather feedback, and iterate monthly',
      ],
      [
        'Research existing community resources and gaps in service',
        'Find co-leaders and collaborators to share the load',
        'Create a simple 90-day community engagement plan',
        'Launch a pilot program and gather structured feedback',
        'Scale what works, sunset what doesn\'t, and document learnings',
      ],
    ],
    milestoneSets: [
      ['Community need defined and 90-day plan created', 'First initiative launched', 'Impact goal achieved'],
      ['Key stakeholders engaged', 'Community platform established', 'Sustained engagement reached'],
    ],
    whySets: [
      [
        { key: 'Defined need:', explanation: 'Starting with a specific gap ensures impact is real and felt' },
        { key: 'People first:', explanation: 'Stakeholder conversations before building prevents wasted effort' },
        { key: 'Measurable reach:', explanation: 'Engagement metrics turn good intentions into demonstrable impact' },
      ],
      [
        { key: 'Specific focus:', explanation: 'A defined community and need prevents spreading effort too thin' },
        { key: 'Pilot approach:', explanation: 'Testing small before scaling protects energy and resources' },
        { key: 'Sustainability:', explanation: 'Building structures that outlast personal involvement creates legacy' },
      ],
    ],
  },

  Education: {
    verbs: ['Complete and apply', 'Earn and leverage', 'Master and demonstrate'],
    refineSuffixes: [
      'with a structured study schedule and real-world application plan',
      'achieving target academic outcomes and career-relevant credentials',
      'applying knowledge immediately to maximize return on investment',
    ],
    metrics: [
      'Complete all coursework on schedule and apply in 2 real-world projects',
      'Earn the target credential by deadline with documented skill application',
      'Finish the program maintaining target GPA and complete a capstone project',
    ],
    purposes: [
      'Unlock career opportunities and meaningfully increase earning potential',
      'Develop expertise that creates genuine value for others and the world',
      'Invest in my future self through education that compounds over time',
    ],
    stepSets: [
      [
        'Create a detailed study schedule aligned with all key deadlines',
        'Gather all required materials, tools, and resources upfront',
        'Join a study group or find an accountability partner',
        'Apply learning immediately in practice projects or work',
        'Review progress weekly and adjust approach to stay on track',
      ],
      [
        'Research the most valuable credentials for your specific career goals',
        'Enroll and complete all registration and onboarding steps',
        'Set up a dedicated, distraction-free study environment',
        'Break the curriculum into weekly modules with clear targets',
        'Schedule spaced repetition review sessions to retain key material',
      ],
    ],
    milestoneSets: [
      ['Study schedule created and first module complete', '50% of curriculum finished on schedule', 'Credential earned and applied'],
      ['Enrolled and first assessment passed', 'Halfway milestone reached on track', 'Degree or certification achieved'],
    ],
    whySets: [
      [
        { key: 'Specific credential:', explanation: 'Naming the degree or cert gives the goal a clear finish line' },
        { key: 'Application focus:', explanation: 'Committing to use the knowledge prevents "shelf" learning' },
        { key: 'Schedule discipline:', explanation: 'A weekly study plan is what separates completers from dropouts' },
      ],
      [
        { key: 'Clear outcome:', explanation: 'A target credential makes the educational investment tangible' },
        { key: 'Milestone structure:', explanation: 'Smaller targets along the way prevent overwhelm and dropout' },
        { key: 'Career linkage:', explanation: 'Connecting the credential to opportunity creates intrinsic motivation' },
      ],
    ],
  },
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateGoalDetails(
  goalText: string,
  category: string,
  quarter: string,
  goalId: string,
  variant = 0,
): GoalDetails {
  const hash = hashString(goalText + variant)
  const templates = TEMPLATES[category] ?? TEMPLATES['Personal Growth']

  // Refined goal: verb + condensed original text + timeline
  const verb = pick(templates.verbs, hash)
  const suffix = pick(templates.refineSuffixes, hash + 1)

  // Strip common lead-in phrases so goal text composes naturally
  const condensed = goalText
    .replace(/^(i want to|i will|i'm going to|my goal is to|to)\s+/i, '')
    .trim()
  // Lower-case first char for natural composition
  const goalBody = condensed.charAt(0).toLowerCase() + condensed.slice(1)

  const refinedGoal = `${verb} ${goalBody} by ${quarter} — ${suffix}`
  const metric = pick(templates.metrics, hash + 2)
  const purpose = pick(templates.purposes, hash + 3)
  const steps = pick(templates.stepSets, hash + 4)
  const whyItWorks = pick(templates.whySets, hash + 5)

  const rawMilestones = pick(templates.milestoneSets, hash + 6)
  const milestones: Milestone[] = rawMilestones.map((text, i) => ({
    id: `${goalId}-m${i}`,
    text,
    completed: false,
  }))

  return { refinedGoal, metric, purpose, steps, milestones, whyItWorks }
}
