'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { Cari } from '@/src/types'

interface Props {
  cari: Cari
  companyId: string
}

export default function EditCariForm({ cari, companyId }: Props) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    firma_adi:      cari.name,
    yetkili_adi:    cari.contact_name ?? '',
    telefon:        cari.phone ?? '',
    email:          cari.email ?? '',
    sehir:          cari.city ?? '',
    adres:          cari.address ?? '',
    vergi_dairesi:  cari.tax_office ?? '',
    vergi_no:       cari.tax_number ?? '',
    cari_tipi:      cari.cari_type,
    notes:          cari.notes ?? '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

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

    setLoading(true)
    const supabase = createClient()

    const { error: dbError } = await supabase
      .from('cariler')
      .update({
        name:         form.firma_adi,
        contact_name: form.yetkili_adi || null,
        phone:        form.telefon || null,
        email:        form.email || null,
        city:         form.sehir || null,
        address:      form.adres || null,
        tax_office:   form.vergi_dairesi || null,
        tax_number:   form.vergi_no || null,
        cari_type:    form.cari_tipi,
        notes:        form.notes || null,
      })
      .eq('id', cari.id)
      .eq('company_id', companyId)

    if (dbError) {
      setError(`Hata: ${dbError.message}`)
      setLoading(false)
      return
    }

    router.push(`/cari/${cari.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notlar
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              value={form.notes}
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
          onClick={() => router.push(`/cari/${cari.id}`)}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          İptal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </form>
  )
}
