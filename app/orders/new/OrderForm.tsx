'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { DoorType, Order } from '@/src/types'
import type { StockModel } from '@/app/stock/StockPage'
import { syncOrderFinanceMovement } from '@/src/lib/server/order-finance-sync'

const LOCK_BRANDS = ['DAF', 'HOK', 'KALE', 'İTO', 'TURSAN'] as const
const FRAME_COLORS = ['Antrasit', 'Beyaz', 'Siyah'] as const

interface CariOption {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  city: string | null
}

interface StaffMember {
  id: string
  full_name: string | null
}

interface Props {
  companyId: string
  userId: string
  orderId?: string
  initialData?: Partial<Order>
  cariler?: CariOption[]
  initialCariId?: string
  userRole?: string
  staffList?: StaffMember[]
}

export default function OrderForm({ companyId, userId, orderId, initialData, cariler = [], initialCariId, userRole, staffList = [] }: Props) {
  const router = useRouter()
  const isEdit = !!orderId

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

  // Resolve kdv_rate initial select value
  const KDV_PRESETS = ['20', '10', '1', '0'] as const
  const initKdvStr    = String(initialData?.kdv_rate ?? 20)
  const initKdvSelect = (KDV_PRESETS as readonly string[]).includes(initKdvStr) ? initKdvStr : 'diger'
  const initKdvCustom = initKdvSelect === 'diger' ? initKdvStr : ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState(userId)
  const [kdvRateSelect, setKdvRateSelect] = useState(initKdvSelect)
  const [kdvRateCustom, setKdvRateCustom] = useState(initKdvCustom)
  const [cariId, setCariId] = useState(initialCariId ?? '')
  const [localCariler, setLocalCariler] = useState<CariOption[]>(cariler)

  // Stock model picker state
  const [stockOpen, setStockOpen] = useState(false)
  const [stockModels, setStockModels] = useState<StockModel[] | null>(null)
  const [stockPickTarget, setStockPickTarget] = useState(0) // which item index to fill

  // Quick cari creation state
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickForm, setQuickForm] = useState({ name: '', cari_type: 'musteri' })
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)

  // Pre-compute weeks from existing deadline when editing
  const initialWeeks =
    initialData?.deadline_date && initialData?.created_at
      ? Math.max(1, Math.round(
          (new Date(initialData.deadline_date).getTime() -
            new Date(initialData.created_at).getTime()) /
            (7 * 24 * 60 * 60 * 1000)
        ))
      : 3

  const initCari = initialCariId ? cariler.find(c => c.id === initialCariId) : null

  const [form, setForm] = useState({
    customer_name:  initialData?.customer_name  ?? (initCari ? (initCari.contact_name || initCari.name) : ''),
    customer_phone: initialData?.customer_phone ?? (initCari?.phone ?? ''),
    customer_city:  initialData?.customer_city  ?? (initCari?.city  ?? ''),
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
    operation_note:        initialData?.operation_note        ?? '',
    production_start_date: initialData?.production_start_date ?? '',
    ready_date:            initialData?.ready_date            ?? '',
    shipped_date:          initialData?.shipped_date          ?? '',
    delivered_date:        initialData?.delivered_date        ?? '',
  })

  type ItemRow = {
    door_type: string; door_type_custom: string
    measurement: string; measurement_preset: 'standart' | 'diger' | ''
    right_opening_count: number; left_opening_count: number; quantity: number
    unit_price: number
    lock_brand: string; lock_brand_custom: string
    lock_system: string; lock_system_custom: string
    frame_color: string; frame_color_custom: string
    mdf_thickness: string; sac_kalinligi: string; kanat_kalinligi: string
    image_file: File | null; image_path: string | null
    stock_model_id: string | null
  }

  function blankItem(): ItemRow {
    return { door_type: '', door_type_custom: '', measurement: '', measurement_preset: '', right_opening_count: 0, left_opening_count: 0, quantity: 0, unit_price: 0, lock_brand: '', lock_brand_custom: '', lock_system: '', lock_system_custom: '', frame_color: '', frame_color_custom: '', mdf_thickness: '', sac_kalinligi: '', kanat_kalinligi: '', image_file: null, image_path: null, stock_model_id: null }
  }

  function inferPreset(m: string): 'standart' | 'diger' | '' {
    if (!m) return ''
    return m === '90x200x20' ? 'standart' : 'diger'
  }

  const [items, setItems] = useState<ItemRow[]>(() => {
    const stored = (initialData as any)?.items
    if (stored && Array.isArray(stored) && stored.length > 0) {
      return stored.map((it: any) => {
        const m = it.measurement || (it.width && it.height ? `${it.width}x${it.height}` : '')
        const r = Number(it.right_opening_count ?? 0)
        const l = Number(it.left_opening_count ?? 0)
        return { ...blankItem(), ...it, measurement: m, measurement_preset: inferPreset(m), right_opening_count: r, left_opening_count: l, quantity: r + l || Number(it.quantity) || 1, lock_brand_custom: '', image_file: null, image_path: it.image_path ?? null }
      })
    }
    if (initialData) {
      const m = initialData.dimensions || ''
      return [{ ...blankItem(), door_type: initialData.door_type || '', measurement: m, measurement_preset: inferPreset(m), quantity: initialData.quantity || 1, unit_price: initialData.unit_price || 0, lock_brand: initialData.lock_brand || '', lock_system: initialData.lock_system || '', frame_color: initialData.frame_color || '', mdf_thickness: initialData.mdf_thickness || '' }]
    }
    return [blankItem()]
  })

  function updateItem(index: number, field: string, value: string | number) {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it
      const next = { ...it, [field]: value }
      if (field === 'right_opening_count' || field === 'left_opening_count') {
        next.quantity = (field === 'right_opening_count' ? Number(value) : it.right_opening_count)
                      + (field === 'left_opening_count'  ? Number(value) : it.left_opening_count)
      }
      if (field === 'measurement_preset') {
        if (value === 'standart') { next.measurement = '90x200x20' }
        else { next.measurement = '' }
      }
      return next
    }))
  }
  function removeItem(index: number) {
    if (items.length === 1) return
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const itemsTotal  = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0)
  const kdvRate     = Number(kdvRateSelect === 'diger' ? kdvRateCustom : kdvRateSelect) || 0
  const kdvTutari   = itemsTotal * kdvRate / 100
  const genelToplam = itemsTotal + kdvTutari
  const total_price = genelToplam

  async function openStockPicker(itemIdx: number) {
    setStockPickTarget(itemIdx)
    setStockOpen(true)
    // Always re-fetch if empty — avoids stale-empty-cache after a failed first load
    if (stockModels !== null && stockModels.length > 0) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('stock_models')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('[StockPicker] query error:', error)
    setStockModels((data ?? []) as StockModel[])
  }

  function applyStockModel(model: StockModel) {
    const preset = model.measurement === '90x200x20' ? 'standart' : (model.measurement ? 'diger' : '')
    setItems(prev => prev.map((it, i) => {
      if (i !== stockPickTarget) return it
      return {
        ...it,
        door_type:           model.door_type        ?? it.door_type,
        measurement:         model.measurement      ?? it.measurement,
        measurement_preset:  preset || it.measurement_preset,
        right_opening_count: model.right_count ?? it.right_opening_count,
        left_opening_count:  model.left_count  ?? it.left_opening_count,
        quantity:            (model.right_count ?? 0) + (model.left_count ?? 0) || it.quantity,
        lock_brand:          model.lock_brand   ?? it.lock_brand,
        lock_system:         model.lock_system  ?? it.lock_system,
        frame_color:         model.frame_color  ?? it.frame_color,
        mdf_thickness:       model.mdf_thickness   ?? it.mdf_thickness,
        sac_kalinligi:       model.sheet_thickness ?? it.sac_kalinligi,
        kanat_kalinligi:     model.wing_thickness  ?? it.kanat_kalinligi,
        unit_price:          model.price != null && model.price > 0 ? model.price : it.unit_price,
        stock_model_id:      model.id,
      }
    }))
    setStockOpen(false)
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

  async function handleQuickCariSave() {
    if (!quickForm.name.trim()) { setQuickError('Cari adı zorunludur.'); return }
    setQuickLoading(true)
    setQuickError(null)
    const supabase = createClient()
    const { data, error: dbError } = await supabase
      .from('cariler')
      .insert({
        company_id: companyId,
        owner_id:   ownerId,
        name:       quickForm.name.trim(),
        cari_type:  quickForm.cari_type,
        cari_status: 'aktif',
      })
      .select('id, name, contact_name, phone, city')
      .single()
    if (dbError || !data) {
      setQuickError(dbError?.message ?? 'Cari oluşturulamadı.')
      setQuickLoading(false)
      return
    }
    const newCari: CariOption = { id: data.id, name: data.name, contact_name: data.contact_name, phone: data.phone, city: data.city }
    setLocalCariler(prev => [...prev, newCari])
    setCariId(data.id)
    setQuickForm({ name: '', cari_type: 'musteri' })
    setQuickOpen(false)
    setQuickLoading(false)
  }

  async function uploadItemImage(file: File, supabase: ReturnType<typeof createClient>): Promise<string | null> {
    const fileName = `${companyId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('order-images').upload(fileName, file)
    if (error) return null
    return fileName
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!isEdit && !cariId) {
      setError('Lütfen bir cari seçin veya yeni cari oluşturun.')
      return
    }

    setLoading(true)

    try {
    const supabase = createClient()

    // Stock availability pre-check — runs before insert so no order is created on failure
    if (!isEdit) {
      for (const item of items) {
        if (!item.stock_model_id) continue
        const rightNeeded = Number(item.right_opening_count) || 0
        const leftNeeded  = Number(item.left_opening_count)  || 0
        if (rightNeeded === 0 && leftNeeded === 0) continue

        const { data: stockModel } = await supabase
          .from('stock_models')
          .select('name, right_count, left_count')
          .eq('id', item.stock_model_id)
          .single()
        if (!stockModel) continue

        const rightAvail = stockModel.right_count ?? 0
        const leftAvail  = stockModel.left_count  ?? 0

        if (rightNeeded > 0 && rightAvail < rightNeeded) {
          setError(`Yetersiz sağ açılım stoğu:\n${stockModel.name}\nMevcut: ${rightAvail} · İstenen: ${rightNeeded}`)
          return
        }
        if (leftNeeded > 0 && leftAvail < leftNeeded) {
          setError(`Yetersiz sol açılım stoğu:\n${stockModel.name}\nMevcut: ${leftAvail} · İstenen: ${leftNeeded}`)
          return
        }
      }
    }

    // Upload per-item images
    const uploadedItems = [...items]
    for (let i = 0; i < uploadedItems.length; i++) {
      if (uploadedItems[i].image_file) {
        const path = await uploadItemImage(uploadedItems[i].image_file!, supabase)
        uploadedItems[i] = { ...uploadedItems[i], image_path: path }
      }
    }
    setItems(uploadedItems)

    // For new orders derive customer fields from selected cari
    let customerName  = form.customer_name
    let customerPhone = form.customer_phone
    let customerCity  = form.customer_city
    if (!isEdit && cariId) {
      const selectedCari = localCariler.find(c => c.id === cariId)
      if (selectedCari) {
        customerName  = selectedCari.contact_name || selectedCari.name
        customerPhone = selectedCari.phone ?? ''
        customerCity  = selectedCari.city  ?? ''
      }
    }

    const currentItems = uploadedItems
    const firstItem = currentItems[0] ?? {}
    const payload = {
      cari_id: cariId || (initialData?.cari_id ?? null),
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_city: customerCity,
      ...(!isEdit ? {
        door_type: (firstItem.door_type || 'celik_kapi') as DoorType,
        dimensions: firstItem.measurement || null,
      } : {}),
      quantity: currentItems.reduce((s, i) => s + Number(i.quantity), 0),
      unit_price: Number(firstItem.unit_price ?? 0),
      items: currentItems.map(({ image_file: _f, measurement_preset: _mp, door_type_custom: _dtc, lock_brand_custom: _lbc, lock_system_custom: _lsc, frame_color_custom: _fcc, ...rest }) => ({
        ...rest,
        door_type:   rest.door_type   === 'diger'  && _dtc?.trim() ? _dtc.trim() : rest.door_type,
        lock_brand:  rest.lock_brand  === 'DİĞER'  && _lbc?.trim() ? _lbc.trim() : rest.lock_brand,
        lock_system: rest.lock_system === 'DİĞER'  && _lsc?.trim() ? _lsc.trim() : rest.lock_system,
        frame_color: rest.frame_color === 'Diğer'  && _fcc?.trim() ? _fcc.trim() : rest.frame_color,
      })),
      notes: form.notes || null,
      deadline_date: (() => {
        const base = isEdit && initialData?.created_at
          ? new Date(initialData.created_at)
          : new Date()
        base.setDate(base.getDate() + form.production_duration_weeks * 7)
        return base.toISOString().split('T')[0]
      })(),
      lock_brand: firstItem.lock_brand || null,
      lock_system: firstItem.lock_system || null,
      frame_color: firstItem.frame_color || null,
      mdf_thickness: firstItem.mdf_thickness || null,
      mdf_thickness_other: null,
      steel_thickness: null,
      kdv_rate:              kdvRate,
      operation_note:        form.operation_note.trim()        || null,
      production_start_date: form.production_start_date        || null,
      ready_date:            form.ready_date                   || null,
      shipped_date:          form.shipped_date                 || null,
      delivered_date:        form.delivered_date               || null,
    }

    let dbError
    let newOrderId: string | null = null
    if (isEdit) {
      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId)
      dbError = error
    } else {
      const { data: newOrder, error } = await supabase.from('orders').insert({
        ...payload,
        company_id: companyId,
        owner_id:   ownerId,
        status:     'beklemede',
      }).select('id').single()
      dbError = error
      newOrderId = newOrder?.id ?? null

      if (!error) {
        for (const item of currentItems) {
          if (!item.stock_model_id) continue
          const { data: model } = await supabase
            .from('stock_models')
            .select('right_count, left_count')
            .eq('id', item.stock_model_id)
            .single()
          if (!model) continue
          await supabase
            .from('stock_models')
            .update({
              right_count: (model.right_count ?? 0) - Number(item.right_opening_count),
              left_count:  (model.left_count  ?? 0) - Number(item.left_opening_count),
            })
            .eq('id', item.stock_model_id)
        }
      }
    }

    if (dbError) {
      setError(`Hata: ${dbError.message}`)
      return
    }

    if (isEdit && orderId) {
      await syncOrderFinanceMovement(orderId)
    } else if (newOrderId) {
      await syncOrderFinanceMovement(newOrderId)
    }

    router.push('/orders')
    router.refresh()
    } catch {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const selectedCari = localCariler.find(c => c.id === cariId)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cari Seç — mandatory for new orders */}
      {!isEdit && (
        <fieldset className="rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <legend className="mb-3 text-sm font-semibold text-blue-800">
            Cari <span className="text-red-500">*</span>
          </legend>
          <div className="space-y-3">
            <div>
              <select
                value={cariId}
                onChange={e => setCariId(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Cari seçin —</option>
                {localCariler.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {selectedCari && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-blue-700">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  <span className="font-medium">{selectedCari.name}</span>
                  {selectedCari.contact_name && ` — ${selectedCari.contact_name}`}
                  {selectedCari.phone && ` · ${selectedCari.phone}`}
                  {selectedCari.city && ` · ${selectedCari.city}`}
                </span>
              </div>
            )}

            {/* Quick cari creation */}
            {!quickOpen ? (
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Yeni cari oluştur
              </button>
            ) : (
              <div className="rounded-lg border border-blue-200 bg-white p-4 space-y-3">
                <p className="text-xs font-semibold text-blue-800">Hızlı Cari Oluştur</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700">
                      Cari Adı <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={quickForm.name}
                      onChange={e => setQuickForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Firma veya kişi adı"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Cari Tipi</label>
                    <select
                      value={quickForm.cari_type}
                      onChange={e => setQuickForm(p => ({ ...p, cari_type: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="musteri">Müşteri</option>
                      <option value="tedarikci">Tedarikçi</option>
                      <option value="diger">Diğer</option>
                    </select>
                  </div>
                </div>
                {quickError && <p className="text-xs text-red-500">{quickError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleQuickCariSave}
                    disabled={quickLoading}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {quickLoading ? 'Kaydediliyor...' : 'Cariyi Kaydet ve Seç'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQuickOpen(false); setQuickError(null) }}
                    disabled={quickLoading}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
          </div>
        </fieldset>
      )}

      {/* Sorumlu Satıcı — only for admin on new orders */}
      {!isEdit && userRole === 'admin' && (
        <fieldset className="rounded-xl border border-purple-100 bg-purple-50 p-5 shadow-sm">
          <legend className="mb-3 text-sm font-semibold text-purple-800">Sorumlu Satıcı</legend>
          {staffList.length > 1 ? (
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-700">
              {staffList.find(s => s.id === ownerId)?.full_name ?? 'Yönetici'}
              <span className="ml-2 text-xs text-gray-400">(otomatik — sonradan değiştirilebilir)</span>
            </p>
          )}
        </fieldset>
      )}

      {/* Müşteri Bilgileri — only shown when editing */}
      {isEdit && (
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
      )}

      {/* Kapılar */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Kapılar</legend>
          <div className="space-y-5">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">{idx + 1}. Kapı</span>
                    {item.stock_model_id ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Stoktan</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Özel Üretim</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openStockPicker(idx)}
                      className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Stoktan Seç
                    </button>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        Kaldır
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Kapı Tipi</label>
                    <select
                      value={item.door_type}
                      onChange={e => updateItem(idx, 'door_type', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— Seçiniz —</option>
                      <option value="celik_kapi">Çelik Kapı</option>
                      <option value="villa_kapisi">Villa Kapısı</option>
                      <option value="yangin_kapisi">Yangın Kapısı</option>
                      <option value="menfezli_kapi">Menfezli Kapı</option>
                      <option value="panjurlu_kapi">Panjurlu Kapı</option>
                      <option value="diger">DİĞER</option>
                    </select>
                    {item.door_type === 'diger' && (
                      <input
                        type="text"
                        value={item.door_type_custom}
                        onChange={e => updateItem(idx, 'door_type_custom', e.target.value)}
                        placeholder="Kapı tipi girin"
                        className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Kapı Ölçüsü</label>
                    <select
                      value={item.measurement_preset}
                      onChange={e => updateItem(idx, 'measurement_preset', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— Seçiniz —</option>
                      <option value="standart">Standart (90x200x20)</option>
                      <option value="diger">Diğer</option>
                    </select>
                    {item.measurement_preset === 'diger' && (
                      <input
                        type="text"
                        value={item.measurement}
                        onChange={e => updateItem(idx, 'measurement', e.target.value)}
                        placeholder="Örn: 90x200x30"
                        className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Sağ / Sol Adet</label>
                    <div className="mt-1 flex gap-1.5">
                      <input
                        type="number" min={0}
                        value={item.right_opening_count}
                        onChange={e => updateItem(idx, 'right_opening_count', Number(e.target.value))}
                        placeholder="Sağ"
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="number" min={0}
                        value={item.left_opening_count}
                        onChange={e => updateItem(idx, 'left_opening_count', Number(e.target.value))}
                        placeholder="Sol"
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Adet</label>
                    <input
                      type="number"
                      readOnly
                      value={item.quantity}
                      className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 cursor-default"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Birim Fiyat (₺)</label>
                    <input
                      type="number" min={0} step="0.01"
                      value={item.unit_price}
                      onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Satır Toplam</label>
                    <div className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(item.quantity) * Number(item.unit_price))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Kilit Markası</label>
                    <select
                      value={item.lock_brand}
                      onChange={e => updateItem(idx, 'lock_brand', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— Seçiniz —</option>
                      <option value="KALE">KALE</option>
                      <option value="DAF">DAF</option>
                      <option value="HOK">HOK</option>
                      <option value="İTO">İTO</option>
                      <option value="TURSAN">TURSAN</option>
                      <option value="DİĞER">DİĞER</option>
                    </select>
                    {item.lock_brand === 'DİĞER' && (
                      <input
                        type="text"
                        value={item.lock_brand_custom}
                        onChange={e => updateItem(idx, 'lock_brand_custom', e.target.value)}
                        placeholder="Marka adı girin"
                        className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Kilit Sistemi</label>
                    <select
                      value={item.lock_system}
                      onChange={e => updateItem(idx, 'lock_system', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— Seçiniz —</option>
                      <option value="Monoblok">Monoblok</option>
                      <option value="Yarı Merkezi">Yarı Merkezi</option>
                      <option value="Tam Merkezi">Tam Merkezi</option>
                      <option value="DİĞER">DİĞER</option>
                    </select>
                    {item.lock_system === 'DİĞER' && (
                      <input
                        type="text"
                        value={item.lock_system_custom}
                        onChange={e => updateItem(idx, 'lock_system_custom', e.target.value)}
                        placeholder="Sistem adı girin"
                        className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Kasa Rengi</label>
                    <select
                      value={item.frame_color}
                      onChange={e => updateItem(idx, 'frame_color', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— Seçiniz —</option>
                      {FRAME_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="Diğer">DİĞER</option>
                    </select>
                    {item.frame_color === 'Diğer' && (
                      <input
                        type="text"
                        value={item.frame_color_custom}
                        onChange={e => updateItem(idx, 'frame_color_custom', e.target.value)}
                        placeholder="Renk girin"
                        className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">MDF Kalınlığı</label>
                    <select
                      value={item.mdf_thickness}
                      onChange={e => updateItem(idx, 'mdf_thickness', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— Seçiniz —</option>
                      <option value="8 mm">8 mm</option>
                      <option value="10 mm">10 mm</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Sac Kalınlığı (mm)</label>
                    <input
                      type="number" min={0} step="0.1"
                      value={item.sac_kalinligi}
                      onChange={e => updateItem(idx, 'sac_kalinligi', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Kanat Kalınlığı (mm)</label>
                    <input
                      type="number" min={0} step="0.1"
                      value={item.kanat_kalinligi}
                      onChange={e => updateItem(idx, 'kanat_kalinligi', e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-700">Görsel</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0] ?? null
                        setItems(prev => prev.map((it, i) => i === idx ? { ...it, image_file: file } : it))
                      }}
                      className="mt-1 block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                    />
                    {item.image_file && (
                      <p className="mt-1 text-xs text-green-600">{item.image_file.name}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setItems(prev => [...prev, blankItem()])}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              + Kapı Ekle
            </button>
          </div>

          {/* KDV ve Toplam Özeti */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">KDV Oranı</label>
              <select
                value={kdvRateSelect}
                onChange={e => setKdvRateSelect(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="20">%20</option>
                <option value="10">%10</option>
                <option value="1">%1</option>
                <option value="0">%0 (KDV'siz)</option>
                <option value="diger">Diğer</option>
              </select>
              {kdvRateSelect === 'diger' && (
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={kdvRateCustom}
                  onChange={e => setKdvRateCustom(e.target.value)}
                  placeholder="%"
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Ara Toplam</span>
                <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(itemsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>KDV ({kdvRate}%)</span>
                <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(kdvTutari)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-900">
                <span>Genel Toplam</span>
                <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(genelToplam)}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
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
        </fieldset>


      {/* Notlar */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Ek Bilgiler</legend>
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
      </fieldset>

      {/* Operasyon Takibi — edit only */}
      {isEdit && (
        <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <legend className="mb-4 text-sm font-semibold text-gray-700">Operasyon Takibi</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="production_start_date" className="block text-sm font-medium text-gray-700">
                Üretime Başlama Tarihi
              </label>
              <input
                id="production_start_date"
                name="production_start_date"
                type="date"
                value={form.production_start_date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="ready_date" className="block text-sm font-medium text-gray-700">
                Hazır Tarihi
              </label>
              <input
                id="ready_date"
                name="ready_date"
                type="date"
                value={form.ready_date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="shipped_date" className="block text-sm font-medium text-gray-700">
                Sevk Tarihi
              </label>
              <input
                id="shipped_date"
                name="shipped_date"
                type="date"
                value={form.shipped_date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="delivered_date" className="block text-sm font-medium text-gray-700">
                Teslim Tarihi
              </label>
              <input
                id="delivered_date"
                name="delivered_date"
                type="date"
                value={form.delivered_date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="operation_note" className="block text-sm font-medium text-gray-700">
                Operasyon Notu
              </label>
              <textarea
                id="operation_note"
                name="operation_note"
                rows={3}
                value={form.operation_note}
                onChange={handleChange}
                placeholder="Üretim, sevkiyat veya teslimata ilişkin notlar"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </fieldset>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 whitespace-pre-wrap">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push('/orders')}
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

      {/* Stock model picker modal */}
      {stockOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Stoktan Model Seç</h2>
              <button
                type="button"
                onClick={() => setStockOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {stockModels === null ? (
                <p className="py-8 text-center text-sm text-gray-400">Yükleniyor...</p>
              ) : stockModels.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  Henüz stok modeli yok.{' '}
                  <a href="/stock" target="_blank" className="text-blue-600 hover:underline">
                    Stok sayfasında ekleyebilirsiniz.
                  </a>
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {stockModels.map(m => {
                    const rightCount = m.right_count ?? 0
                    const leftCount  = m.left_count  ?? 0
                    const total      = rightCount + leftCount
                    const specs = [m.lock_brand, m.lock_system, m.frame_color, m.mdf_thickness].filter(Boolean)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => applyStockModel(m)}
                        className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-50 hover:shadow-sm"
                      >
                        {/* Görsel */}
                        {m.image_url && (
                          <img
                            src={m.image_url}
                            alt={m.name}
                            className="mb-2 h-28 w-full rounded-md object-contain bg-gray-50"
                          />
                        )}
                        <p className="font-bold text-sm text-gray-900">{m.name}</p>
                        {m.door_type && (
                          <p className="text-xs text-blue-600 mt-0.5">{m.door_type}</p>
                        )}
                        {m.measurement && (
                          <p className="text-xs text-gray-400 mt-0.5">{m.measurement}</p>
                        )}
                        <div className="mt-1.5 text-xs text-gray-700 font-medium">
                          Toplam: {total} &nbsp;·&nbsp; Sağ: {rightCount} | Sol: {leftCount}
                        </div>
                        {specs.length > 0 && (
                          <p className="mt-1 text-xs text-gray-400 truncate">{specs.join(' · ')}</p>
                        )}
                        {(m.price ?? 0) > 0 && (
                          <p className="mt-1.5 text-sm font-bold text-green-700">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(m.price!)}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
