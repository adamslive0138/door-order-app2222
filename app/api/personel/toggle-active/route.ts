import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { createAdminClient } from '@/src/lib/supabase/admin'

export async function POST(req: Request) {
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

  let body: { userId?: string; active?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { userId, active } = body
  if (!userId) return NextResponse.json({ error: 'userId zorunludur.' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: 'Kendi hesabınızı pasif yapamazsınız.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('company_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!targetProfile || targetProfile.company_id !== callerProfile.company_id) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 })
  }

  if (targetProfile.role === 'admin') {
    return NextResponse.json({ error: 'Admin kullanıcı pasif yapılamaz.' }, { status: 403 })
  }

  // ban_duration 'none' = active, '876600h' ≈ 100 years = effectively disabled
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : '876600h',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
