import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import {
  fetchLogoBase64,
  fetchItemImagesBase64,
  buildOrderPdfHtml,
  renderPdf,
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

  const cari     = order.cariler ?? {}
  const fullName = cari.name ?? order.customer_name ?? '—'
  // First name only — production staff should not see full customer identity
  const customerName = fullName.trim().split(/\s+/)[0] ?? fullName

  const [logoBase64, itemImagesBase64] = await Promise.all([
    fetchLogoBase64(supabase, order.company_id),
    fetchItemImagesBase64(supabase, order.items ?? []),
  ])

  const html = buildOrderPdfHtml(order, itemImagesBase64, logoBase64, {
    docTitle:     'Üretim Rehberi',
    listTitle:    'Üretim Listesi',
    showPricing:  false,
    customerName,
    footerNote:   'Bu belge üretim amaçlıdır. Fiyat bilgisi içermez.',
  })

  const pdf = await renderPdf(html)
  const body = new Uint8Array(pdf)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="uretim-${id.slice(0, 8)}.pdf"`,
    },
  })
}
