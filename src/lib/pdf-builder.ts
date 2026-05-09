/**
 * Server-side PDF building utilities shared by teklif and üretim rehberi routes.
 * Do NOT import this from client components — it uses Node.js APIs (Buffer, puppeteer).
 */
import { doorTypeLabel, itemMeasurement, buildItemSpecParts, type OrderItem } from './order-item'

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmt(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 0,
  }).format(n)
}

export function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Image utilities (server-side) ────────────────────────────────────────────

async function fetchDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type') || 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchLogoBase64(supabase: any, companyId: string): Promise<string> {
  const { data: row } = await supabase
    .from('companies')
    .select('logo_url')
    .eq('id', companyId)
    .single()
  if (!row?.logo_url) return ''

  const { data: signed } = await supabase.storage
    .from('company-logos')
    .createSignedUrl(row.logo_url, 3600)
  if (!signed?.signedUrl) return ''

  return (await fetchDataUri(signed.signedUrl)) ?? ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchItemImagesBase64(supabase: any, items: Pick<OrderItem, 'image_path'>[]): Promise<(string | null)[]> {
  return Promise.all(
    items.map(async (it) => {
      if (!it.image_path) return null
      try {
        const { data: sd } = await supabase.storage
          .from('order-images')
          .createSignedUrl(it.image_path, 3600)
        if (!sd?.signedUrl) return null
        return fetchDataUri(sd.signedUrl)
      } catch {
        return null
      }
    }),
  )
}

// ── Shared CSS ───────────────────────────────────────────────────────────────

