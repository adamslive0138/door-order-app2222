'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

interface StaffMember {
  id: string
  full_name: string | null
}

interface Props {
  companyId: string
  userId: string
  userRole?: string
  staffList?: StaffMember[]
}

interface OcrCariData {
  firma_adi?: string | null
  telefon?: string | null
  vergi_no?: string | null
  vergi_dairesi?: string | null
  adres?: string | null
  sehir?: string | null
}

export default function CariForm({ companyId, userId, userRole, staffList = [] }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ownerId, setOwnerId] = useState(userId)
  const [belgeFile, setBelgeFile] = useState<File | null>(null)
  const [belgePreview, setBelgePreview] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrData, setOcrData] = useState<OcrCariData | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)

  const [form, setForm] = useState({
    firma_adi: '',
    yetkili_adi: '',
    telefon: '',
    email: '',
    sehir: '',
    adres: '',
    vergi_dairesi: '',
    vergi_no: '',
    tc_no: '',
    cari_tipi: 'musteri' as 'musteri' | 'tedarikci' | 'her_ikisi',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleBelgeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setBelgeFile(file)
    setOcrData(null)
    setOcrError(null)
    if (file) {
      setBelgePreview(URL.createObjectURL(file))
    } else {
      setBelgePreview(null)
    }
  }

  async function handleOcr() {
    if (!belgeFile) return
    setOcrLoading(true)
    setOcrError(null)
    setOcrData(null)

    try {
      const base64 = await fileToBase64(belgeFile)
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: belgeFile.type,
          type: 'cari',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setOcrError(json.error ?? 'Metin çıkarılamadı')
      } else {
        setOcrData(json.data)
      }
    } catch {
      setOcrError('OCR işlemi başarısız oldu')
    } finally {
      setOcrLoading(false)
    }
  }

  function applyOcrData() {
    if (!ocrData) return
    setForm((prev) => ({
      ...prev,
      firma_adi: ocrData.firma_adi ?? prev.firma_adi,
      telefon: ocrData.telefon ?? prev.telefon,
      vergi_no: ocrData.vergi_no ?? prev.vergi_no,
      vergi_dairesi: ocrData.vergi_dairesi ?? prev.vergi_dairesi,
      adres: ocrData.adres ?? prev.adres,
      sehir: ocrData.sehir ?? prev.sehir,
    }))
    setOcrData(null)
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // Validation
    if (form.telefon) {
      const digits = form.telefon.replace(/\D/g, '')
      if (digits.length !== 11) {
        setError('Telefon numarası tam olarak 11 rakam olmalıdır (örn: 05XXXXXXXXX).')
        return
      }
    }
    if (form.vergi_no) {
      const digits = form.vergi_no.replace(/\D/g, '')
      if (digits.length !== 10) {
        setError('Vergi numarası tam olarak 10 rakam olmalıdır.')
        return
      }
    }
    if (form.tc_no) {
      const digits = form.tc_no.replace(/\D/g, '')
      if (digits.length !== 11) {
        setError('TC kimlik numarası tam olarak 11 rakam olmalıdır.')
        return
      }
    }

    setLoading(true)

    const supabase = createClient()

    let belge_url: string | null = null
    if (belgeFile) {
      const ext = belgeFile.name.split('.').pop()
      const path = `${companyId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('cari-images')
        .upload(path, belgeFile, { upsert: false })

      if (uploadError) {
        setError(`Belge yüklenemedi: ${uploadError.message}`)
        setLoading(false)
        return
      }
      const { data: urlData } = supabase.storage.from('cari-images').getPublicUrl(path)
      belge_url = urlData.publicUrl
    }

    const { error: dbError } = await supabase.from('cariler').insert({
      company_id: companyId,
      owner_id:   ownerId,
      name: form.firma_adi,
      contact_name: form.yetkili_adi || null,
      phone: form.telefon || null,
      email: form.email || null,
      city: form.sehir || null,
      address: form.adres || null,
      tax_office: form.vergi_dairesi || null,
      tax_number: form.vergi_no || null,
      tc_no: form.tc_no || null,
      cari_type: form.cari_tipi,
      image_url: belge_url,
    })

    if (dbError) {
      setError(`Hata: ${dbError.message}`)
      setLoading(false)
      return
    }

    router.push('/cari')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Sorumlu Satıcı — only for admin */}
      {userRole === 'admin' && (
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

      {/* Belge Yükleme & OCR */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">
          Belge Yükleme (Kaşe / Firma Bilgisi)
        </legend>
        <div className="space-y-3">
          <div>
            <label htmlFor="belge" className="block text-sm font-medium text-gray-700">
              Firma belgesi veya kaşe görseli
            </label>
            <input
              id="belge"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleBelgeChange}
              className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>

          {belgePreview && (
            <div className="flex items-start gap-4">
              <img
                src={belgePreview}
                alt="Belge önizleme"
                className="h-32 w-48 rounded-lg border border-gray-200 object-contain bg-gray-50"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleOcr}
                  disabled={ocrLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {ocrLoading ? 'Okunuyor...' : 'Metni Çıkar ve Doldur'}
                </button>
                <p className="text-xs text-gray-400">
                  Belgeden firma bilgileri otomatik çıkarılır.
                </p>
              </div>
            </div>
          )}

          {ocrError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{ocrError}</p>
          )}

          {ocrData && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="mb-3 text-sm font-semibold text-indigo-800">
                Belgeden çıkarılan bilgiler:
              </p>
              <div className="grid gap-1 text-sm text-indigo-700">
                {ocrData.firma_adi && <p><span className="font-medium">Firma:</span> {ocrData.firma_adi}</p>}
                {ocrData.telefon && <p><span className="font-medium">Telefon:</span> {ocrData.telefon}</p>}
                {ocrData.vergi_no && <p><span className="font-medium">Vergi No:</span> {ocrData.vergi_no}</p>}
                {ocrData.vergi_dairesi && <p><span className="font-medium">Vergi Dairesi:</span> {ocrData.vergi_dairesi}</p>}
                {ocrData.sehir && <p><span className="font-medium">Şehir:</span> {ocrData.sehir}</p>}
                {ocrData.adres && <p><span className="font-medium">Adres:</span> {ocrData.adres}</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={applyOcrData}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Formu Doldur
                </button>
                <button
                  type="button"
                  onClick={() => setOcrData(null)}
                  className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Yoksay
                </button>
              </div>
            </div>
          )}
        </div>
      </fieldset>

      {/* Firma Bilgileri */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">Firma Bilgileri</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="firma_adi" className="block text-sm font-medium text-gray-700">
              Firma Adı <span className="text-red-500">*</span>
            </label>
            <input
              id="firma_adi"
              name="firma_adi"
              type="text"
              required
              value={form.firma_adi}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="yetkili_adi" className="block text-sm font-medium text-gray-700">
              Yetkili Adı
            </label>
            <input
              id="yetkili_adi"
              name="yetkili_adi"
              type="text"
              value={form.yetkili_adi}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="cari_tipi" className="block text-sm font-medium text-gray-700">
              Cari Tipi <span className="text-red-500">*</span>
            </label>
            <select
              id="cari_tipi"
              name="cari_tipi"
              required
              value={form.cari_tipi}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="musteri">Müşteri</option>
              <option value="tedarikci">Tedarikçi</option>
              <option value="her_ikisi">Her İkisi</option>
            </select>
          </div>

          <div>
            <label htmlFor="telefon" className="block text-sm font-medium text-gray-700">
              Telefon
            </label>
            <input
              id="telefon"
              name="telefon"
              type="text"
              inputMode="numeric"
              maxLength={11}
              placeholder="05XXXXXXXXX"
              value={form.telefon}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              E-Posta
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="sehir" className="block text-sm font-medium text-gray-700">
              Şehir
            </label>
            <input
              id="sehir"
              name="sehir"
              type="text"
              value={form.sehir}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="vergi_dairesi" className="block text-sm font-medium text-gray-700">
              Vergi Dairesi
            </label>
            <input
              id="vergi_dairesi"
              name="vergi_dairesi"
              type="text"
              value={form.vergi_dairesi}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="vergi_no" className="block text-sm font-medium text-gray-700">
              Vergi No
            </label>
            <input
              id="vergi_no"
              name="vergi_no"
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="10 haneli vergi numarası"
              value={form.vergi_no}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="tc_no" className="block text-sm font-medium text-gray-700">
              TC Kimlik No
            </label>
            <input
              id="tc_no"
              name="tc_no"
              type="text"
              inputMode="numeric"
              maxLength={11}
              placeholder="11 haneli TC kimlik numarası"
              value={form.tc_no}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="adres" className="block text-sm font-medium text-gray-700">
              Adres
            </label>
            <textarea
              id="adres"
              name="adres"
              rows={2}
              value={form.adres}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push('/cari')}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          İptal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Kaydediliyor...' : 'Cari Kaydet'}
        </button>
      </div>
    </form>
  )
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
