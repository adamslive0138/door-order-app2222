import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import {
  fetchCompanySettingsForPdf,
  fetchBulkItemImagesBase64,
  buildBulkOrderPdf,
} from '@/src/lib/pdf-builder'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  if (!profile?.company_id) return new NextResponse('Unauthorized', { status: 401 })

  let body: { ids?: string[] }
  try { body = await req.json() } catch {
    return new NextResponse('Invalid request', { status: 400 })
  }

  const ids = (body.ids ?? []).slice(0, 50) // hard cap at 50 orders
  if (!ids.length) return new NextResponse('No orders selected', { status: 400 })

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, cariler(id, name, phone, city)')
    .in('id', ids)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  if (error || !orders?.length) return new NextResponse('Orders not found', { status: 404 })

  // Batch-fetch company settings + all images in parallel
  const [{ settings, logoBase64 }, allImages] = await Promise.all([
    fetchCompanySettingsForPdf(supabase, profile.company_id),
    fetchBulkItemImagesBase64(supabase, orders.map((o) => ({ items: o.items ?? [] }))),
  ])

  const footerNote = settings.footer_note ?? 'Bu teklif geçerlilik süresi 30 gündür.'

  const entries = orders.map((order, i) => {
    const cari = order.cariler ?? {}
    const fullName = (cari.name ?? order.customer_name ?? '—') as string
    // Full name for customer-facing offer PDF
    return { order, itemImagesBase64: allImages[i] ?? [], customerName: fullName }
  })

  const pdf = await buildBulkOrderPdf(entries, logoBase64, {
    docTitle:    'Fiyat Teklifi',
    listTitle:   'Ürün Listesi',
    showPricing: true,
    footerNote,
  }, settings)

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="teklifler-${date}.pdf"`,
    },
  })
}
