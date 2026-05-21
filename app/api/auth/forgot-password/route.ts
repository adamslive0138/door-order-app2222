import { NextResponse } from 'next/server'
import { createAdminClient } from '@/src/lib/supabase/admin'

const GENERIC_SUCCESS = { success: true }

export async function POST(req: Request) {
  let body: { company_code?: string; username?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { company_code, username } = body

  if (!company_code?.trim() || !username?.trim()) {
    return NextResponse.json({ error: 'Şirket kodu ve kullanıcı adı zorunludur.' }, { status: 400 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Sunucu yapılandırma hatası.' }, { status: 500 })
  }

  // Resolve company + profile + email. Always respond with a generic success to
  // avoid leaking which company codes / usernames exist.
  const normalizedCompanyCode = company_code.trim().toLowerCase()
  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('code', normalizedCompanyCode)
    .maybeSingle()

  if (!company) return NextResponse.json(GENERIC_SUCCESS)

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('company_id', company.id)
    .eq('username', username.trim().toLowerCase())
    .maybeSingle()

  if (!profile) return NextResponse.json(GENERIC_SUCCESS)

  const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
  const email = authUser?.user?.email
  if (!email) return NextResponse.json(GENERIC_SUCCESS)

  const origin =
    req.headers.get('origin') ??
    `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('host') ?? ''}`

  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })

  if (error) {
    console.error('[forgot-password] resetPasswordForEmail error:', error.message)
    // Still return generic success to avoid information disclosure.
  }

  return NextResponse.json(GENERIC_SUCCESS)
}
