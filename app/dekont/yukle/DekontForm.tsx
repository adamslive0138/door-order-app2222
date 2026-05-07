'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { Cari } from '@/src/types'

type CariOption = Pick<Cari, 'id' | 'name' | 'cari_type'>

interface Props {
  companyId: string
  cariler: CariOption[]
}

interface OcrData {
  isim?: string | null
  tutar?: string | null
  tarih?: string | null
  aciklama?: string | null
}

interface MatchResult {
  cari: CariOption
  score: number   // 0-1, 1 = exact
}

// ── Fuzzy matching ────────────────────────────────────────────────────────────

/** Strip punctuation, Turkish business suffixes, and extra whitespace */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    // common Turkish company suffixes
    .replace(
      /\b(ltd|sti|şti|aş|a\.ş|ltd\.şti|limited|şirketi|ticaret|sanayi|san|tic|ve|co|corp|ins|inş)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()
}

/** Jaccard word-overlap: |intersection| / |union| */
function wordOverlap(a: string, b: string): number {
  const setA = new Set(a.split(' ').filter((w) => w.length > 1))
  const setB = new Set(b.split(' ').filter((w) => w.length > 1))
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  setA.forEach((w) => { if (setB.has(w)) intersection++ })
  return intersection / (setA.size + setB.size - intersection)
}

/** Check if one string contains the other as a substring after normalization */
function substringMatch(a: string, b: string): boolean {
  return a.includes(b) || b.includes(a)
}

function findCariMatch(isim: string, cariler: CariOption[]): MatchResult | null {
  if (!isim || cariler.length === 0) return null

  const raw = isim.toLowerCase().trim()
  const norm = normalize(isim)

  let best: MatchResult | null = null

  for (const cari of cariler) {
    const cariRaw = cari.name.toLowerCase().trim()
    const cariNorm = normalize(cari.name)

    let score = 0

    // 1. Exact raw match → perfect score
    if (cariRaw === raw) {
      score = 1
    } else if (cariNorm === norm && norm.length > 0) {
      // 2. Exact normalized match
      score = 0.95
    } else {
      // 3. Word overlap on normalized strings
      const overlap = wordOverlap(norm, cariNorm)
      // 4. Substring bonus (one contains the other after normalization)
      const sub = substringMatch(norm, cariNorm) ? 0.2 : 0
      score = Math.min(overlap + sub, 1)
    }

    if (score > (best?.score ?? 0)) {
      best = { cari, score }
    }
  }

  // Only return a match if confidence is reasonable
  return best && best.score >= 0.35 ? best : null
}

function matchLabel(score: number): string {
  if (score >= 0.95) return 'Tam eşleşme'
  if (score >= 0.7)  return 'Yüksek benzerlik'
  if (score >= 0.5)  return 'Orta benzerlik'
  return 'Düşük benzerlik'
}

function matchColor(score: number): string {
  if (score >= 0.7)  return 'border-green-200 bg-green-50 text-green-800'
  if (score >= 0.5)  return 'border-blue-200 bg-blue-50 text-blue-800'
  return 'border-amber-200 bg-amber-50 text-amber-800'
}

