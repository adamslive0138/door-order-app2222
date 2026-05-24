/**
 * Server-side PDF building utilities shared by teklif and üretim rehberi routes.
 * Do NOT import this from client components — uses @react-pdf/renderer (Node.js only).
 */
import React from 'react'
import path from 'path'
import {
  Document, Page, View, Text, Image,
  StyleSheet, Font, renderToBuffer,
} from '@react-pdf/renderer'
import { doorTypeLabel, itemMeasurement, buildItemSpecParts, type OrderItem } from './order-item'

Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: path.join(process.cwd(), 'public/fonts/NotoSans-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(process.cwd(), 'public/fonts/NotoSans-Bold.ttf'),    fontWeight: 'bold'   },
  ],
})
Font.registerHyphenationCallback(word => [word])

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

export interface CompanyPdfSettings {
  company_name: string | null
  address:      string | null
  phone:        string | null
  footer_note:  string | null
  bank_info:    string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchCompanySettingsForPdf(supabase: any, companyId: string): Promise<{ settings: CompanyPdfSettings; logoBase64: string }> {
  const [{ data: cs }, { data: co }] = await Promise.all([
    supabase.from('company_settings').select('*').eq('company_id', companyId).maybeSingle(),
    supabase.from('companies').select('name, logo_url').eq('id', companyId).single(),
  ])

  const logoPath = cs?.logo_url || co?.logo_url
  let logoBase64 = ''
  if (logoPath) {
    const { data: signed } = await supabase.storage
      .from('company-logos')
      .createSignedUrl(logoPath, 3600)
    if (signed?.signedUrl) logoBase64 = (await fetchDataUri(signed.signedUrl)) ?? ''
  }

  return {
    settings: {
      company_name: cs?.company_name || co?.name || null,
      address:      cs?.address      || null,
      phone:        cs?.phone        || null,
      footer_note:  cs?.footer_note  || null,
      bank_info:    cs?.bank_info    || null,
    },
    logoBase64,
  }
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

/**
 * Batch-sign all image paths across multiple orders in ONE storage API call,
 * then fetch all data URIs in parallel. Returns a 2-D array [orderIdx][itemIdx].
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchBulkItemImagesBase64(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  allOrders: { items: Pick<OrderItem, 'image_path'>[] }[],
): Promise<(string | null)[][]> {
  type PathRef = { orderIdx: number; itemIdx: number; path: string }
  const pathRefs: PathRef[] = []

  for (let oi = 0; oi < allOrders.length; oi++) {
    const items = allOrders[oi].items ?? []
    for (let ii = 0; ii < items.length; ii++) {
      const p = items[ii].image_path
      if (p) pathRefs.push({ orderIdx: oi, itemIdx: ii, path: p })
    }
  }

  // Initialize result grid with nulls
  const result: (string | null)[][] = allOrders.map((o) => (o.items ?? []).map(() => null))

  if (pathRefs.length === 0) return result

  // Single batch sign call
  const { data: signed } = await supabase.storage
    .from('order-images')
    .createSignedUrls(pathRefs.map((r) => r.path), 3600)

  const signedUrls = (signed ?? []).map((s: { signedUrl: string | null }) => s.signedUrl ?? null)

  // Fetch all data URIs in parallel
  const dataUris = await Promise.all(
    signedUrls.map((url: string | null) => (url ? fetchDataUri(url) : Promise.resolve(null))),
  )

  // Map back to 2-D result grid
  pathRefs.forEach((ref, i) => {
    result[ref.orderIdx][ref.itemIdx] = dataUris[i]
  })

  return result
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfBuildOptions {
  docTitle:     string
  listTitle:    string
  showPricing:  boolean
  customerName: string
  footerNote:   string
}

export interface BulkOrderEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any
  itemImagesBase64: (string | null)[]
  customerName: string
}

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  headerBg:       '#1e3a5f',
  white:          '#ffffff',
  subtext:        '#93b4d0',
  customerBg:     '#f0f6ff',
  customerBorder: '#c3d9f5',
  nameTxt:        '#1e3a5f',
  metaTxt:        '#4a6080',
  deadlineBg:     '#dbeafe',
  deadlineBorder: '#93c5fd',
  deadlineTxt:    '#1d4ed8',
  secTxt:         '#6b7280',
  border:         '#e5e7eb',
  tableHead:      '#f1f5f9',
  headTxt:        '#374151',
  bodyTxt:        '#1a1a2e',
  specTxt:        '#374151',
  notesBg:        '#fffbeb',
  notesBorder:    '#fde68a',
  notesTxt:       '#78350f',
  footerTxt:      '#9ca3af',
} as const

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Noto Sans', fontSize: 11, color: C.bodyTxt, backgroundColor: '#ffffff' },

  // Header
  header:    { backgroundColor: C.headerBg, paddingHorizontal: 30, paddingVertical: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand:     { fontSize: 19, fontWeight: 700, color: C.white },
  tagline:   { fontSize: 9, color: C.subtext, marginTop: 3, letterSpacing: 1.2 },
  hdrRight:  { flexDirection: 'row', alignItems: 'flex-start' },
  logo:      { height: 55, maxWidth: 180, objectFit: 'contain', marginRight: 20 },
  docLabel:  { fontSize: 13, fontWeight: 700, color: C.white, textAlign: 'right', letterSpacing: 2 },
  docRef:    { fontSize: 10, color: C.subtext, marginTop: 4, textAlign: 'right' },

  // Content
  content: { paddingHorizontal: 30, paddingTop: 22, paddingBottom: 22 },

  // Customer box
  customerBox:   { backgroundColor: C.customerBg, borderWidth: 1, borderColor: C.customerBorder, borderRadius: 7, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 18 },
  customerName:  { fontSize: 15, fontWeight: 700, color: C.nameTxt },
  customerMeta:  { fontSize: 10, color: C.metaTxt, marginTop: 3 },
  deadlineTag:   { backgroundColor: C.deadlineBg, borderWidth: 1, borderColor: C.deadlineBorder, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6, alignSelf: 'flex-start' },
  deadlineTxt:   { fontSize: 10, color: C.deadlineTxt, fontWeight: 700 },

  // Section title
  secTitle: { fontSize: 9, fontWeight: 700, color: C.secTxt, letterSpacing: 1.5, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 5, marginBottom: 10 },

  // Table
  tblHead: { flexDirection: 'row', backgroundColor: C.tableHead },
  tblRow:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'center', minHeight: 40 },
  th:      { fontSize: 9.5, fontWeight: 700, color: C.headTxt, paddingHorizontal: 8, paddingVertical: 7, letterSpacing: 0.8 },
  td:      { paddingHorizontal: 8, paddingVertical: 7 },

  // Column widths — A4 content width: 595 − 60 = 535pt
  colNo:    { width: 20 },
  colImg:   { width: 76 },
  colType:  { flex: 1 },
  colDim:   { width: 92 },
  colR:     { width: 36 },
  colL:     { width: 36 },
  colQty:   { width: 36 },
  colPrice: { width: 72 },
  colTotal: { width: 80 },

  // Item cell text
  itNo:    { fontSize: 10, color: '#6b7280' },
  itType:  { fontSize: 11.5, fontWeight: 700, color: '#111111' },
  itDim:   { fontSize: 11, color: '#222222' },
  itSpec:  { fontSize: 9.5, color: C.specTxt, marginTop: 3, lineHeight: 1.5 },
  itBold:  { fontWeight: 700, color: '#111111' },
  itemImg: { width: 64, height: 64, borderRadius: 6, objectFit: 'cover' },
  imgBox:  { width: 64, height: 64, borderRadius: 6, backgroundColor: '#e5e7eb' },

  // Pricing block
  pricingWrap: { marginTop: 20, alignItems: 'flex-end' },
  prRow:       { fontSize: 11, color: C.specTxt, marginBottom: 4, textAlign: 'right', width: 250 },
  prTotal:     { fontSize: 16, fontWeight: 700, color: C.nameTxt, marginTop: 8, borderTopWidth: 2, borderTopColor: C.nameTxt, paddingTop: 6, textAlign: 'right', width: 250 },

  // Notes
  notesBox: { backgroundColor: C.notesBg, borderWidth: 1, borderColor: C.notesBorder, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14 },
  notesTxt: { fontSize: 10, color: C.notesTxt, lineHeight: 1.6 },

  // Bank info
  bankBox:  { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  bankLbl:  { fontSize: 9, fontWeight: 700, color: '#1e40af', marginBottom: 3 },
  bankTxt:  { fontSize: 9.5, color: '#1e3a5f', lineHeight: 1.6 },

  // Footer
  footer:     { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 9, color: C.footerTxt },
})

// ── Shared page component (reused by single and bulk renderers) ───────────────

function OrderPage({
  order,
  itemImagesBase64,
  logoBase64,
  opts,
  companySettings,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any
  itemImagesBase64: (string | null)[]
  logoBase64: string
  opts: PdfBuildOptions
  companySettings?: CompanyPdfSettings | null
}) {
  const { docTitle, listTitle, showPricing, customerName, footerNote } = opts
  const brandName    = companySettings?.company_name || 'Koyuncu Steel Door'
  const brandAddress = companySettings?.address || null
  const brandPhone   = companySettings?.phone   || null
  const resolvedFooter = companySettings?.footer_note || footerNote

  const shortId     = (order.id as string).slice(0, 8).toUpperCase()
  const dateStr     = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  const deadlineStr = fmtDate(order.deadline_date)

  const cari         = order.cariler ?? {}
  const customerCity = cari.city ?? order.customer_city ?? null

  const items: OrderItem[] = order.items || []

  const kdvRate    = Number(order.kdv_rate ?? 20)
  const araToplam  = showPricing
    ? items.reduce((sum, it) => sum + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0)
    : 0
  const kdv         = araToplam * kdvRate / 100
  const genelToplam = araToplam + kdv

  return (
    <Page size="A4" style={s.page}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.brand}>{brandName}</Text>
          {brandAddress
            ? <Text style={s.tagline}>{brandAddress}</Text>
            : <Text style={s.tagline}>Çelik Kapı — Üretim & Satış</Text>
          }
          {brandPhone ? <Text style={s.tagline}>{brandPhone}</Text> : null}
        </View>
        <View style={s.hdrRight}>
          {logoBase64 ? <Image src={logoBase64} style={s.logo} /> : null}
          <View>
            <Text style={s.docLabel}>{docTitle}</Text>
            <Text style={s.docRef}>#{shortId}  ·  {dateStr}</Text>
          </View>
        </View>
      </View>

      {/* ── Content ── */}
      <View style={s.content}>

