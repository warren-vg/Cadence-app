import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    const body = await request.json()
    const { to, subject, text } = body as { to: string; subject: string; text: string }
    if (!to || !subject || !text) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Cadence <notifications@cadence.app>',
        to,
        subject,
        text,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.warn('Resend error:', err)
      return NextResponse.json({ error: 'Email failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.warn('notify route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
