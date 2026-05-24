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

  let body: { confirm?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  if (body.confirm !== 'SİL') {
    return NextResponse.json({ error: 'Onay metni hatalı.' }, { status: 400 })
  }

  const companyId = callerProfile.company_id
  const admin = createAdminClient()

  // 1. Collect all user IDs before deleting profiles
  const { data: companyProfiles } = await admin
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)

  const userIds = (companyProfiles ?? []).map((p: { id: string }) => p.id)

  // 2. Delete storage files (receipts — stored under company_id/ prefix)
  try {
    const { data: receiptFiles } = await admin.storage.from('receipts').list(companyId, { limit: 1000 })
    if (receiptFiles?.length) {
      await admin.storage.from('receipts').remove(receiptFiles.map((f: { name: string }) => `${companyId}/${f.name}`))
    }
  } catch { /* non-fatal — continue with data deletion */ }

  try {
    const { data: docFiles } = await admin.storage.from('documents').list(companyId, { limit: 1000 })
    if (docFiles?.length) {
      await admin.storage.from('documents').remove(docFiles.map((f: { name: string }) => `${companyId}/${f.name}`))
    }
  } catch { /* non-fatal */ }

  // 3. Delete application data — order matters for FK integrity
  // cari_hareketler depends on cariler and companies
  await admin.from('cari_hareketler').delete().eq('company_id', companyId)
  // payment_approvals depends on cariler
  await admin.from('payment_approvals').delete().eq('company_id', companyId)
  // checks depends on cariler
  await admin.from('checks').delete().eq('company_id', companyId)
  // orders
  await admin.from('orders').delete().eq('company_id', companyId)
  // offers
  await admin.from('offers').delete().eq('company_id', companyId)
  // documents
  await admin.from('documents').delete().eq('company_id', companyId)
  // stock_models
  await admin.from('stock_models').delete().eq('company_id', companyId)
  // cariler
  await admin.from('cariler').delete().eq('company_id', companyId)
  // profiles (by company_id — auth cascade will also clean up if FK exists)
  await admin.from('profiles').delete().eq('company_id', companyId)
  // company record
  await admin.from('companies').delete().eq('id', companyId)

  // 4. Delete all auth users for this company
  for (const userId of userIds) {
    try {
      await admin.auth.admin.deleteUser(userId)
    } catch { /* non-fatal — profile already deleted */ }
  }

  return NextResponse.json({ success: true })
}
