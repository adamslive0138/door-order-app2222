import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: offerId } = await params
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll:  (list) => list.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  )

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id
  if (!companyId) return NextResponse.json({ error: 'Şirket bulunamadı.' }, { status: 403 })

  // ── Fetch offer ─────────────────────────────────────────────────────────────
  const { data: offer } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('company_id', companyId)
    .single()

  if (!offer) return NextResponse.json({ error: 'Teklif bulunamadı.' }, { status: 404 })

  if (offer.status !== 'kabul_edildi') {
    return NextResponse.json(
      { error: 'Yalnızca onaylanmış teklifler siparişe dönüştürülebilir.' },
      { status: 400 }
    )
  }

  if (offer.order_id) {
    // Already converted — return existing order id so the caller can redirect
    return NextResponse.json({ orderId: offer.order_id, alreadyConverted: true })
  }

  // ── Create order from offer ─────────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      company_id:     companyId,
      cari_id:        offer.cari_id    ?? null,
      customer_name:  offer.customer_name,
      customer_phone: offer.customer_phone ?? '',
      customer_city:  offer.customer_city  ?? '',
      door_type:      offer.door_type  ?? 'celik_kapi',
      dimensions:     offer.dimensions ?? '',
      quantity:       offer.quantity,
      unit_price:     offer.unit_price,
      total_price:    offer.total_price,
      notes:          offer.notes      ?? null,
      image_url:      offer.image_url  ?? null,
      status:         'siparis_alindi',
      is_archived:    false,
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    return NextResponse.json(
      { error: 'Sipariş oluşturulamadı: ' + (orderErr?.message ?? 'bilinmeyen hata') },
      { status: 500 }
    )
  }

  // ── Link offer → order ──────────────────────────────────────────────────────
  await supabase
    .from('offers')
    .update({ order_id: order.id })
    .eq('id', offerId)

  return NextResponse.json({ orderId: order.id })
}
