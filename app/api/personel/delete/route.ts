import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { createAdminClient } from '@/src/lib/supabase/admin'

export async function DELETE(req: Request) {
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

  let body: { userId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { userId } = body
  if (!userId) return NextResponse.json({ error: 'userId zorunludur.' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: 'Kendi hesabınızı silemezsiniz.' }, { status: 400 })

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
    return NextResponse.json({ error: 'Admin kullanıcı silinemez.' }, { status: 403 })
  }

  // Nullify owner_id references to preserve records
  await Promise.all([
    admin.from('orders').update({ owner_id: null }).eq('owner_id', userId),
    admin.from('cariler').update({ owner_id: null }).eq('owner_id', userId),
  ])

  // Delete auth user — cascades to profiles row
  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) return NextResponse.json({ error: 'Kullanıcı silinemedi: ' + authError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
