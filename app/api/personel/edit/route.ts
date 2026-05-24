import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { createAdminClient } from '@/src/lib/supabase/admin'

export async function PATCH(req: Request) {
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

  let body: { userId?: string; full_name?: string; username?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { userId, full_name, username } = body
  if (!userId) return NextResponse.json({ error: 'userId zorunludur.' }, { status: 400 })
  if (!full_name?.trim()) return NextResponse.json({ error: 'Ad Soyad zorunludur.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('company_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!targetProfile || targetProfile.company_id !== callerProfile.company_id) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 })
  }

  if (targetProfile.role === 'admin' && userId !== user.id) {
    return NextResponse.json({ error: 'Başka bir admin kullanıcı düzenlenemez.' }, { status: 403 })
  }

  const updates: Record<string, string> = { full_name: full_name.trim() }

  if (username?.trim()) {
    const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!normalized) return NextResponse.json({ error: 'Geçersiz kullanıcı adı.' }, { status: 400 })

    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', callerProfile.company_id)
      .eq('username', normalized)
      .neq('id', userId)
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' }, { status: 409 })
    updates.username = normalized
  }

  const { error: updateError } = await admin.from('profiles').update(updates).eq('id', userId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
