'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import { ODEME_YONTEMI_OPTIONS } from '@/src/types'

interface CariOption {
  id: string
  name: string
}

interface Props {
  companyId: string
  userId: string
  cariler: CariOption[]
  defaultType: 'tahsilat' | 'odeme'
  defaultCariId?: string
}

export default function HareketForm({ companyId, userId, cariler, defaultType, defaultCariId }: Props) {
  const router = useRouter()

  const preselectedCari = defaultCariId
    ? (cariler.find(c => c.id === defaultCariId) ?? null)
    : null

  const [type,            setType]            = useState<'tahsilat' | 'odeme'>(defaultType)
  const [cariId,          setCariId]          = useState(preselectedCari?.id ?? '')
  const [amount,          setAmount]          = useState('')
  const [paymentMethod,   setPaymentMethod]   = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [description,     setDescription]     = useState('')
  const [receiptFile,     setReceiptFile]     = useState<File | null>(null)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [submitted,       setSubmitted]       = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const isIn     = type === 'tahsilat'
  const btnCls   = isIn
    ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
    : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
  const typeBorder = (t: 'tahsilat' | 'odeme') => type === t
    ? t === 'tahsilat'
      ? 'border-green-500 bg-green-50 text-green-700'
      : 'border-red-500 bg-red-50 text-red-700'
    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      setError('Geçerli bir tutar giriniz.')
      return
    }
    if (!cariId) {
      setError('Listeden bir cari seçiniz.')
      return
    }

    setLoading(true)

    try {
    const supabase = createClient()

    // Upload receipt if provided
    let receiptUrl: string | null = null
    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop() ?? 'jpg'
      const path = `${companyId}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(path, receiptFile, { upsert: false })
      if (uploadErr) {
        setError(`Dekont yükleme hatası: ${uploadErr.message}`)
        return
      }
      receiptUrl = uploadData.path
    }

    if (type === 'tahsilat') {
      const { error: dbErr } = await supabase.from('payment_approvals').insert({
        company_id:     companyId,
        owner_id:       userId,
        cari_id:        cariId,
        amount:         amt,
        payment_method: paymentMethod || null,
        description:    description.trim() || null,
        receipt_path:   receiptUrl,
        status:         'pending',
      })
      if (dbErr) {
        setError(`Kayıt hatası: ${dbErr.message}`)
        return
      }
      setSubmitted(true)
      return
    }

    const { error: dbErr } = await supabase.from('cari_hareketler').insert({
      company_id:       companyId,
      cari_id:          cariId,
      transaction_type: type,
      amount:           amt,
      payment_method:   paymentMethod || null,
      transaction_date: transactionDate || null,
      description:      description.trim() || null,
      receipt_url:      receiptUrl,
    })

    if (dbErr) {
      setError(`Kayıt hatası: ${dbErr.message}`)
      return
    }

    router.push(`/finance/${type}`)
    router.refresh()
    } catch {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
        <div className="px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mb-1 text-base font-semibold text-amber-800">Tahsilat Onay Bekliyor</h2>
          <p className="mb-6 text-sm text-amber-700">
            Tahsilatınız yönetici onayına gönderildi. Onaylandığında bakiyeye yansıyacaktır.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => { setSubmitted(false); setAmount(''); setDescription(''); setReceiptFile(null); setPaymentMethod('') }}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors"
            >
              Yeni Tahsilat
            </button>
            <button
              type="button"
              onClick={() => router.push('/finance/tahsilat')}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              Tahsilatlara Dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Transaction type toggle */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">İşlem Türü</p>
        </div>
        <div className="flex gap-3 p-5">
          <button
            type="button"
            onClick={() => setType('tahsilat')}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 py-4 text-sm font-semibold transition-colors ${typeBorder('tahsilat')}`}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tahsilat
            <span className="text-xs font-normal opacity-60">Gelen para</span>
          </button>
          <button
            type="button"
            onClick={() => setType('odeme')}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 py-4 text-sm font-semibold transition-colors ${typeBorder('odeme')}`}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
            Ödeme
            <span className="text-xs font-normal opacity-60">Giden para</span>
          </button>
        </div>
      </div>

      {/* Cari */}
      <fieldset className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">Cari Seçimi</p>
        </div>
        <div className="p-5">
          <label htmlFor="cari-select" className="mb-1.5 block text-sm font-medium text-gray-700">
            Cari <span className="text-red-500">*</span>
          </label>
          {preselectedCari ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
              <svg className="h-4 w-4 shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="flex-1 text-sm font-medium text-green-800">{preselectedCari.name}</span>
              <span className="text-xs text-green-500">Kilitli</span>
            </div>
          ) : (
            <select
              id="cari-select"
              value={cariId}
              onChange={e => setCariId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Cari seçin —</option>
              {cariler.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </fieldset>

      {/* Transaction details */}
      <fieldset className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">İşlem Detayları</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">

          <div>
            <label htmlFor="amount" className="mb-1 block text-sm font-medium text-gray-700">
              Tutar (₺) <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="payment-method" className="mb-1 block text-sm font-medium text-gray-700">
              Ödeme Yöntemi
            </label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Seçiniz —</option>
              {ODEME_YONTEMI_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="transaction-date" className="mb-1 block text-sm font-medium text-gray-700">
              İşlem Tarihi
            </label>
            <input
              id="transaction-date"
              type="date"
              value={transactionDate}
              onChange={e => setTransactionDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              Açıklama
            </label>
            <textarea
              id="description"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="İşlem açıklaması..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Receipt upload */}
      <fieldset className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">Dekont</p>
          <p className="mt-0.5 text-xs text-gray-400">İsteğe bağlı — fatura veya makbuz yükleyin</p>
        </div>
        <div className="p-5">
          {receiptFile ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="flex-1 truncate text-sm text-green-700">{receiptFile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setReceiptFile(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="text-sm text-green-600 transition-colors hover:text-red-600"
              >
                Kaldır
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-8 transition-colors hover:border-gray-300 hover:bg-gray-50">
              <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-gray-400">Dosya seç veya sürükle</span>
              <span className="text-xs text-gray-300">PDF, JPG, PNG — maks. 10 MB</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
      </fieldset>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          İptal
        </button>
        <button
          type="submit"
          disabled={loading}
          className={`flex-1 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-colors ${btnCls}`}
        >
          {loading
            ? 'Kaydediliyor...'
            : isIn ? 'Tahsilatı Kaydet' : 'Ödemeyi Kaydet'}
        </button>
      </div>
    </form>
  )
}
