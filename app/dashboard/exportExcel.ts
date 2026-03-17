import type { Order } from '@/src/types'

function toInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w[0]?.toUpperCase() ?? '') + '.')
    .join('')
}

function formatLocalDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('tr-TR')
}

async function fetchBase64(
  url: string,
): Promise<{ base64: string; extension: 'jpeg' | 'png' } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const extension: 'jpeg' | 'png' = blob.type.includes('png') ? 'png' : 'jpeg'
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        if (base64) resolve({ base64, extension })
        else reject(new Error('empty base64'))
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function exportOrdersToExcel(orders: Order[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Kapı Sipariş Takip'
  wb.created = new Date()

  const ws = wb.addWorksheet('Siparişler', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { defaultRowHeight: 20 },
  })

  // ── Column layout ────────────────────────────────────────────────────────
  // A  Müşteri baş harfleri
  // B  Adet
  // C  Termin Tarihi
  // D  Kapının Özellikleri (multi-line)
  // E  Özellikler / Detay
  // F  Görsel (image)
  ws.columns = [
    { key: 'customer',  width: 9  },
    { key: 'qty',       width: 6  },
    { key: 'deadline',  width: 13 },
    { key: 'features',  width: 30 },
    { key: 'notes',     width: 26 },
    { key: 'image',     width: 26 },
  ]

  // ── Header row ───────────────────────────────────────────────────────────
  const HEADERS = [
    'Müşteri',
    'Adet',
    'Termin Tarihi',
    'Kapının Özellikleri',
    'Özellikler / Detay',
    'Görsel',
  ]
  const headerRow = ws.addRow(HEADERS)
  headerRow.height = 24
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF1E40AF' } } }
  })

  // ── Fetch all images up front (parallel) ─────────────────────────────────
  const imageData = await Promise.all(
    orders.map((o) => (o.image_url ? fetchBase64(o.image_url) : Promise.resolve(null))),
  )

  // ── Data rows ────────────────────────────────────────────────────────────
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i]
    // 0-indexed row in the worksheet (header = row 0)
    const wsRowIdx = i + 1

    const mdf =
      o.mdf_thickness === 'Diğer'
        ? (o.mdf_thickness_other ?? '')
        : (o.mdf_thickness ?? '')

    const featureLines = [
      o.dimensions     ? `Ölçü: ${o.dimensions}`              : null,
      o.lock_brand     ? `Kilit Markası: ${o.lock_brand}`      : null,
      o.lock_system    ? `Kilit Sistemi: ${o.lock_system}`     : null,
      o.frame_color    ? `Kasa Rengi: ${o.frame_color}`        : null,
      mdf              ? `MDF Kalınlığı: ${mdf}`               : null,
      o.steel_thickness? `Sac Kalınlığı: ${o.steel_thickness}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    // Row height: tall enough for all feature lines AND the image.
    // Each line at 9pt font needs ~14pt; image needs at least 95pt.
    const featureLineCount = featureLines ? featureLines.split('\n').length : 0
    const rowHeight = Math.max(95, featureLineCount * 14 + 16)

    const row = ws.addRow({
      customer: toInitials(o.customer_name),
      qty:      o.quantity,
      deadline: formatLocalDate(o.deadline_date),
      features: featureLines,
      notes:    o.notes ?? '',
      image:    '',
    })

    row.height = rowHeight

    const bgColor = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFF'

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
      }

      if (colNumber === 1) {
        // Müşteri initials — bold, centered
        cell.font = { size: 11, bold: true }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (colNumber === 2) {
        // Adet — centered
        cell.font = { size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (colNumber === 3) {
        // Termin Tarihi — centered
        cell.font = { size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (colNumber === 4) {
        // Kapının Özellikleri — multi-line, top-aligned, wrap
        cell.font = { size: 9 }
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
      } else if (colNumber === 5) {
        // Özellikler / Detay — italic, top-aligned, wrap
        cell.font = { size: 9, italic: true }
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
      } else {
        // Image cell — no text styling needed
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
    })

    // ── Embed image ─────────────────────────────────────────────────────────
    // Column F = 6th column; Excel row is wsRowIdx+1 (1-indexed)
    const img = imageData[i]
    if (img) {
      const imgId = wb.addImage({ base64: img.base64, extension: img.extension })
      ws.addImage(imgId, `F${wsRowIdx + 1}:F${wsRowIdx + 2}`)
    }
  }

  // ── Freeze header row ─────────────────────────────────────────────────────
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }]

  // ── Write & download ──────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `siparisler_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
