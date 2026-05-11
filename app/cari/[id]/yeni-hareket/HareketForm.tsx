'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

interface Props {
  companyId: string
  userId: string
  cariId: string
  cariAdi: string
}

export default function HareketForm({ companyId, userId, cariId, cariAdi }: Props) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState({
    transaction_type: 'tahsilat' as 'tahsilat' | 'odeme' | 'alacak' | 'borc',
    amount: '',
    description: '',
    payment_method: '',
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      setError('Geçerli bir tutar giriniz.')
      return
    }

    setLoading(true)

    try {
    const supabase = createClient()

    // Tahsilat → payment_approvals (onay bekler)
    if (form.transaction_type === 'tahsilat') {
      let receiptPath: string | null = null

      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop()
        const filePath = `${companyId}/payment-approvals/${Date.now()}.${ext}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile, { upsert: false })
        if (uploadErr || !uploadData) {
          setError(`Dekont yüklenemedi: ${uploadErr?.message ?? 'Bilinmeyen hata'}`)
          return
        }
        receiptPath = uploadData.path
      }

      const { error: dbError } = await supabase.from('payment_approvals').insert({
        company_id:     companyId,
        owner_id:       userId,
        cari_id:        cariId,
        amount,
        payment_method: form.payment_method || null,
        description:    form.description || null,
        receipt_path:   receiptPath,
        status:         'pending',
      })

      if (dbError) {
        setError(`Hata: ${dbError.message}`)
        return
      }

      setSuccess('Tahsilat onaya gönderildi. Admin onayladığında cari hareketine eklenecek.')
      setForm({ transaction_type: 'tahsilat', amount: '', description: '', payment_method: '' })
      setReceiptFile(null)
      return
    }

    // Diğer işlem tipleri direkt cari_hareketler'e
    const { error: dbError } = await supabase.from('cari_hareketler').insert({
      company_id:       companyId,
      cari_id:          cariId,
      transaction_type: form.transaction_type,
      amount,
      description:      form.description || null,
    })

    if (dbError) {
      setError(`Hata: ${dbError.message}`)
      return
    }

    router.push(`/cari/${cariId}`)
    router.refresh()
    } catch {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const isTahsilat = form.transaction_type === 'tahsilat'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="mb-4 text-sm font-semibold text-gray-700">
          Hareket Bilgileri — {cariAdi}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="transaction_type" className="block text-sm font-medium text-gray-700">
              İşlem Tipi <span className="text-red-500">*</span>
            </label>
            <select
              id="transaction_type"
              name="transaction_type"
              required
              value={form.transaction_type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="alacak">Satış / Alacak</option>
              <option value="borc">Alış / Borç</option>
              <option value="tahsilat">Tahsilat (Nakit Giriş)</option>
              <option value="odeme">Ödeme (Nakit Çıkış)</option>
            </select>
            {isTahsilat && (
              <p className="mt-1 text-xs text-amber-600">
                Tahsilatlar admin onayına gönderilir.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Tutar (₺) <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.amount}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {isTahsilat && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Ödeme Yöntemi</label>
              <select
                name="payment_method"
                value={form.payment_method}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Seçiniz —</option>
                <option value="nakit">Nakit</option>
                <option value="havale">Havale / EFT</option>
                <option value="kart">Kredi/Banka Kartı</option>
                <option value="cek">Çek</option>
              </select>
            </div>
          )}

          {isTahsilat && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Dekont</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Açıklama
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              value={form.description}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {success}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => router.push(`/cari/${cariId}`)}
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Geri Dön
            </button>
          </div>
        </div>
      )}

      {!success && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/cari/${cariId}`)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Kaydediliyor...' : isTahsilat ? 'Onaya Gönder' : 'Hareketi Kaydet'}
          </button>
        </div>
      )}
    </form>
  )
}
