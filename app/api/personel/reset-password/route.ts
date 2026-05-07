import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { createAdminClient } from '@/src/lib/supabase/admin'

export async function POST(req: Request) {
  // 1. Verify caller is admin
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

  // 2. Parse body
  let body: { userId?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { userId, password } = body

  if (!userId) return NextResponse.json({ error: 'userId zorunludur.' }, { status: 400 })
  if (!password || password.length < 6)
    return NextResponse.json({ error: 'Şifre en az 6 karakter olmalıdır.' }, { status: 400 })

  const admin = createAdminClient()

  // 3. Confirm target user belongs to same company
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle()

  if (!targetProfile || targetProfile.company_id !== callerProfile.company_id) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 })
  }

  // 4. Update password via service role
  const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password })

  if (pwError) {
    console.error('[reset-password] updateUserById failed:', pwError)
    return NextResponse.json({ error: 'Şifre güncellenemedi: ' + pwError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
