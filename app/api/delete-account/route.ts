import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { userId } = await request.json() as { userId: string }
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server not configured for account deletion' }, { status: 501 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  await Promise.allSettled([
    admin.from('goals').delete().eq('user_id', userId),
    admin.from('tasks').delete().eq('user_id', userId),
    admin.from('projects').delete().eq('user_id', userId),
    admin.from('project_tasks').delete().eq('user_id', userId),
    admin.from('schedule_items').delete().eq('user_id', userId),
    admin.from('quarterly_reviews').delete().eq('user_id', userId),
    admin.from('opportunity_evaluations').delete().eq('user_id', userId),
    admin.from('community_actions').delete().or(`actor_id.eq.${userId},target_id.eq.${userId}`),
    admin.from('friendships').delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`),
  ])

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.warn('delete user error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
