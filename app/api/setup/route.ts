import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/src/lib/supabase/admin'

export async function POST(req: Request) {
  let body: {
    company_name?: string
    company_code?: string
    full_name?: string
    username?: string
    password?: string
  }
  try {
    body = await req.json()
  } catch (e) {
    console.error('[setup] request parse failed:', e)
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { company_name, company_code, full_name, username, password } = body

  if (!company_name?.trim())
    return NextResponse.json({ error: 'Şirket adı zorunludur.' }, { status: 400 })
  if (!company_code?.trim())
    return NextResponse.json({ error: 'Şirket kodu zorunludur.' }, { status: 400 })
  if (!full_name?.trim())
    return NextResponse.json({ error: 'Ad Soyad zorunludur.' }, { status: 400 })
  if (!username?.trim())
    return NextResponse.json({ error: 'Kullanıcı adı zorunludur.' }, { status: 400 })
  if (!password || password.length < 6)
    return NextResponse.json({ error: 'Şifre en az 6 karakter olmalıdır.' }, { status: 400 })

  const normalizedCode     = company_code.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const normalizedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')

  if (!normalizedCode)
    return NextResponse.json({ error: 'Geçersiz şirket kodu.' }, { status: 400 })
  if (!normalizedUsername)
    return NextResponse.json({ error: 'Geçersiz kullanıcı adı.' }, { status: 400 })

  const admin = createAdminClient()

  // ── 1. Check if company with this code already has an admin ──────────────
  const { data: existingCompany } = await admin
    .from('companies')
    .select('id')
    .eq('code', normalizedCode)
    .maybeSingle()

  if (existingCompany) {
    const { data: existingAdmin } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', existingCompany.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Bu şirket kodu için kurulum zaten tamamlanmış. Lütfen giriş yapın.' },
        { status: 409 }
      )
    }
  }

  // ── 2. Create or reuse company ────────────────────────────────────────────
  let companyId: string

  if (existingCompany) {
    companyId = existingCompany.id
  } else {
    const { data: newCompany, error: companyError } = await admin
      .from('companies')
      .insert({ name: company_name.trim(), code: normalizedCode })
      .select('id')
      .single()

    if (companyError || !newCompany) {
      console.error('[setup] company insert failed:', companyError)
      const msg = companyError?.message ?? ''
      if (msg.includes('companies_code_unique') || msg.includes('unique')) {
        return NextResponse.json(
          { error: 'Bu şirket kodu zaten alınmış. Farklı bir kod deneyin.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Şirket oluşturulamadı.' }, { status: 500 })
    }

    companyId = newCompany.id
  }

  // ── 3. Check username uniqueness in company ───────────────────────────────
  const { data: existingUser } = await admin
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('username', normalizedUsername)
    .maybeSingle()

  if (existingUser) {
    return NextResponse.json(
      { error: 'Bu kullanıcı adı zaten kullanılıyor.' },
      { status: 409 }
    )
  }

  // ── 4. Build internal email ────────────────────────────────────────────────
  const email = `${normalizedUsername}.${normalizedCode}@doorops.local`

  // ── 5. Create auth user ───────────────────────────────────────────────────
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error('[setup] auth user creation failed:', authError)
    return NextResponse.json(
      { error: authError?.message ?? 'Kullanıcı oluşturulamadı.' },
      { status: 500 }
    )
  }

  const newUserId = authData.user.id

  // ── 6. Insert admin profile ───────────────────────────────────────────────
  const { error: profileError } = await admin.from('profiles').insert({
    id: newUserId,
    company_id: companyId,
    full_name: full_name.trim(),
    username: normalizedUsername,
    role: 'admin',
  })

  if (profileError) {
    console.error('[setup] profile insert failed:', profileError)
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json(
      { error: 'Profil oluşturulamadı: ' + profileError.message },
      { status: 500 }
    )
  }

  // ── 7. Sign in the new admin immediately ──────────────────────────────────
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

  await supabase.auth.signInWithPassword({ email, password })

  return NextResponse.json({ success: true })
}
