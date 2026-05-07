import { createClient } from '@/src/lib/supabase/client'
import type { Order } from '@/src/types'
import { buildItemSpecsText, type OrderItem } from '@/src/lib/order-item'

// ── Helpers ───────────────────────────────────────────────────────────────────

function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  return `${parts[0][0]?.toUpperCase() ?? ''}. ${parts[parts.length - 1]}`
}

function formatLocalDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('tr-TR')
}

async function fetchBase64(url: string): Promise<{ base64: string; extension: 'jpeg' | 'png' } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const extension: 'jpeg' | 'png' = blob.type.includes('png') ? 'png' : 'jpeg'
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1]
        b64 ? resolve({ base64: b64, extension }) : reject(new Error('empty'))
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}


// ── Main export ───────────────────────────────────────────────────────────────

export async function exportOrdersToExcel(
  orders: Order[],
  ownerNames: Record<string, string> = {},
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const supabase = createClient()

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Kapı Sipariş Takip'
  wb.created = new Date()

  const ws = wb.addWorksheet('Siparişler', {
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })

  // A  Müşteri | B  Adet | C  Termin | D  Kapı Özellikleri | E  Not | F  Görsel
  ws.columns = [
    { key: 'musteri',    width: 11 },
    { key: 'adet',       width: 6  },
    { key: 'termin',     width: 12 },
    { key: 'ozellikler', width: 34 },
    { key: 'not',        width: 26 },
    { key: 'gorsel',     width: 20 },
  ]

  // ── Header ───────────────────────────────────────────────────────────────────
  const headerRow = ws.addRow(['Müşteri', 'Adet', 'Termin', 'Kapı Özellikleri', 'Not', 'Görsel'])
  headerRow.height = 26
  headerRow.eachCell((cell) => {
    cell.font      = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF1E40AF' } } }
  })

  // ── Collect & pre-fetch all images in parallel ────────────────────────────────
  type ImgTask = { key: string; imagePath?: string; imageUrl?: string }
  const tasks: ImgTask[] = []

  for (const order of orders) {
    const items: OrderItem[] = order.items ?? []
    if (items.length > 0) {
      items.forEach((it, j) => {
        if (it.image_path) tasks.push({ key: `${order.id}:${j}`, imagePath: it.image_path })
      })
    } else if (order.image_url) {
      tasks.push({ key: `${order.id}:-1`, imageUrl: order.image_url })
    }
  }

  // Resolve storage paths → signed URLs
  const resolvedUrls: Record<string, string> = {}
  await Promise.all(
    tasks.map(async (t) => {
      if (t.imagePath) {
        const { data } = await supabase.storage
          .from('order-images')
          .createSignedUrl(t.imagePath, 3600)
        if (data?.signedUrl) resolvedUrls[t.key] = data.signedUrl
      } else if (t.imageUrl) {
        resolvedUrls[t.key] = t.imageUrl
      }
    }),
  )

  // Fetch all as base64
  const imgCache: Record<string, { base64: string; extension: 'jpeg' | 'png' } | null> = {}
  await Promise.all(
    Object.entries(resolvedUrls).map(async ([key, url]) => {
      imgCache[key] = await fetchBase64(url)
    }),
  )

  // ── Data rows ─────────────────────────────────────────────────────────────────
  let dataRowCount = 0     // alternating colour counter
  let wsRow0Idx = 1        // 0-indexed ExcelJS anchor for addImage (row 0 = header)

  for (const order of orders) {
    const items: OrderItem[] = order.items ?? []
    const rowGroups = items.length > 0
      ? items.map((item, idx) => ({ item, itemIdx: idx }))
      : [{ item: null as OrderItem | null, itemIdx: -1 }]

    for (const { item, itemIdx } of rowGroups) {
      const mdfFallback = order.mdf_thickness === 'Diğer'
        ? (order.mdf_thickness_other ?? '')
        : (order.mdf_thickness ?? '')

      // Normalize to OrderItem shape — falls back to order-level fields for legacy records
      const normalized: OrderItem = item ? (item as OrderItem) : {
        door_type:           order.door_type,
        measurement:         order.dimensions ?? null,
        width:               null,
        height:              null,
        right_opening_count: null,
        left_opening_count:  null,
        quantity:            order.quantity,
        unit_price:          order.unit_price,
        lock_brand:          order.lock_brand ?? null,
        lock_system:         order.lock_system ?? null,
        frame_color:         order.frame_color ?? null,
        mdf_thickness:       mdfFallback || null,
        sac_kalinligi:       order.steel_thickness ?? null,
        kanat_kalinligi:     null,
        image_path:          null,
        stock_model_id:      null,
      }

      const toplam_adet  = Number(normalized.quantity)   || 0
      const featureLines = buildItemSpecsText(normalized)

      const lineCount = featureLines.split('\n').length
      const imgKey    = `${order.id}:${itemIdx}`
      const imgData    = imgCache[imgKey] ?? null
      const rowHeight  = Math.max(imgData ? 95 : 30, lineCount * 13 + 8)
      const bgColor    = dataRowCount % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFF'
      dataRowCount++

      const dataRow = ws.addRow({
        musteri:    abbreviateName(order.customer_name),
        adet:       toplam_adet,
        termin:     formatLocalDate(order.deadline_date),
        ozellikler: featureLines,
        not:        order.notes ?? '',
        gorsel:     '',
      })
      dataRow.height = rowHeight

      dataRow.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        cell.border = {
          top:    { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
        }
        switch (col) {
          case 1: // Müşteri
            cell.font      = { size: 10, bold: true }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
            break
          case 2: // Adet
            cell.font      = { size: 10 }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
            break
          case 3: // Termin
            cell.font      = { size: 10 }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
            break
          case 4: // Kapı Özellikleri
            cell.font      = { size: 9 }
            cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
            break
          case 5: // Not
            cell.font      = { size: 9, italic: true }
            cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
            break
          default: // Görsel
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
        }
      })

      // ── Embed image ─────────────────────────────────────────────────────────
      if (imgData) {
        const imgId = wb.addImage({ base64: imgData.base64, extension: imgData.extension })
        ws.addImage(imgId, {
          tl:     { col: 5, row: wsRow0Idx },
          ext:    { width: 110, height: Math.max(90, rowHeight) },
          editAs: 'oneCell',
        })
      }

      wsRow0Idx++
    }
  }

  // ── Freeze header ──────────────────────────────────────────────────────────
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }]

  // ── Write & download ───────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = `siparisler_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
