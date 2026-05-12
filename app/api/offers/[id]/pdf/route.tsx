import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import React from 'react'
import path from 'path'
import {
  Document, Page, View, Text, Image,
  StyleSheet, Font, renderToBuffer,
} from '@react-pdf/renderer'
import { fetchCompanySettingsForPdf } from '@/src/lib/pdf-builder'
import { DOOR_TYPE_LABELS } from '@/src/types'

export const dynamic = 'force-dynamic'

Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: path.join(process.cwd(), 'public/fonts/NotoSans-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(process.cwd(), 'public/fonts/NotoSans-Bold.ttf'),    fontWeight: 'bold'   },
  ],
})
Font.registerHyphenationCallback(word => [word])

function fmt(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

async function fetchImageBase64(url: string): Promise<string | null> {
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

const C = {
  headerBg:  '#1e3a5f',
  white:     '#ffffff',
  subtext:   '#93b4d0',
  border:    '#e5e7eb',
  headTxt:   '#374151',
  bodyTxt:   '#1a1a2e',
  secTxt:    '#6b7280',
  notesBg:   '#fffbeb',
  notesBdr:  '#fde68a',
  notesTxt:  '#78350f',
  bankBg:    '#eff6ff',
  bankBdr:   '#bfdbfe',
  bankBlue:  '#1e40af',
  customerBg:'#f0f6ff',
  customerBdr:'#c3d9f5',
  nameTxt:   '#1e3a5f',
  footerTxt: '#9ca3af',
} as const

const s = StyleSheet.create({
  page:     { fontFamily: 'Noto Sans', fontSize: 11, color: C.bodyTxt, backgroundColor: '#ffffff' },
  header:   { backgroundColor: C.headerBg, paddingHorizontal: 30, paddingVertical: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand:    { fontSize: 19, fontWeight: 700, color: C.white },
  tagline:  { fontSize: 9, color: C.subtext, marginTop: 3, letterSpacing: 1.2 },
  hdrRight: { flexDirection: 'row', alignItems: 'flex-start' },
  logo:     { height: 55, maxWidth: 180, objectFit: 'contain', marginRight: 20 },
  docLabel: { fontSize: 13, fontWeight: 700, color: C.white, textAlign: 'right', letterSpacing: 2 },
  docRef:   { fontSize: 10, color: C.subtext, marginTop: 4, textAlign: 'right' },
  content:  { paddingHorizontal: 30, paddingTop: 22, paddingBottom: 22 },

  // Customer + date row
  infoRow:  { flexDirection: 'row', gap: 12, marginBottom: 18 },
  infoBox:  { flex: 1, backgroundColor: C.customerBg, borderWidth: 1, borderColor: C.customerBdr, borderRadius: 7, paddingHorizontal: 14, paddingVertical: 10 },
  infoLbl:  { fontSize: 8, fontWeight: 700, color: C.secTxt, letterSpacing: 1.4, marginBottom: 5 },
  infoName: { fontSize: 13, fontWeight: 700, color: C.nameTxt },
  infoMeta: { fontSize: 10, color: '#4a6080', marginTop: 3 },

  // Section
  secTitle: { fontSize: 9, fontWeight: 700, color: C.secTxt, letterSpacing: 1.5, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 5, marginBottom: 10 },

  // Table
  tblHead: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 4 },
  tblRow:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'center', minHeight: 40 },
  th:      { fontSize: 9, fontWeight: 700, color: C.headTxt, paddingHorizontal: 8, paddingVertical: 7, letterSpacing: 0.8 },
  td:      { paddingHorizontal: 8, paddingVertical: 7 },

  colDesc:  { flex: 1 },
  colDim:   { width: 90 },
  colQty:   { width: 40 },
  colPrice: { width: 80 },
  colTotal: { width: 90 },

  // Product image
  productImg: { width: '100%', maxHeight: 180, objectFit: 'contain', marginBottom: 16, borderRadius: 6 },

  // Pricing block
  pricingWrap: { marginTop: 18, alignItems: 'flex-end' },
  prTotal:     { fontSize: 15, fontWeight: 700, color: C.nameTxt, borderTopWidth: 2, borderTopColor: C.nameTxt, paddingTop: 6, textAlign: 'right', width: 220 },

  // Notes / offer text
  notesBox: { backgroundColor: C.notesBg, borderWidth: 1, borderColor: C.notesBdr, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14 },
  notesTxt: { fontSize: 10, color: C.notesTxt, lineHeight: 1.6 },
  offerBox: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: C.bankBdr, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  offerTxt: { fontSize: 10, color: '#1e3a5f', lineHeight: 1.6 },

  // Bank
  bankBox: { backgroundColor: C.bankBg, borderWidth: 1, borderColor: C.bankBdr, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  bankLbl: { fontSize: 9, fontWeight: 700, color: C.bankBlue, marginBottom: 3 },
  bankTxt: { fontSize: 9.5, color: '#1e3a5f', lineHeight: 1.6 },

  // Signature
  sigRow:  { flexDirection: 'row', gap: 30, marginTop: 28 },
  sigBox:  { flex: 1 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 36, marginBottom: 6 },
  sigLbl:  { fontSize: 9, color: C.footerTxt, textAlign: 'center' },

  // Footer
  footer:     { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 9, color: C.footerTxt },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OfferPdf({ offer, logoBase64, imageBase64, companyName, companyAddress, companyPhone, footerNote, bankInfo }: any) {
  const shortId  = (offer.id as string).slice(0, 8).toUpperCase()
  const dateStr  = fmtDate(offer.created_at)
  const doorLabel = offer.door_type ? (DOOR_TYPE_LABELS[offer.door_type as keyof typeof DOOR_TYPE_LABELS] ?? offer.door_type) : '—'
  const totalPrice = Number(offer.total_price) || 0

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>{companyName ?? 'Şirket'}</Text>
            {companyAddress ? <Text style={s.tagline}>{companyAddress}</Text> : <Text style={s.tagline}>Çelik Kapı — Üretim & Satış</Text>}
            {companyPhone ? <Text style={s.tagline}>{companyPhone}</Text> : null}
          </View>
          <View style={s.hdrRight}>
            {logoBase64 ? <Image src={logoBase64} style={s.logo} /> : null}
            <View>
              <Text style={s.docLabel}>TEKLİF</Text>
              <Text style={s.docRef}>#{shortId}  ·  {dateStr}</Text>
            </View>
          </View>
        </View>

        <View style={s.content}>

          {/* Customer + date info */}
          <View style={s.infoRow}>
            <View style={s.infoBox}>
              <Text style={s.infoLbl}>MÜŞTERİ</Text>
              <Text style={s.infoName}>{offer.customer_name}</Text>
              {offer.customer_city  ? <Text style={s.infoMeta}>{offer.customer_city}</Text>  : null}
              {offer.customer_phone ? <Text style={s.infoMeta}>{offer.customer_phone}</Text> : null}
            </View>
            <View style={[s.infoBox, { flex: 0.5 }]}>
              <Text style={s.infoLbl}>TEKLİF BİLGİSİ</Text>
              <Text style={[s.infoMeta, { marginTop: 0 }]}>Tarih</Text>
              <Text style={[s.infoName, { fontSize: 11 }]}>{dateStr}</Text>
            </View>
          </View>

          {/* Product image */}
          {imageBase64 ? <Image src={imageBase64} style={s.productImg} /> : null}

          {/* Product table */}
          <Text style={s.secTitle}>ÜRÜN LİSTESİ</Text>
          <View>
            <View style={s.tblHead}>
              <Text style={[s.th, s.colDesc]}>Ürün / Açıklama</Text>
              <Text style={[s.th, s.colDim]}>Ölçüler</Text>
              <Text style={[s.th, s.colQty, { textAlign: 'right' }]}>Adet</Text>
              <Text style={[s.th, s.colPrice, { textAlign: 'right' }]}>Birim Fiyat</Text>
              <Text style={[s.th, s.colTotal, { textAlign: 'right' }]}>Toplam</Text>
            </View>
            <View style={s.tblRow}>
              <View style={[s.td, s.colDesc]}>
                <Text style={{ fontSize: 11, fontWeight: 700 }}>{doorLabel}</Text>
              </View>
              <View style={[s.td, s.colDim]}>
                <Text style={{ fontSize: 10, color: '#555' }}>{offer.dimensions ?? '—'}</Text>
              </View>
              <View style={[s.td, s.colQty]}>
                <Text style={{ textAlign: 'right' }}>{offer.quantity}</Text>
              </View>
              <View style={[s.td, s.colPrice]}>
                <Text style={{ textAlign: 'right' }}>{fmt(Number(offer.unit_price))}</Text>
              </View>
              <View style={[s.td, s.colTotal]}>
                <Text style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(totalPrice)}</Text>
              </View>
            </View>
          </View>

          {/* Total */}
          <View style={s.pricingWrap}>
            <Text style={s.prTotal}>Genel Toplam: {fmt(totalPrice)}</Text>
          </View>

          {/* Offer text */}
          {offer.offer_text ? (
            <View style={s.offerBox}>
              <Text style={[s.offerTxt, { fontWeight: 700, marginBottom: 3, fontSize: 9 }]}>TEKLİF AÇIKLAMASI</Text>
              <Text style={s.offerTxt}>{offer.offer_text}</Text>
            </View>
          ) : null}

          {/* Notes */}
          {offer.notes ? (
            <View style={s.notesBox}>
              <Text style={s.notesTxt}>
                <Text style={{ fontWeight: 700 }}>Not: </Text>
                {offer.notes}
              </Text>
            </View>
          ) : null}

          {/* Bank info */}
          {bankInfo ? (
            <View style={s.bankBox}>
              <Text style={s.bankLbl}>BANKA BİLGİLERİ</Text>
              <Text style={s.bankTxt}>{bankInfo}</Text>
            </View>
          ) : null}

          {/* Signature */}
          <View style={s.sigRow}>
            <View style={s.sigBox}>
              <View style={s.sigLine} />
              <Text style={s.sigLbl}>Müşteri İmzası / Kaşesi</Text>
            </View>
            <View style={s.sigBox}>
              <View style={s.sigLine} />
              <Text style={s.sigLbl}>Yetkili İmza / Kaşe</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerText}>{footerNote}</Text>
            <Text style={s.footerText}>Teklif Ref: {shortId}</Text>
          </View>

        </View>
      </Page>
    </Document>
  )
}

export async function GET(
  _request: Request,
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

  const { data: offer, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single()

  if (error || !offer) return new NextResponse('Teklif bulunamadı', { status: 404 })

  const [{ settings, logoBase64 }] = await Promise.all([
    fetchCompanySettingsForPdf(supabase, profile.company_id),
  ])

  // Fetch product image if present
  let imageBase64: string | null = null
  if (offer.image_url) {
    // image_url may be a direct public URL or a storage path
    imageBase64 = await fetchImageBase64(offer.image_url).catch(() => null)
  }

  const footerNote = settings.footer_note ?? 'Bu teklif 30 gün geçerlidir.'
  const shortId = (offer.id as string).slice(0, 8)

  const element = React.createElement(OfferPdf, {
    offer,
    logoBase64,
    imageBase64,
    companyName:    settings.company_name,
    companyAddress: settings.address,
    companyPhone:   settings.phone,
    footerNote,
    bankInfo: settings.bank_info,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes = await renderToBuffer(element as any)
  const body  = new Uint8Array(bytes)

  return new NextResponse(body, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="teklif-${shortId}.pdf"`,
    },
  })
}
