'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { DoorType, Order } from '@/src/types'

const LOCK_BRANDS = ['DAF', 'HOK', 'KALE', 'İTO', 'TURSAN'] as const
const FRAME_COLORS = ['Antrasit', 'Beyaz', 'Siyah'] as const

interface Props {
  companyId: string
  orderId?: string
  initialData?: Partial<Order>
}

export default function OrderForm({ companyId, orderId, initialData }: Props) {
  const router = useRouter()
  const isEdit = !!orderId

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.image_url ?? null
  )

  // Resolve lock_brand initial select value vs custom
  const initLockBrand = initialData?.lock_brand
    ? (LOCK_BRANDS.includes(initialData.lock_brand as typeof LOCK_BRANDS[number]) ? initialData.lock_brand : 'Diger')
    : ''
  const initLockBrandCustom =
    initialData?.lock_brand && !LOCK_BRANDS.includes(initialData.lock_brand as typeof LOCK_BRANDS[number])
      ? initialData.lock_brand
      : ''

  // Resolve frame_color initial select value vs custom
  const initFrameColor = initialData?.frame_color
    ? (FRAME_COLORS.includes(initialData.frame_color as typeof FRAME_COLORS[number]) ? initialData.frame_color : 'Diger')
    : ''
  const initFrameColorCustom =
    initialData?.frame_color && !FRAME_COLORS.includes(initialData.frame_color as typeof FRAME_COLORS[number])
      ? initialData.frame_color
      : ''

  // Pre-compute weeks from existing deadline when editing
  const initialWeeks =
    initialData?.deadline_date && initialData?.created_at
      ? Math.max(1, Math.round(
          (new Date(initialData.deadline_date).getTime() -
            new Date(initialData.created_at).getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        ))
      : 3

  const [form, setForm] = useState({
    customer_name: initialData?.customer_name ?? '',
    customer_phone: initialData?.customer_phone ?? '',
    customer_city: initialData?.customer_city ?? '',
    door_type: (initialData?.door_type ?? 'celik_kapi') as DoorType,
    dimensions: initialData?.dimensions ?? '',
    quantity: initialData?.quantity ?? 1,
    unit_price: initialData?.unit_price ?? 0,
    notes: initialData?.notes ?? '',
    production_duration_weeks: initialWeeks,
    lock_brand: initLockBrand,
    lock_brand_custom: initLockBrandCustom,
    lock_system: initialData?.lock_system ?? '',
    frame_color: initFrameColor,
    frame_color_custom: initFrameColorCustom,
    mdf_thickness: initialData?.mdf_thickness ?? '',
    mdf_thickness_other: initialData?.mdf_thickness_other ?? '',
    steel_thickness: initialData?.steel_thickness ?? '',
  })

  const total_price = form.quantity * form.unit_price

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : (initialData?.image_url ?? null))
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: ['quantity', 'unit_price', 'production_duration_weeks'].includes(name) ? Number(value) : value,
    }))
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    // Resolve image_url: upload new file if selected, otherwise keep existing
    let image_url: string | null = initialData?.image_url ?? null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${companyId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('order-images')
        .upload(path, imageFile, { upsert: false })

      if (uploadError) {
        setError(`Görsel yüklenemedi: ${uploadError.message}`)
        setLoading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('order-images').getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    const payload = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_city: form.customer_city,
      door_type: form.door_type,
      dimensions: form.dimensions || null,
      quantity: form.quantity,
      unit_price: form.unit_price,
      notes: form.notes || null,
      deadline_date: (() => {
        const base = isEdit && initialData?.created_at
          ? new Date(initialData.created_at)
          : new Date()
        base.setDate(base.getDate() + form.production_duration_weeks * 7)
        return base.toISOString().split('T')[0]
      })(),
      image_url,
      lock_brand: form.lock_brand === 'Diger' ? (form.lock_brand_custom || null) : (form.lock_brand || null),
      lock_system: form.lock_system || null,
      frame_color: form.frame_color === 'Diger' ? (form.frame_color_custom || null) : (form.frame_color || null),
      mdf_thickness: form.mdf_thickness || null,
      mdf_thickness_other: form.mdf_thickness === 'Diğer' ? (form.mdf_thickness_other || null) : null,
      steel_thickness: form.steel_thickness || null,
    }

    let dbError
    if (isEdit) {
      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId)
      dbError = error
    } else {
      const { error } = await supabase.from('orders').insert({
        ...payload,
        company_id: companyId,
        status: 'siparis_alindi',
      })
      dbError = error
    }

    if (dbError) {
      setError(`Hata: ${dbError.message}`)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Müşteri Bilgileri */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Müşteri Bilgileri</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700">
              Ad Soyad <span className="text-red-500">*</span>
            </label>
            <input
              id="customer_name"
              name="customer_name"
              type="text"
              required
              value={form.customer_name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700">
              Telefon <span className="text-red-500">*</span>
            </label>
            <input
              id="customer_phone"
              name="customer_phone"
              type="text"
              required
              value={form.customer_phone}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="customer_city" className="block text-sm font-medium text-gray-700">
              Şehir <span className="text-red-500">*</span>
            </label>
            <input
              id="customer_city"
              name="customer_city"
              type="text"
              required
              value={form.customer_city}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Ürün Bilgileri */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Ürün Bilgileri</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="door_type" className="block text-sm font-medium text-gray-700">
              Kapı Tipi <span className="text-red-500">*</span>
            </label>
            <select
              id="door_type"
              name="door_type"
              required
              value={form.door_type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="celik_kapi">Çelik Kapı</option>
              <option value="villa_kapisi">Villa Kapısı</option>
              <option value="yangin_kapisi">Yangın Kapısı</option>
              <option value="menfezli_kapi">Menfezli Kapı</option>
              <option value="panjurlu_kapi">Panjurlu Kapı</option>
            </select>
          </div>

          <div>
            <label htmlFor="dimensions" className="block text-sm font-medium text-gray-700">
              Ölçüler
            </label>
            <input
              id="dimensions"
              name="dimensions"
              type="text"
              placeholder="örn. 90x200 cm"
              value={form.dimensions}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
              Adet <span className="text-red-500">*</span>
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              required
              value={form.quantity}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="unit_price" className="block text-sm font-medium text-gray-700">
              Birim Fiyat (₺) <span className="text-red-500">*</span>
            </label>
            <input
              id="unit_price"
              name="unit_price"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.unit_price}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Toplam Tutar</label>
            <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
                total_price
              )}
            </div>
          </div>

          <div>
            <label htmlFor="production_duration_weeks" className="block text-sm font-medium text-gray-700">
              Üretim Süresi (Hafta) <span className="text-red-500">*</span>
            </label>
            <input
              id="production_duration_weeks"
              name="production_duration_weeks"
              type="number"
              min={1}
              max={52}
              required
              value={form.production_duration_weeks}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Termin tarihi sipariş tarihinden itibaren otomatik hesaplanır.
            </p>
          </div>
        </div>
      </fieldset>

      {/* Kilit & Kasa */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Kapının Özellikleri</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lock_brand" className="block text-sm font-medium text-gray-700">
              Kilit Markası
            </label>
            <select
              id="lock_brand"
              name="lock_brand"
              value={form.lock_brand}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Seçiniz —</option>
              {LOCK_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value="Diger">Diğer</option>
            </select>
            {form.lock_brand === 'Diger' && (
              <input
                name="lock_brand_custom"
                type="text"
                placeholder="Kilit markasını giriniz"
                value={form.lock_brand_custom}
                onChange={handleChange}
                className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label htmlFor="lock_system" className="block text-sm font-medium text-gray-700">
              Kilit Sistemi
            </label>
            <select
              id="lock_system"
              name="lock_system"
              value={form.lock_system}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Seçiniz —</option>
              <option value="Monoblok">Monoblok</option>
              <option value="Yarı Merkezi">Yarı Merkezi</option>
              <option value="Tam Merkezi">Tam Merkezi</option>
            </select>
          </div>

          <div>
            <label htmlFor="frame_color" className="block text-sm font-medium text-gray-700">
              Kasa Rengi
            </label>
            <select
              id="frame_color"
              name="frame_color"
              value={form.frame_color}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Seçiniz —</option>
              {FRAME_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="Diger">Diğer</option>
            </select>
            {form.frame_color === 'Diger' && (
              <input
                name="frame_color_custom"
                type="text"
                placeholder="Kasa rengini giriniz"
                value={form.frame_color_custom}
                onChange={handleChange}
                className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label htmlFor="mdf_thickness" className="block text-sm font-medium text-gray-700">
              MDF Kalınlığı
            </label>
            <select
              id="mdf_thickness"
              name="mdf_thickness"
              value={form.mdf_thickness}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Seçiniz —</option>
              <option value="8 mm">8 mm</option>
              <option value="10 mm">10 mm</option>
              <option value="Diğer">Diğer</option>
            </select>
            {form.mdf_thickness === 'Diğer' && (
              <input
                name="mdf_thickness_other"
                type="text"
                placeholder="MDF kalınlığını giriniz"
                value={form.mdf_thickness_other}
                onChange={handleChange}
                className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label htmlFor="steel_thickness" className="block text-sm font-medium text-gray-700">
              Sac Kalınlığı
            </label>
            <input
              id="steel_thickness"
              name="steel_thickness"
              type="text"
              placeholder="örn. 1.5 mm"
              value={form.steel_thickness}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Notlar & Görsel */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Ek Bilgiler</legend>
        <div className="space-y-4">
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notlar
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700">
              Görsel
            </label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Önizleme"
                className="mt-3 h-32 w-32 rounded-lg border border-gray-200 object-cover"
              />
            )}
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          İptal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Kaydediliyor...' : isEdit ? 'Değişiklikleri Kaydet' : 'Siparişi Kaydet'}
        </button>
      </div>
    </form>
  )
}