const PDF_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; width: 210mm; }

  .header { background: #1e3a5f; color: #fff; padding: 22px 30px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand   { font-size: 19px; font-weight: 700; letter-spacing: 0.5px; }
  .tagline { font-size: 9px; color: #93b4d0; margin-top: 3px; text-transform: uppercase; letter-spacing: 1.2px; }
  .doc-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; text-align: right; }
  .doc-ref   { font-size: 10px; color: #93b4d0; margin-top: 4px; text-align: right; }
  .logo { height: 55px; max-width: 180px; object-fit: contain; }

  .content { padding: 22px 30px; }

  .customer-box { background: #f0f6ff; border: 1px solid #c3d9f5; border-radius: 7px; padding: 12px 16px; margin-bottom: 18px; }
  .customer-name { font-size: 15px; font-weight: 700; color: #1e3a5f; }
  .customer-meta { font-size: 10px; color: #4a6080; margin-top: 3px; }
  .deadline-tag { display: inline-block; background: #dbeafe; border: 1px solid #93c5fd; border-radius: 4px; padding: 2px 8px; font-size: 10px; color: #1d4ed8; font-weight: 600; margin-top: 6px; }

  .sec-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; }
  .main-row { display: block; margin-bottom: 20px; }

  .items-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .items-table thead tr { background: #f1f5f9; }
  .items-table th { padding: 7px 8px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #374151; }
  .items-table td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
  .items-table .r  { text-align: right; }
  .items-table .it-no    { color: #6b7280; width: 18px; font-size: 10px; }
  .items-table .it-type  { font-weight: 700; color: #111111; font-size: 11.5px; }
  .items-table .it-dim   { color: #222222; font-size: 11px; }
  .items-table .it-total { font-weight: 700; color: #111111; }
  .items-table .it-img   { width: 70px; padding: 4px 6px; vertical-align: middle; font-size: 18px; text-align: center; }
  .it-specs { font-size: 9.5px; font-weight: 400; color: #374151; margin-top: 4px; line-height: 1.5; }

  .pricing { width: 250px; margin-left: auto; margin-top: 20px; text-align: right; }
  .pr-row { font-size: 11px; color: #374151; margin-bottom: 4px; }
  .pr-row span { color: #1e3a5f; }
  .pr-total-row { font-size: 16px; font-weight: 700; color: #1e3a5f; margin-top: 8px; border-top: 2px solid #1e3a5f; padding-top: 6px; }

  .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; margin-top: 14px; font-size: 10px; color: #78350f; line-height: 1.6; }

  .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; }
`

// ── HTML builder ─────────────────────────────────────────────────────────────

export interface PdfBuildOptions {
  /** Document title shown in the header right block. */
  docTitle:    string
  /** Section title above the items table. */
  listTitle:   string
  /** Whether to render pricing columns and totals. */
  showPricing: boolean
  /** Pre-formatted customer name (caller decides truncation). */
  customerName: string
  /** Left side footer note. */
  footerNote:  string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildOrderPdfHtml(order: any, itemImagesBase64: (string | null)[], logoBase64: string, opts: PdfBuildOptions): string {
  const { docTitle, listTitle, showPricing, customerName, footerNote } = opts

  const shortId    = (order.id as string).slice(0, 8).toUpperCase()
  const dateStr    = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  const deadlineStr = fmtDate(order.deadline_date)

  const cari         = order.cariler ?? {}
  const customerCity = cari.city ?? order.customer_city ?? null
  const customerMeta = customerCity ?? ''

  const items: OrderItem[] = order.items || []

  // Pricing totals (only computed when needed)
  const kdvRate   = Number(order.kdv_rate ?? 20)
  const araToplam = showPricing
    ? items.reduce((sum, it) => sum + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0)
    : 0
  const kdv         = araToplam * kdvRate / 100
  const genelToplam = araToplam + kdv

  const tableHeaders = showPricing
    ? `<th>#</th><th>Görsel</th><th>Kapı Tipi</th><th>Ölçü (Tırnak)</th><th class="r">Adet</th><th class="r">Birim Fiyat</th><th class="r">Toplam</th>`
    : `<th>#</th><th>Görsel</th><th>Kapı Tipi</th><th>Ölçü (Tırnak)</th><th class="r">Sağ</th><th class="r">Sol</th><th class="r">Adet</th>`

  const itemsTableRows = items.map((it, i) => {
    const label   = doorTypeLabel(it.door_type)
    const dims    = itemMeasurement(it)
    const qty     = Number(it.quantity)   || 0
    const price   = Number(it.unit_price) || 0
    const sagAdet = Number(it.right_opening_count) || null
    const solAdet = Number(it.left_opening_count)  || null
    const imgSrc  = itemImagesBase64[i] ?? null
    const imgCell = imgSrc
      ? `<img src="${imgSrc}" style="width:80px;border-radius:6px;" />`
      : '🚪'

    const specHtml = buildItemSpecParts(it)
      .map(s => esc(s))
      .join(' &nbsp;·&nbsp; ')

    const lastCols = showPricing
      ? `<td class="r">${qty}</td><td class="r">${fmt(price)}</td><td class="r it-total">${fmt(qty * price)}</td>`
      : `<td class="r">${sagAdet ?? '-'}</td><td class="r">${solAdet ?? '-'}</td><td class="r it-total">${qty}</td>`

    return `<tr>
  <td class="it-no">${i + 1}</td>
  <td class="it-img">${imgCell}</td>
  <td class="it-type">${esc(label)}${specHtml ? `<div class="it-specs">${specHtml}</div>` : ''}</td>
  <td class="it-dim">${esc(dims)}</td>
  ${lastCols}
</tr>`
  }).join('\n')

  const pricingBlock = showPricing ? `
  <div class="pricing">
    <div class="pr-row">Ara Toplam: <span>${fmt(araToplam)}</span></div>
    <div class="pr-row">KDV (%${kdvRate}): <span>${fmt(kdv)}</span></div>
    <div class="pr-total-row">Genel Toplam: ${fmt(genelToplam)}</div>
  </div>` : ''

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<style>${PDF_CSS}</style>
</head>
<body>

<div class="header">
  <div>
    <div class="brand">Koyuncu Steel Door</div>
    <div class="tagline">Çelik Kapı — Üretim &amp; Satış</div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:20px;">
    ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Logo" />` : ''}
    <div>
      <div class="doc-label">${esc(docTitle)}</div>
      <div class="doc-ref">#${shortId} &nbsp;·&nbsp; ${dateStr}</div>
    </div>
  </div>
</div>

<div class="content">
  <div class="customer-box">
    <div class="customer-name">${esc(customerName)}</div>
    ${customerMeta ? `<div class="customer-meta">${esc(customerMeta)}</div>` : ''}
    ${deadlineStr  ? `<div class="deadline-tag">Termin: ${deadlineStr}</div>` : ''}
  </div>

  <div class="main-row">
    <div class="sec-title">${esc(listTitle)}</div>
    <table class="items-table">
      <thead><tr>${tableHeaders}</tr></thead>
      <tbody>
        ${itemsTableRows || `<tr><td colspan="7" style="color:#9ca3af;padding:8px;">Ürün girilmemiş</td></tr>`}
      </tbody>
    </table>
  </div>

  ${pricingBlock}

  ${order.notes ? `<div class="notes-box"><strong>Not:</strong> ${esc(order.notes)}</div>` : ''}

  <div class="footer">
    <span>${esc(footerNote)}</span>
    <span>Sipariş Ref: ${shortId}</span>
  </div>
</div>
</body>
</html>`
}

// ── Puppeteer renderer ───────────────────────────────────────────────────────

export async function renderPdf(html: string): Promise<Buffer> {
  const { getBrowser } = await import('./server/chromium')
  const browser = await getBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const bytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(bytes)
  } finally {
    await browser.close()
  }
}
