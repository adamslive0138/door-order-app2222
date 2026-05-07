import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/src/lib/supabase/admin'

const GENERIC_ERROR = 'Şirket kodu, kullanıcı adı veya şifre hatalı.'

export async function POST(req: Request) {
  let body: { company_code?: string; username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { company_code, username, password } = body

  console.log('[login] company_code:', company_code?.trim().toLowerCase())
  console.log('[login] username:', username?.trim().toLowerCase())

  if (!company_code?.trim() || !username?.trim() || !password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Sunucu yapılandırma hatası.' }, { status: 500 })
  }

  // 1. Resolve company by code
  const normalizedCompanyCode = company_code.trim().toLowerCase()
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, code')
    .eq('code', normalizedCompanyCode)
    .maybeSingle()

  console.log('[login] company query result:', company)

  if (!company) {
    console.error('[login] company not found. DB error:', companyError?.message)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
  }

  console.log('[login] matched company_id:', company.id)

  // 2. Resolve profile by username within that company
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('company_id', company.id)
    .eq('username', username.trim().toLowerCase())
    .single()

  if (!profile) {
    console.error('[login] profile not found for username. DB error:', profileError?.message)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
  }

  console.log('[login] matched profile id:', profile.id)

  // 3. Get the auth user's email via admin API
  const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
  const email = authUser?.user?.email

  if (!email) {
    console.error('[login] could not resolve email for user id:', profile.id)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
  }

  console.log('[login] resolved internal email:', email)

  // 4. Sign in with email+password using a cookie-aware client
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    console.error('[login] auth signIn error:', signInError.message)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}