// ── Utils ─────────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target!.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DekontForm({ companyId, cariler }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [dekontFile, setDekontFile] = useState<File | null>(null)
  const [dekontPreview, setDekontPreview] = useState<string | null>(null)

  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrDone, setOcrDone]       = useState(false)
  const [ocrError, setOcrError]     = useState<string | null>(null)
  const [ocrRaw, setOcrRaw]         = useState<OcrData | null>(null)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)

  const [form, setForm] = useState({
    cari_id: '',
    islem_tipi: 'tahsilat' as 'tahsilat' | 'odeme',
    tutar: '',
    tarih: today,
    aciklama: '',
  })

  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Handlers ────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setDekontFile(file)
    setOcrDone(false)
    setOcrError(null)
    setOcrRaw(null)
    setMatchResult(null)
    if (file) {
      setDekontPreview(URL.createObjectURL(file))
      runOcr(file)
    } else {
      setDekontPreview(null)
    }
  }

  async function runOcr(file: File) {
    setOcrLoading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type, type: 'dekont' }),
      })
      const json = await res.json()
      if (!res.ok) {
        setOcrError(json.error ?? 'OCR başarısız oldu')
      } else {
        const data: OcrData = json.data
        setOcrRaw(data)

        // Auto-fill tutar / tarih / aciklama
        const tutar = data.tutar?.replace(',', '.').replace(/[^0-9.]/g, '') ?? ''
        setForm((prev) => ({
          ...prev,
          tutar: tutar || prev.tutar,
          tarih: data.tarih ?? prev.tarih,
          aciklama: data.aciklama ?? prev.aciklama,
        }))

        // Fuzzy-match extracted name → pre-select cari (but NOT auto-confirm)
        if (data.isim) {
          const result = findCariMatch(data.isim, cariler)
          setMatchResult(result)
          if (result) {
            setForm((prev) => ({ ...prev, cari_id: result.cari.id }))
          }
        }
      }
    } catch {
      setOcrError('Dekont okunamadı')
    } finally {
      setOcrLoading(false)
      setOcrDone(true)
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    // If user manually changes cari, dismiss the auto-match banner
    if (name === 'cari_id' && matchResult && value !== matchResult.cari.id) {
      setMatchResult(null)
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function dismissMatch() {
    setMatchResult(null)
    setForm((prev) => ({ ...prev, cari_id: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)

    if (!form.cari_id) {
      setSaveError('Lütfen bir cari seçiniz.')
      return
    }
    const tutar = parseFloat(form.tutar)
    if (isNaN(tutar) || tutar <= 0) {
      setSaveError('Geçerli bir tutar giriniz.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    let dekont_url: string | null = null
    if (dekontFile) {
      const ext = dekontFile.name.split('.').pop()
      const path = `${companyId}/${form.cari_id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(path, dekontFile, { upsert: false })
      if (upErr) {
        setSaveError(`Dekont yüklenemedi: ${upErr.message}`)
        setSaving(false)
        return
      }
      dekont_url = path
    }

    const { error: dbErr } = await supabase.from('cari_hareketler').insert({
      company_id: companyId,
      cari_id: form.cari_id,
      transaction_type: form.islem_tipi,
      amount: tutar,
      transaction_date: form.tarih || null,
      receipt_url: dekont_url,
      description: form.aciklama || null,
    })

    if (dbErr) {
      setSaveError(`Hata: ${dbErr.message}`)
      setSaving(false)
      return
    }

    router.push(`/cari/${form.cari_id}`)
    router.refresh()
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Dekont Görsel ─────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-semibold text-gray-700">Dekont Görseli</p>
        </div>
        <div className="space-y-4 p-5">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />

          {dekontPreview && (
            <img
              src={dekontPreview}
              alt="Dekont önizleme"
              className="max-h-64 w-full rounded-xl border border-gray-200 object-contain bg-gray-50"
            />
          )}

          {ocrLoading && (
            <div className="flex items-center gap-2 text-sm text-indigo-600">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Dekont okunuyor…
            </div>
          )}

          {ocrError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              OCR hatası: {ocrError}
            </p>
          )}

          {ocrDone && !ocrError && ocrRaw && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <p className="font-semibold text-gray-700">Çıkarılan bilgiler:</p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
                {ocrRaw.isim     && <><dt className="font-medium">İsim</dt>      <dd>{ocrRaw.isim}</dd></>}
                {ocrRaw.tutar    && <><dt className="font-medium">Tutar</dt>     <dd>{ocrRaw.tutar}</dd></>}
                {ocrRaw.tarih    && <><dt className="font-medium">Tarih</dt>     <dd>{ocrRaw.tarih}</dd></>}
                {ocrRaw.aciklama && <><dt className="font-medium">Açıklama</dt>  <dd className="truncate">{ocrRaw.aciklama}</dd></>}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* ── Cari Eşleştirme ───────────────────────────────── */}
      {matchResult && (
        <div className={`rounded-xl border px-4 py-4 ${matchColor(matchResult.score)}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Eşleşme bulundu</p>
                <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium">
                  {matchLabel(matchResult.score)}
                </span>
              </div>
              <p className="mt-1 text-sm">
                <span className="opacity-70">"{ocrRaw?.isim}"</span>
                {' → '}
                <span className="font-semibold">{matchResult.cari.name}</span>
              </p>
              <p className="mt-1.5 text-xs opacity-70">
                Cari otomatik seçildi. Yanlışsa aşağıdan değiştirebilirsiniz veya &times; ile iptal edebilirsiniz.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissMatch}
              className="flex-shrink-0 rounded-lg p-1 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Eşleştirmeyi kaldır"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Hareket Bilgileri ─────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-semibold text-gray-700">Hareket Bilgileri</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">

          {/* Cari Seç */}
          <div className="sm:col-span-2">
            <label htmlFor="cari_id" className="block text-sm font-medium text-gray-700">
              Cari <span className="text-red-500">*</span>
            </label>
            <select
              id="cari_id"
              name="cari_id"
              required
              value={form.cari_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Cari seçiniz —</option>
              {cariler.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* İşlem Tipi */}
          <div>
            <label htmlFor="islem_tipi" className="block text-sm font-medium text-gray-700">
              İşlem Tipi <span className="text-red-500">*</span>
            </label>
            <select
              id="islem_tipi"
              name="islem_tipi"
              required
              value={form.islem_tipi}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="tahsilat">Tahsilat</option>
              <option value="odeme">Ödeme</option>
            </select>
          </div>

          {/* Tutar */}
          <div>
            <label htmlFor="tutar" className="block text-sm font-medium text-gray-700">
              Tutar (₺) <span className="text-red-500">*</span>
            </label>
            <input
              id="tutar"
              name="tutar"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.tutar}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Tarih */}
          <div>
            <label htmlFor="tarih" className="block text-sm font-medium text-gray-700">
              Tarih <span className="text-red-500">*</span>
            </label>
            <input
              id="tarih"
              name="tarih"
              type="date"
              required
              value={form.tarih}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Açıklama */}
          <div className="sm:col-span-2">
            <label htmlFor="aciklama" className="block text-sm font-medium text-gray-700">
              Açıklama
            </label>
            <textarea
              id="aciklama"
              name="aciklama"
              rows={2}
              value={form.aciklama}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {saveError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{saveError}</p>
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
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Kaydediliyor…' : 'Hareketi Kaydet'}
        </button>
      </div>
    </form>
  )
}