        {/* Customer box */}
        <View style={s.customerBox}>
          <Text style={s.customerName}>{customerName}</Text>
          {customerCity ? <Text style={s.customerMeta}>{customerCity}</Text> : null}
          {deadlineStr
            ? <View style={s.deadlineTag}><Text style={s.deadlineTxt}>Termin: {deadlineStr}</Text></View>
            : null}
        </View>

        {/* Section title */}
        <Text style={s.secTitle}>{listTitle}</Text>

        {/* Items table */}
        <View>
          {/* Header row */}
          <View style={s.tblHead}>
            <Text style={[s.th, s.colNo]}>#</Text>
            <Text style={[s.th, s.colImg]}>Görsel</Text>
            <Text style={[s.th, s.colType]}>Kapı Tipi</Text>
            <Text style={[s.th, s.colDim]}>Ölçü</Text>
            {showPricing
              ? <>
                  <Text style={[s.th, s.colQty,   { textAlign: 'right' }]}>Adet</Text>
                  <Text style={[s.th, s.colPrice, { textAlign: 'right' }]}>B.Fiyat</Text>
                  <Text style={[s.th, s.colTotal, { textAlign: 'right' }]}>Toplam</Text>
                </>
              : <>
                  <Text style={[s.th, s.colR,   { textAlign: 'right' }]}>Sağ</Text>
                  <Text style={[s.th, s.colL,   { textAlign: 'right' }]}>Sol</Text>
                  <Text style={[s.th, s.colQty, { textAlign: 'right' }]}>Adet</Text>
                </>
            }
          </View>

