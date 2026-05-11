import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import {
  fetchCompanySettingsForPdf,
  fetchItemImagesBase64,
  buildOrderPdf,
} from '@/src/lib/pdf-builder'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, cariler (id, name, phone, city)')
    .eq('id', id)
    .single()

  if (error || !order) return new NextResponse('Sipariş bulunamadı', { status: 404 })

  const cari         = order.cariler ?? {}
  const customerName = cari.name ?? order.customer_name ?? '—'

  const [{ settings, logoBase64 }, itemImagesBase64] = await Promise.all([
    fetchCompanySettingsForPdf(supabase, order.company_id),
    fetchItemImagesBase64(supabase, order.items ?? []),
  ])

  const footerNote = settings.footer_note
    ?? `Bu teklif bilgilendirme amaçlıdır. KDV (%${order.kdv_rate ?? 20}) dahildir.`

  const pdf = await buildOrderPdf(order, itemImagesBase64, logoBase64, {
    docTitle:    'Teklif',
    listTitle:   'Ürün Listesi',
    showPricing: true,
    customerName,
    footerNote,
  }, settings)
  const body = new Uint8Array(pdf)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="teklif-${id.slice(0, 8)}.pdf"`,
    },
  })
}
