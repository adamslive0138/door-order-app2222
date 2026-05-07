'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import { DOOR_TYPE_LABELS, type DoorType } from '@/src/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CariOption {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  city: string | null
}

interface OrderOption {
  id: string
  customer_name: string
  customer_phone: string
  customer_city: string
  door_type: DoorType
  dimensions: string | null
  quantity: number
  unit_price: number
  lock_brand: string | null
  lock_system: string | null
  frame_color: string | null
  image_url: string | null
}

interface Props {
  companyId: string
  cariler?: CariOption[]
  orders?: OrderOption[]
  initialCariId?: string
  initialOrderId?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OfferForm({
  companyId,
  cariler = [],
  orders = [],
  initialCariId,
  initialOrderId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const initFromCari  = initialCariId  ? cariler.find(c => c.id === initialCariId)  : null
  const initFromOrder = initialOrderId ? orders.find(o => o.id === initialOrderId)  : null

  const [customer_name,   setCustomerName]   = useState(
    initFromOrder?.customer_name ?? initFromCari?.contact_name ?? initFromCari?.name ?? ''
  )
  const [customer_phone,  setCustomerPhone]  = useState(
    initFromOrder?.customer_phone ?? initFromCari?.phone ?? ''
  )
  const [customer_city,   setCustomerCity]   = useState(
    initFromOrder?.customer_city ?? initFromCari?.city ?? ''
  )
  const [door_type,       setDoorType]       = useState<DoorType | ''>(initFromOrder?.door_type ?? '')
  const [dimensions,      setDimensions]     = useState(initFromOrder?.dimensions ?? '')
  const [quantity,        setQuantity]       = useState(String(initFromOrder?.quantity ?? 1))
  const [unit_price,      setUnitPrice]      = useState(String(initFromOrder?.unit_price ?? ''))
  const [notes,           setNotes]          = useState('')
  const [offer_text,      setOfferText]      = useState('')
  const [imageFile,       setImageFile]      = useState<File | null>(null)
  const [previewUrl,      setPreviewUrl]     = useState<string | null>(initFromOrder?.image_url ?? null)
  const [autoSource,      setAutoSource]     = useState<string | null>(
    initFromOrder ? `Sipariş: ${initFromOrder.customer_name}` :
    initFromCari  ? `Cari: ${initFromCari.name}` : null
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const total = (parseFloat(unit_price) || 0) * (parseInt(quantity) || 0)

  function fillFromCari(c: CariOption) {
    setCustomerName(c.contact_name || c.name)
    setCustomerPhone(c.phone ?? '')
    setCustomerCity(c.city ?? '')
    setAutoSource(`Cari: ${c.name}`)
  }

  function fillFromOrder(o: OrderOption) {
    setCustomerName(o.customer_name)
    setCustomerPhone(o.customer_phone)
    setCustomerCity(o.customer_city)
    setDoorType(o.door_type)
    setDimensions(o.dimensions ?? '')
    setQuantity(String(o.quantity))
    setUnitPrice(String(o.unit_price))
    setPreviewUrl(o.image_url)
    setAutoSource(`Sipariş: ${o.customer_name}`)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    if (file) setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer_name.trim()) { setError('Müşteri adı zorunludur.'); return }
    if (!door_type)             { setError('Kapı tipi seçiniz.'); return }
    setError(null)
    setSaving(true)

    let image_url: string | null = null

    if (imageFile) {
      const ext  = imageFile.name.split('.').pop()
      const path = `${companyId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('order-images')
        .upload(path, imageFile, { upsert: true })
      if (upErr) { setSaving(false); setError(`Görsel yüklenemedi: ${upErr.message}`); return }
      const { data: urlData } = supabase.storage.from('order-images').getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    const qty   = parseInt(quantity) || 1
    const price = parseFloat(unit_price) || 0

    const { data, error: insertErr } = await supabase
      .from('offers')
      .insert({
        company_id:     companyId,
        cari_id:        initialCariId  ?? null,
        order_id:       initialOrderId ?? null,
        customer_name:  customer_name.trim(),
        customer_phone: customer_phone.trim()  || null,
        customer_city:  customer_city.trim()   || null,
        door_type:      door_type              || null,
        dimensions:     dimensions.trim()      || null,
        quantity:       qty,
        unit_price:     price,
        notes:          notes.trim()           || null,
        offer_text:     offer_text.trim()      || null,
        image_url,
        status:         'taslak',
      })
      .select('id')
      .single()

    setSaving(false)
    if (insertErr) { setError(insertErr.message); return }
    router.push(`/offers/${data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Hızlı Doldur ─────────────────────────────────────────────────── */}
      {(cariler.length > 0 || orders.length > 0) && (
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-800">Hızlı Doldur</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {cariler.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cariden müşteri bilgilerini al</label>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  defaultValue=""
                  onChange={e => {
                    const c = cariler.find(c => c.id === e.target.value)
                    if (c) fillFromCari(c)
                  }}
                >
                  <option value="">— Cari seçin —</option>
                  {cariler.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {orders.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Siparişten doldur</label>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  defaultValue=""
                  onChange={e => {
                    const o = orders.find(o => o.id === e.target.value)
                    if (o) fillFromOrder(o)
                  }}
                >
                  <option value="">— Sipariş seçin —</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.customer_name} — {DOOR_TYPE_LABELS[o.door_type]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {autoSource && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-blue-700">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{autoSource} kaynağından dolduruldu — tüm alanları düzenleyebilirsiniz</span>
            </div>
          )}
        </section>
      )}

      {/* ── Müşteri Bilgileri ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Müşteri Bilgileri</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Müşteri Adı *</label>
            <input
              type="text" required value={customer_name}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Firma veya kişi adı"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
            <input
              type="tel" value={customer_phone}
              onChange={e => setCustomerPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="05xx xxx xx xx"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Şehir</label>
            <input
              type="text" value={customer_city}
              onChange={e => setCustomerCity(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="İstanbul"
            />
          </div>
        </div>
      </section>

      {/* ── Ürün Bilgileri ────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Ürün Bilgileri</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kapı Tipi *</label>
            <select
              required
              value={door_type}
              onChange={e => setDoorType(e.target.value as DoorType)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Seçin —</option>
              {(Object.keys(DOOR_TYPE_LABELS) as DoorType[]).map(k => (
                <option key={k} value={k}>{DOOR_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ölçüler</label>
            <input
              type="text" value={dimensions}
              onChange={e => setDimensions(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="90×210 cm"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Adet</label>
            <input
              type="number" min="1" value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Birim Fiyat (₺)</label>
            <input
              type="number" step="0.01" min="0" value={unit_price}
              onChange={e => setUnitPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Toplam</label>
            <div className="flex items-center h-[38px] rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(total)}
            </div>
          </div>
        </div>
      </section>

      {/* ── Görsel ───────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Ürün Görseli</h2>
        <input
          type="file" accept="image/*"
          onChange={handleImageChange}
          className="block text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Önizleme"
            className="max-h-40 rounded-lg object-contain border border-gray-200"
          />
        )}
      </section>

      {/* ── Teklif Metni & Notlar ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Teklif Metni</label>
          <textarea
            rows={3} value={offer_text}
            onChange={e => setOfferText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            placeholder="Ödeme koşulları, teslimat süresi, garanti…"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notlar</label>
          <textarea
            rows={2} value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            placeholder="İç notlar (PDF'e yansımaz)"
          />
        </div>
      </section>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/offers')}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          İptal
        </button>
        <button
          type="submit" disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Teklif Oluştur'}
        </button>
      </div>
    </form>
  )
}
