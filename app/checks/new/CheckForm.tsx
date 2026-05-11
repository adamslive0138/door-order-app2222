'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

interface CariOption {
  id: string
  name: string
}

interface Props {
  companyId: string
  userId: string
  cariler: CariOption[]
}

const STATUS_OPTIONS = [
  { value: 'portfoy',        label: 'Portföyde' },
  { value: 'devredildi',     label: 'Devredildi' },
  { value: 'tahsil_edildi',  label: 'Tahsil Edildi' },
  { value: 'iade',           label: 'İade' },
]

export default function CheckForm({ companyId, userId, cariler }: Props) {
  const router = useRouter()

  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const [frontImagePath,  setFrontImagePath]  = useState<string | null>(null)
  const [backImagePath,   setBackImagePath]   = useState<string | null>(null)
  const [uploadingFront,  setUploadingFront]  = useState(false)
  const [uploadingBack,   setUploadingBack]   = useState(false)

  const [direction,      setDirection]      = useState<'alindi' | 'verildi'>('alindi')
  const [sourceCariId,   setSourceCariId]   = useState('')
  const [targetCariId,   setTargetCariId]   = useState('')
  const [checkStatus,    setCheckStatus]    = useState('portfoy')
  const [checkNo,        setCheckNo]        = useState('')
  const [bankName,       setBankName]       = useState('')
  const [branchName,     setBranchName]     = useState('')
  const [accountNo,      setAccountNo]      = useState('')
  const [amount,         setAmount]         = useState('')
  const [dueDate,        setDueDate]        = useState('')
  const [issueDate,      setIssueDate]      = useState(new Date().toISOString().slice(0, 10))
  const [description,    setDescription]    = useState('')

  async function uploadImage(file: File, side: 'front' | 'back') {
    const setUploading = side === 'front' ? setUploadingFront : setUploadingBack
    const setPath      = side === 'front' ? setFrontImagePath : setBackImagePath
    setUploading(true)
    const path = `${companyId}/${Date.now()}-${side}.jpg`
    const supabase = createClient()
    const { error: upErr } = await supabase.storage
      .from('check-images')
      .upload(path, file, { upsert: true })
    setUploading(false)
    if (upErr) { setError(`Fotoğraf yüklenemedi: ${upErr.message}`); return }
    setPath(path)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      setError('Geçerli bir tutar giriniz.')
      return
    }
    if (!sourceCariId) {
      setError('Çekin alındığı cariyi seçiniz.')
      return
    }
    if (!dueDate) {
      setError('Vade tarihini giriniz.')
      return
    }

    setLoading(true)

    try {
    const supabase = createClient()

    const { error: dbErr } = await supabase.from('checks').insert({
      company_id:      companyId,
      owner_id:        userId,
      check_direction: direction,
      check_status:    checkStatus,
      source_cari_id:  sourceCariId || null,
      target_cari_id:  targetCariId || null,
      check_no:        checkNo.trim() || null,
      bank_name:       bankName.trim() || null,
      branch_name:     branchName.trim() || null,
      account_no:      accountNo.trim() || null,
      amount:            amt,
      due_date:          dueDate,
      issue_date:        issueDate || null,
      description:       description.trim() || null,
      front_image_path:  frontImagePath,
      back_image_path:   backImagePath,
    })

    if (dbErr) {
      setError(`Hata: ${dbErr.message}`)
      return
    }

    // Otomatik cari hareket — sadece çek oluşturulurken bir kez çalışır
    if (sourceCariId) {
      await supabase.from('cari_hareketler').insert({
        company_id:       companyId,
        cari_id:          sourceCariId,
        transaction_type: direction === 'alindi' ? 'alacak' : 'borc',
        payment_method:   'cek',
        amount:           amt,
        description:      direction === 'alindi' ? 'Çek alındı' : 'Çek verildi',
        transaction_date: issueDate || new Date().toISOString().slice(0, 10),
      })
    }

    router.push('/checks')
    router.refresh()
    } catch {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Direction */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">Çek Türü</p>
        </div>
        <div className="flex gap-3 p-5">
          <button
            type="button"
            onClick={() => setDirection('alindi')}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 py-4 text-sm font-semibold transition-colors ${
              direction === 'alindi'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Alınan Çek
            <span className="text-xs font-normal opacity-60">Müşteriden alındı</span>
          </button>
          <button
            type="button"
            onClick={() => setDirection('verildi')}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 py-4 text-sm font-semibold transition-colors ${
              direction === 'verildi'
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
            Verilen Çek
            <span className="text-xs font-normal opacity-60">Tedarikçiye verildi</span>
          </button>
        </div>
      </div>

      {/* Cari info */}
      <fieldset className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">Cari Bilgileri</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {direction === 'alindi' ? 'Çeki Veren (Kaynak)' : 'Çeki Alan (Hedef)'} <span className="text-red-500">*</span>
            </label>
            <select value={sourceCariId} onChange={e => setSourceCariId(e.target.value)} required className={inputCls}>
              <option value="">— Cari seçin —</option>
              {cariler.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {direction === 'alindi' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Çekin Verildiği Cari (Devir)</label>
              <select value={targetCariId} onChange={e => setTargetCariId(e.target.value)} className={inputCls}>
                <option value="">— Henüz devredilmedi —</option>
                {cariler.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-400">Bu çek başka birine devredildiyse seçin.</p>
            </div>
          )}
        </div>
      </fieldset>

      {/* Check details */}
      <fieldset className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">Çek Detayları</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tutar (₺) <span className="text-red-500">*</span></label>
            <input type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Vade Tarihi <span className="text-red-500">*</span></label>
            <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Düzenleme Tarihi</label>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Çek No</label>
            <input type="text" value={checkNo} onChange={e => setCheckNo(e.target.value)} placeholder="Çek numarası" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Banka Adı</label>
            <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="örn: Ziraat Bankası" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Şube Adı</label>
            <input type="text" value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="Şube adı" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hesap No</label>
            <input type="text" value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="Hesap numarası" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Durum</label>
            <select value={checkStatus} onChange={e => setCheckStatus(e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Açıklama</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Çek açıklaması..." className={inputCls} />
          </div>
        </div>
      </fieldset>

      {/* Çek Fotoğrafları */}
      <fieldset className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700">Çek Fotoğrafları</p>
          <p className="mt-0.5 text-xs text-gray-400">İsteğe bağlı — çekin ön ve arka yüzü</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ön Yüz</label>
            <input
              type="file"
              accept="image/*"
              disabled={uploadingFront}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'front') }}
              className="w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {uploadingFront && <p className="mt-1 text-xs text-gray-400">Yükleniyor…</p>}
            {frontImagePath && <p className="mt-1 text-xs text-green-600">✓ Yüklendi</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Arka Yüz</label>
            <input
              type="file"
              accept="image/*"
              disabled={uploadingBack}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'back') }}
              className="w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {uploadingBack && <p className="mt-1 text-xs text-gray-400">Yükleniyor…</p>}
            {backImagePath && <p className="mt-1 text-xs text-green-600">✓ Yüklendi</p>}
          </div>
        </div>
      </fieldset>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.push('/checks')}
          className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          İptal
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors">
          {loading ? 'Kaydediliyor...' : 'Çeki Kaydet'}
        </button>
      </div>
    </form>
  )
}
