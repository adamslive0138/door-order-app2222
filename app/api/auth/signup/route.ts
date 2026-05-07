import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/src/lib/supabase/admin'

export async function POST(req: Request) {
  // ── Parse and validate body ──────────────────────────────────────────────
  let body: { email?: string; password?: string; company_name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { email, password, company_name } = body

  if (!email?.trim())        return NextResponse.json({ error: 'E-posta zorunludur.' }, { status: 400 })
  if (!password)             return NextResponse.json({ error: 'Şifre zorunludur.' }, { status: 400 })
  if (!company_name?.trim()) return NextResponse.json({ error: 'Şirket adı zorunludur.' }, { status: 400 })
  if (password.length < 6)   return NextResponse.json({ error: 'Şifre en az 6 karakter olmalıdır.' }, { status: 400 })

  const cookieStore = await cookies()

  // ── 1. Sign up (anon key, cookie-aware so the session is persisted) ───────
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

  // Derive the app origin from the incoming request URL so the callback
  // URL is always correct regardless of environment (local / staging / prod).
  const origin = new URL(req.url).origin

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const userId = authData.user?.id
  if (!userId) {
    // Supabase returned no user — email likely already registered
    return NextResponse.json(
      { error: 'Bu e-posta adresi zaten kayıtlı.' },
      { status: 400 }
    )
  }

  // ── 2. Create company + profile with service role (bypasses RLS) ──────────
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e: any) {
    // Env var missing — delete the orphan auth user and report
    return NextResponse.json(
      { error: 'Sunucu yapılandırma hatası. Lütfen yönetici ile iletişime geçin.' },
      { status: 500 }
    )
  }

  // Insert company — email is intentionally omitted here: the user's auth
  // email lives in auth.users; companies.email is an optional contact field
  // that can be filled later via Settings. Including it here breaks signup
  // when the email column hasn't been added yet (v11 migration).
  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: company_name.trim() })
    .select('id')
    .single()

  if (companyError || !company) {
    console.error('[signup] companies insert failed:', companyError?.message)
    // Rollback: delete auth user
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json(
      { error: 'Şirket oluşturulamadı: ' + (companyError?.message ?? 'bilinmeyen hata') },
      { status: 500 }
    )
  }

  // Insert profile linking user ↔ company
  // profiles.id is a FK to auth.users.id — NOT a separate user_id column
  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: userId, company_id: company.id })

  if (profileError) {
    console.error('[signup] profiles insert failed:', profileError.message)
    // Rollback: delete company then auth user
    await admin.from('companies').delete().eq('id', company.id)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json(
      { error: 'Profil oluşturulamadı: ' + profileError.message },
      { status: 500 }
    )
  }

  // ── 3. Return whether the user has an active session ─────────────────────
  // If Supabase email confirmation is disabled, authData.session is non-null
  // and the user can go straight to the dashboard.
  return NextResponse.json({ hasSession: !!authData.session })
}