          {/* Data rows */}
          {items.length === 0
            ? <View style={s.tblRow}>
                <Text style={[s.td, { color: '#9ca3af', flex: 1 }]}>Ürün girilmemiş</Text>
              </View>
            : items.map((it, i) => {
                const label   = doorTypeLabel(it.door_type)
                const dims    = itemMeasurement(it)
                const qty     = Number(it.quantity)            || 0
                const price   = Number(it.unit_price)          || 0
                const sagAdet = Number(it.right_opening_count) || null
                const solAdet = Number(it.left_opening_count)  || null
                const imgSrc  = itemImagesBase64[i] ?? null
                const specs   = buildItemSpecParts(it)

                return (
                  <View key={i} style={s.tblRow} wrap={false}>
                    <View style={[s.td, s.colNo]}>
                      <Text style={s.itNo}>{i + 1}</Text>
                    </View>
                    <View style={[s.td, s.colImg]}>
                      {imgSrc
                        ? <Image src={imgSrc} style={s.itemImg} />
                        : <View style={s.imgBox} />
                      }
                    </View>
                    <View style={[s.td, s.colType]}>
                      <Text style={s.itType}>{label}</Text>
                      {specs.length > 0 &&
                        <Text style={s.itSpec}>{specs.join('  ·  ')}</Text>
                      }
                    </View>
                    <View style={[s.td, s.colDim]}>
                      <Text style={s.itDim}>{dims}</Text>
                    </View>
                    {showPricing
                      ? <>
                          <View style={[s.td, s.colQty]}>
                            <Text style={{ textAlign: 'right' }}>{qty}</Text>
                          </View>
                          <View style={[s.td, s.colPrice]}>
                            <Text style={{ textAlign: 'right' }}>{fmt(price)}</Text>
                          </View>
                          <View style={[s.td, s.colTotal]}>
                            <Text style={[s.itBold, { textAlign: 'right' }]}>{fmt(qty * price)}</Text>
                          </View>
                        </>
                      : <>
                          <View style={[s.td, s.colR]}>
                            <Text style={{ textAlign: 'right' }}>{sagAdet ?? '-'}</Text>
                          </View>
                          <View style={[s.td, s.colL]}>
                            <Text style={{ textAlign: 'right' }}>{solAdet ?? '-'}</Text>
                          </View>
                          <View style={[s.td, s.colQty]}>
                            <Text style={[s.itBold, { textAlign: 'right' }]}>{qty}</Text>
                          </View>
                        </>
                    }
                  </View>
                )
              })
          }
        </View>

