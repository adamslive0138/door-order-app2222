import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import ExcelJS from 'exceljs'
import { DOOR_TYPE_LABELS } from '@/src/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  if (!profile?.company_id) return new NextResponse('Unauthorized', { status: 401 })

  const { data: offer } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single()

  if (!offer) return new NextResponse('Not found', { status: 404 })

  // ── Build workbook ──────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'İŞBAŞI'
  wb.created = new Date()

  const ws = wb.addWorksheet('Teklif')

  // Title
  ws.mergeCells('A1:F1')
  const titleCell = ws.getCell('A1')
  titleCell.value = 'TEKLİF'
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  // Customer info
  ws.getCell('A3').value = 'Müşteri'
  ws.getCell('A3').font = { bold: true, color: { argb: 'FF6B7280' } }
  ws.getCell('B3').value = offer.customer_name

  if (offer.customer_city) {
    ws.getCell('A4').value = 'Şehir'
    ws.getCell('A4').font = { bold: true, color: { argb: 'FF6B7280' } }
    ws.getCell('B4').value = offer.customer_city
  }

  if (offer.customer_phone) {
    ws.getCell('A5').value = 'Telefon'
    ws.getCell('A5').font = { bold: true, color: { argb: 'FF6B7280' } }
    ws.getCell('B5').value = offer.customer_phone
  }

  ws.getCell('D3').value = 'Tarih'
  ws.getCell('D3').font = { bold: true, color: { argb: 'FF6B7280' } }
  ws.getCell('E3').value = new Date(offer.created_at).toLocaleDateString('tr-TR')

  // Table header
  const headerRow = ws.addRow(['', '', '', '', '', ''])
  ws.addRow([])
  const tableHeaderRow = ws.addRow(['#', 'Ürün', 'Ölçüler', 'Adet', 'Birim Fiyat', 'Toplam'])
  tableHeaderRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
    cell.alignment = { horizontal: 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
    }
  })

  // Product row
  const productLabel = offer.door_type
    ? (DOOR_TYPE_LABELS as Record<string, string>)[offer.door_type] ?? offer.door_type
    : '—'

  const row = ws.addRow([
    1,
    productLabel,
    offer.dimensions ?? '—',
    offer.quantity,
    offer.unit_price,
    offer.total_price,
  ])
  row.getCell(5).numFmt = '#,##0.00 ₺'
  row.getCell(6).numFmt = '#,##0.00 ₺'
  row.getCell(6).font = { bold: true }

  // Total row
  ws.addRow([])
  const totalRow = ws.addRow(['', '', '', '', 'Genel Toplam', offer.total_price])
  totalRow.getCell(5).font = { bold: true }
  totalRow.getCell(6).font = { bold: true }
  totalRow.getCell(6).numFmt = '#,##0.00 ₺'
  totalRow.getCell(5).alignment = { horizontal: 'right' }

  // Notes
  if (offer.notes || offer.offer_text) {
    ws.addRow([])
    if (offer.offer_text) {
      ws.addRow(['Teklif Metni:', offer.offer_text])
      ws.lastRow!.getCell(1).font = { bold: true }
    }
    if (offer.notes) {
      ws.addRow(['Notlar:', offer.notes])
      ws.lastRow!.getCell(1).font = { bold: true }
    }
  }

  // Column widths
  ws.getColumn(1).width = 5
  ws.getColumn(2).width = 25
  ws.getColumn(3).width = 15
  ws.getColumn(4).width = 8
  ws.getColumn(5).width = 18
  ws.getColumn(6).width = 18

  // ── Serialize ───────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()

  const safeName = offer.customer_name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '').trim()
  const filename = `Teklif_${safeName}_${new Date(offer.created_at).toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
