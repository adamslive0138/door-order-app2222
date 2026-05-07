import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { createAdminClient } from '@/src/lib/supabase/admin'

export async function POST(req: Request) {
  // 1. Verify caller is admin via cookie-aware client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 })
  }

  const companyId = callerProfile.company_id

  // 2. Parse body
  let body: { full_name?: string; username?: string; password?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { full_name, username, password, role } = body

  if (!full_name?.trim())
    return NextResponse.json({ error: 'Ad Soyad zorunludur.' }, { status: 400 })
  if (!username?.trim())
    return NextResponse.json({ error: 'Kullanıcı adı zorunludur.' }, { status: 400 })
  if (!password || password.length < 6)
    return NextResponse.json({ error: 'Şifre en az 6 karakter olmalıdır.' }, { status: 400 })
  if (!role || !['admin', 'satis'].includes(role))
    return NextResponse.json({ error: 'Geçersiz rol.' }, { status: 400 })

  const normalizedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (!normalizedUsername)
    return NextResponse.json({ error: 'Geçersiz kullanıcı adı.' }, { status: 400 })

  const admin = createAdminClient()

  // 3. Get company code (needed for internal email)
  const { data: company } = await admin
    .from('companies')
    .select('code')
    .eq('id', companyId)
    .single()

  if (!company?.code) {
    return NextResponse.json(
      { error: 'Şirket kodu bulunamadı. Önce Şirket Ayarları\'ndan bir kod belirleyin.' },
      { status: 400 }
    )
  }

  // 4. Check username uniqueness within company
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('username', normalizedUsername)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' }, { status: 409 })
  }

  // 5. Build internal email — never shown to the user
  const normalizedCode = company.code.toLowerCase().replace(/[^a-z0-9]/g, '')
  const email = `${normalizedUsername}.${normalizedCode}@doorops.local`

  console.log('[personel] createUser payload email:', email)
  console.log('[personel] createUser password length:', password.length)

  // 6. Create Supabase auth user (email_confirm skips the verification email)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error('[personel] auth user creation failed:', authError)
    return NextResponse.json(
      { error: authError?.message ?? 'Kullanıcı oluşturulamadı.' },
      { status: 500 }
    )
  }

  const newUserId = authData.user.id
  console.log('[personel] createUser success id:', newUserId)

  // Explicitly set the password via updateUserById to guarantee it is hashed
  // and stored correctly — createUser with password can silently skip hashing
  // in some Supabase versions.
  const { error: pwError } = await admin.auth.admin.updateUserById(newUserId, { password })

  if (pwError) {
    console.error('[personel] password set/update failed:', pwError)
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json(
      { error: 'Kullanıcı şifresi ayarlanamadı.' },
      { status: 500 }
    )
  }

  console.log('[personel] password set/update success:', newUserId)

  // 7. Insert profile record
  const { error: profileError } = await admin.from('profiles').insert({
    id: newUserId,
    company_id: companyId,
    full_name: full_name.trim(),
    username: normalizedUsername,
    role,
  })

  if (profileError) {
    console.error('[personel] profile insert failed, rolling back auth user:', profileError)
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json(
      { error: 'Profil oluşturulamadı: ' + profileError.message },
      { status: 500 }
    )
  }

  console.log('[personel] profile insert ok for user:', newUserId)

  return NextResponse.json({ success: true })
}