        {/* Pricing block */}
        {showPricing &&
          <View style={s.pricingWrap}>
            <Text style={s.prRow}>Ara Toplam: {fmt(araToplam)}</Text>
            <Text style={s.prRow}>KDV (%{kdvRate}): {fmt(kdv)}</Text>
            <Text style={s.prTotal}>Genel Toplam: {fmt(genelToplam)}</Text>
          </View>
        }

        {/* Bank info — teklif only */}
        {showPricing && companySettings?.bank_info
          ? <View style={s.bankBox}>
              <Text style={s.bankLbl}>BANKA BİLGİLERİ</Text>
              <Text style={s.bankTxt}>{companySettings.bank_info}</Text>
            </View>
          : null
        }

        {/* Notes */}
        {order.notes
          ? <View style={s.notesBox}>
              <Text style={s.notesTxt}>
                <Text style={{ fontWeight: 700 }}>Not: </Text>
                {order.notes}
              </Text>
            </View>
          : null
        }

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>{resolvedFooter}</Text>
          <Text style={s.footerText}>Sipariş Ref: {shortId}</Text>
        </View>

      </View>
    </Page>
  )
}

// ── Single-order PDF component ────────────────────────────────────────────────

function OrderPdf({
  order,
  itemImagesBase64,
  logoBase64,
  opts,
  companySettings,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any
  itemImagesBase64: (string | null)[]
  logoBase64: string
  opts: PdfBuildOptions
  companySettings?: CompanyPdfSettings | null
}) {
  return (
    <Document>
      <OrderPage
        order={order}
        itemImagesBase64={itemImagesBase64}
        logoBase64={logoBase64}
        opts={opts}
        companySettings={companySettings}
      />
    </Document>
  )
}

// ── Bulk PDF component (one Document, N pages) ───────────────────────────────

function BulkOrderPdf({
  entries,
  logoBase64,
  opts,
  companySettings,
}: {
  entries: BulkOrderEntry[]
  logoBase64: string
  opts: Omit<PdfBuildOptions, 'customerName'>
  companySettings?: CompanyPdfSettings | null
}) {
  return (
    <Document>
      {entries.map((entry, i) => (
        <OrderPage
          key={i}
          order={entry.order}
          itemImagesBase64={entry.itemImagesBase64}
          logoBase64={logoBase64}
          opts={{ ...opts, customerName: entry.customerName }}
          companySettings={companySettings}
        />
      ))}
    </Document>
  )
}

// ── Public renderers ──────────────────────────────────────────────────────────

export async function buildOrderPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any,
  itemImagesBase64: (string | null)[],
  logoBase64: string,
  opts: PdfBuildOptions,
  companySettings?: CompanyPdfSettings | null,
): Promise<Buffer> {
  const element = React.createElement(OrderPdf, { order, itemImagesBase64, logoBase64, opts, companySettings })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes   = await renderToBuffer(element as any)
  return Buffer.from(bytes)
}

export async function buildBulkOrderPdf(
  entries: BulkOrderEntry[],
  logoBase64: string,
  opts: Omit<PdfBuildOptions, 'customerName'>,
  companySettings?: CompanyPdfSettings | null,
): Promise<Buffer> {
  const element = React.createElement(BulkOrderPdf, { entries, logoBase64, opts, companySettings })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes   = await renderToBuffer(element as any)
  return Buffer.from(bytes)
}
