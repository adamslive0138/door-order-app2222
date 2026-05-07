import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { createAdminClient } from '@/src/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { action } = await request.json() as { action: 'approve' | 'reject' }

  if (action !== 'approve' && action !== 'reject') {
    return new NextResponse('Invalid action', { status: 400 })
  }

  // Auth + admin check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch the approval record
  const { data: approval, error: fetchErr } = await admin
    .from('payment_approvals')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single()

  if (fetchErr || !approval) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (approval.status !== 'pending') {
    return new NextResponse('Already processed', { status: 409 })
  }

  if (action === 'reject') {
    const { error } = await admin
      .from('payment_approvals')
      .update({ status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return new NextResponse(error.message, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Approve: update status + insert cari_hareketler
  const { error: updateErr } = await admin
    .from('payment_approvals')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) return new NextResponse(updateErr.message, { status: 500 })

  const { error: insertErr } = await admin
    .from('cari_hareketler')
    .insert({
      company_id:       approval.company_id,
      owner_id:         approval.owner_id,
      cari_id:          approval.cari_id,
      transaction_type: 'tahsilat',
      amount:           approval.amount,
      payment_method:   approval.payment_method ?? null,
      description:      approval.description
        ? `[Tahsilat Onayı] ${approval.description}`
        : '[Tahsilat Onayı]',
      receipt_url:      approval.receipt_path ?? null,
      transaction_date: new Date().toISOString().slice(0, 10),
    })

  if (insertErr) return new NextResponse(insertErr.message, { status: 500 })

  return NextResponse.json({ ok: true })
}
