'use client'

import { useState } from 'react'
import { createClient } from '@/src/lib/supabase/client'

export interface StockModel {
  id: string
  company_id: string
  name: string
  image_url: string | null
  measurement: string | null
  right_count: number | null
  left_count: number | null
  door_type: string | null
  lock_brand: string | null
  lock_system: string | null
  frame_color: string | null
  mdf_thickness: string | null
  sheet_thickness: string | null
  wing_thickness: string | null
  price: number | null
  notes: string | null
  created_at: string
}

const DOOR_LABELS: Record<string, string> = {
  celik_kapi:    'Çelik Kapı',
  villa_kapisi:  'Villa Kapısı',
  yangin_kapisi: 'Yangın Kapısı',
  menfezli_kapi: 'Menfezli Kapı',
  panjurlu_kapi: 'Panjurlu Kapı',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

interface Props {
  companyId: string
  initialModels: StockModel[]
  canEdit: boolean
  storageUrl: string
}

const BLANK_FORM = {
  name: '',
  measurement: '',
  right_count: 0,
  left_count: 0,
  door_type: '',
  lock_brand: '',
  lock_system: '',
  frame_color: '',
  mdf_thickness: '',
  sheet_thickness: '',
  wing_thickness: '',
  price: 0,
  notes: '',
}

export default function StockPage({ companyId, initialModels, canEdit, storageUrl }: Props) {
  const [models, setModels] = useState<StockModel[]>(initialModels)
  const [showModal, setShowModal] = useState(false)
  const [editModel, setEditModel] = useState<StockModel | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    const numericFields = ['right_count', 'left_count', 'price']
    setForm(p => ({ ...p, [name]: numericFields.includes(name) ? Number(value) : value }))
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function openModal() {
    setEditModel(null)
    setForm(BLANK_FORM)
    setImageFile(null)
    setImagePreview(null)
    setError(null)
    setShowModal(true)
  }

  function openEditModal(model: StockModel) {
    setEditModel(model)
    setForm({
      name:            model.name,
      measurement:     model.measurement     ?? '',
      right_count:     model.right_count     ?? 0,
      left_count:      model.left_count      ?? 0,
      door_type:       model.door_type       ?? '',
      lock_brand:      model.lock_brand      ?? '',
      lock_system:     model.lock_system     ?? '',
      frame_color:     model.frame_color     ?? '',
      mdf_thickness:   model.mdf_thickness   ?? '',
      sheet_thickness: model.sheet_thickness ?? '',
      wing_thickness:  model.wing_thickness  ?? '',
      price:           model.price           ?? 0,
      notes:           model.notes           ?? '',
    })
    setImageFile(null)
    setImagePreview(model.image_url)
    setError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditModel(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Model adı zorunludur.'); return }
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // Upload new image if selected
    let newImageUrl: string | undefined
    if (imageFile) {
      const ext  = imageFile.name.split('.').pop() ?? 'jpg'
      const path = `${companyId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('stock-models').upload(path, imageFile)
      if (upErr) { setError('Görsel yüklenemedi: ' + upErr.message); setLoading(false); return }
      newImageUrl = `${storageUrl}/storage/v1/object/public/stock-models/${path}`
    }

    const payload = {
      name:            form.name.trim(),
      measurement:     form.measurement.trim()     || null,
      right_count:     form.right_count            || 0,
      left_count:      form.left_count             || 0,
      door_type:       form.door_type              || null,
      lock_brand:      form.lock_brand.trim()      || null,
      lock_system:     form.lock_system.trim()     || null,
      frame_color:     form.frame_color.trim()     || null,
      mdf_thickness:   form.mdf_thickness.trim()   || null,
      sheet_thickness: form.sheet_thickness.trim() || null,
      wing_thickness:  form.wing_thickness.trim()  || null,
      price:           form.price                  || null,
      notes:           form.notes.trim()           || null,
    }

    if (editModel) {
      const { data: updated, error: dbErr } = await supabase
        .from('stock_models')
        .update({ ...payload, ...(newImageUrl ? { image_url: newImageUrl } : {}) })
        .eq('id', editModel.id)
        .select('*')
        .single()

      if (dbErr || !updated) {
        setError(dbErr?.message ?? 'Güncellenemedi.')
        setLoading(false)
        return
      }

      setModels(p => p.map(m => m.id === editModel.id ? (updated as StockModel) : m))
    } else {
      const { data: inserted, error: dbErr } = await supabase
        .from('stock_models')
        .insert({ ...payload, company_id: companyId, image_url: newImageUrl ?? null })
        .select('*')
        .single()

      if (dbErr || !inserted) {
        setError(dbErr?.message ?? 'Kayıt oluşturulamadı.')
        setLoading(false)
        return
      }

      setModels(p => [inserted as StockModel, ...p])
    }

    setLoading(false)
    closeModal()
  }

  async function handleDelete(id: string) {
    const model = models.find(m => m.id === id)
    const supabase = createClient()

    if (model?.image_url) {
      const prefix = `${storageUrl}/storage/v1/object/public/stock-models/`
      if (model.image_url.startsWith(prefix)) {
        const path = model.image_url.slice(prefix.length)
        await supabase.storage.from('stock-models').remove([path])
      }
    }

    await supabase.from('stock_models').delete().eq('id', id)
    setModels(p => p.filter(m => m.id !== id))
    setDeleteId(null)
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Stok / Modeller</h1>
          <p className="mt-0.5 text-sm text-gray-500">{models.length} hazır model</p>
        </div>
        {canEdit && (
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Model Ekle
          </button>
        )}
      </div>

      {/* Grid */}
      {models.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">Henüz model eklenmemiş.</p>
          {canEdit && (
            <button onClick={openModal} className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
              + İlk modeli ekle
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {models.map(m => (
            <ModelCard
              key={m.id}
              model={m}
              canEdit={canEdit}
              onEdit={() => openEditModal(m)}
              onDelete={() => setDeleteId(m.id)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {editModel ? 'Modeli Düzenle' : 'Yeni Model Ekle'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Model Adı <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="Örn: Klasik Çelik Kapı"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Görsel</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mt-1 block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
                {imagePreview && (
                  <img src={imagePreview} alt="Önizleme" className="mt-2 h-24 w-auto rounded-lg object-cover" />
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kapı Tipi</label>
                  <select
                    name="door_type"
                    value={form.door_type}
                    onChange={handleFormChange}
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">— Seçiniz —</option>
                    <option value="celik_kapi">Çelik Kapı</option>
                    <option value="villa_kapisi">Villa Kapısı</option>
                    <option value="yangin_kapisi">Yangın Kapısı</option>
                    <option value="menfezli_kapi">Menfezli Kapı</option>
                    <option value="panjurlu_kapi">Panjurlu Kapı</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Ölçü</label>
                  <input
                    name="measurement"
                    type="text"
                    value={form.measurement}
                    onChange={handleFormChange}
                    placeholder="Örn: 90x200x20"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Sağ Adet</label>
                  <input
                    name="right_count"
                    type="number"
                    min={0}
                    value={form.right_count}
                    onChange={handleFormChange}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Sol Adet</label>
                  <input
                    name="left_count"
                    type="number"
                    min={0}
                    value={form.left_count}
                    onChange={handleFormChange}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Ürün Fiyatı (₺)</label>
                  <input
                    name="price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price}
                    onChange={handleFormChange}
                    placeholder="0"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Kilit Markası</label>
                  <input
                    name="lock_brand"
                    type="text"
                    value={form.lock_brand}
                    onChange={handleFormChange}
                    placeholder="KALE, DAF..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Kilit Sistemi</label>
                  <input
                    name="lock_system"
                    type="text"
                    value={form.lock_system}
                    onChange={handleFormChange}
                    placeholder="Monoblok, Tam Merkezi..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Kasa Rengi</label>
                  <input
                    name="frame_color"
                    type="text"
                    value={form.frame_color}
                    onChange={handleFormChange}
                    placeholder="Antrasit, Beyaz..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">MDF Kalınlığı</label>
                  <input
                    name="mdf_thickness"
                    type="text"
                    value={form.mdf_thickness}
                    onChange={handleFormChange}
                    placeholder="8 mm, 10 mm..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Sac Kalınlığı</label>
                  <input
                    name="sheet_thickness"
                    type="text"
                    value={form.sheet_thickness}
                    onChange={handleFormChange}
                    placeholder="1.2, 1.5..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Kanat Kalınlığı</label>
                  <input
                    name="wing_thickness"
                    type="text"
                    value={form.wing_thickness}
                    onChange={handleFormChange}
                    placeholder="60, 70 mm..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Not</label>
                <textarea
                  name="notes"
                  rows={2}
                  value={form.notes}
                  onChange={handleFormChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {loading ? 'Kaydediliyor...' : editModel ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900">Model silinsin mi?</h3>
            <p className="mt-1 text-sm text-gray-500">Bu işlem geri alınamaz.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ── Model Card ────────────────────────────────────────────────────────────────

function ModelCard({
  model,
  canEdit,
  onEdit,
  onDelete,
}: {
  model: StockModel
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const rightCount = model.right_count ?? 0
  const leftCount  = model.left_count  ?? 0
  const total      = rightCount + leftCount

  const specs = [
    model.lock_brand,
    model.lock_system,
    model.frame_color,
    model.mdf_thickness,
  ].filter(Boolean)

  return (
    <div className="group relative w-[260px] rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">

      {/* Image */}
      <div className="flex h-[320px] items-center justify-center bg-gray-100 p-2">
        {model.image_url ? (
          <img
            src={model.image_url}
            alt={model.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <svg className="h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-2">
        <p className="text-base font-bold text-gray-900 leading-tight">{model.name}</p>

        {model.door_type && (
          <p className="text-xs font-medium text-blue-600">
            {DOOR_LABELS[model.door_type] ?? model.door_type}
          </p>
        )}

        {model.measurement && (
          <p className="text-xs text-gray-400">{model.measurement}</p>
        )}

        <div className="pt-1 border-t border-gray-100">
          <p className="text-sm font-bold text-gray-800">Toplam Stok: {total}</p>
          <p className="mt-0.5 text-xs text-gray-600">
            Sağ: <span className="font-semibold">{rightCount}</span>
            {' '}|{' '}
            Sol: <span className="font-semibold">{leftCount}</span>
          </p>
        </div>

        {specs.length > 0 && (
          <p className="text-xs text-gray-400 truncate">{specs.join(' · ')}</p>
        )}

        {(model.price ?? 0) > 0 && (
          <p className="text-base font-bold text-green-700">{fmt(model.price!)}</p>
        )}

        {model.notes && (
          <p className="text-xs text-gray-400 italic line-clamp-2">{model.notes}</p>
        )}
      </div>

      {/* Edit / Delete — admin only, visible on hover */}
      {canEdit && (
        <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
          <button
            onClick={onEdit}
            className="rounded-md bg-white/90 p-1 text-gray-400 shadow-sm hover:text-blue-600 transition-colors"
            title="Düzenle"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded-md bg-white/90 p-1 text-gray-400 shadow-sm hover:text-red-600 transition-colors"
            title="Sil"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
