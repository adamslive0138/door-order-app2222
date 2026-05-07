'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type CariOption = { id: string; name: string; tax_number: string | null }

type ConfidenceLevel = 'high' | 'medium' | 'low'

interface OcrConfidence {
  firma_adi: ConfidenceLevel
  vergi_no: ConfidenceLevel
  tutar: ConfidenceLevel
  tarih: ConfidenceLevel
  belge_tipi: ConfidenceLevel
  islem_tipi: ConfidenceLevel
}

interface OcrResult {
  firma_adi: string | null
  vergi_no: string | null
  telefon: string | null
  tutar: string | null
  tarih: string | null
  belge_tipi: 'fatura' | 'dekont' | 'diger'
  islem_tipi: 'alis' | 'satis' | null
  keywords_found: string[]
  confidence: OcrConfidence
}

interface ConfirmFields {
  extracted_name: string
  extracted_amount: string
  extracted_date: string
  extracted_tax_number: string
  extracted_type: 'alis' | 'satis' | ''
  file_type: 'fatura' | 'dekont' | 'diger'
  linked_cari_id: string
}

interface DuplicateInfo {
  extracted_name: string | null
  extracted_amount: number | null
  extracted_date: string | null
}

interface MatchInfo {
  reason: 'tax_number' | 'name_similarity'
  score?: number
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; progress: number }
  | { phase: 'ocr' }
  | {
      phase: 'confirm'
      fileUrl: string
      fields: ConfirmFields
      suggestedCariId: string | null
      matchInfo: MatchInfo | null
      isDuplicate: boolean
      duplicateInfo: DuplicateInfo | null
      confidence: Partial<OcrConfidence>
      keywords: string[]
    }
  | { phase: 'saving' }
  | { phase: 'done' }
  | { phase: 'error'; message: string }

// ── Fuzzy cari matching ───────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9ğüşıöçÇÖŞİĞÜ\s]/g, '')
    .trim()
}

function jaccard(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/).filter(Boolean))
  const setB = new Set(b.split(/\s+/).filter(Boolean))
  let inter = 0
  for (const w of setA) if (setB.has(w)) inter++
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

function findBestCari(
  name: string | null,
  taxNo: string | null,
  cariler: CariOption[]
): { id: string; matchInfo: MatchInfo } | null {
  if (!name && !taxNo) return null

  // 1. Exact tax number match — highest priority
  if (taxNo) {
    const byTax = cariler.find(
      c => c.tax_number && c.tax_number.replace(/\s/g, '') === taxNo.replace(/\s/g, '')
    )
    if (byTax) return { id: byTax.id, matchInfo: { reason: 'tax_number' } }
  }

  // 2. Fuzzy name match
  if (name) {
    const normName = normalize(name)
    let best: { id: string; score: number } | null = null
    for (const c of cariler) {
      const normFirm = normalize(c.name)
      let score = jaccard(normName, normFirm)
      if (normFirm.includes(normName) || normName.includes(normFirm)) score += 0.3
      if (score > (best?.score ?? 0)) best = { id: c.id, score }
    }
    if (best && best.score >= 0.35)
      return { id: best.id, matchInfo: { reason: 'name_similarity', score: best.score } }
  }

  return null
}

// Check if two extracted_name strings are similar enough to count as the same firm
function nameSimilarEnough(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  const score = jaccard(na, nb) + (na.includes(nb) || nb.includes(na) ? 0.3 : 0)
  return score >= 0.35
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  companyId: string
  cariler: CariOption[]
}

export default function DocumentUpload({ companyId, cariler: initialCariler }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>({ phase: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  // Mutable cari list so quick-create entries appear immediately
  const [cariList, setCariList] = useState<CariOption[]>(initialCariler)
  // Duplicate override confirmation
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)
  // Quick-create inline form
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [qcName, setQcName] = useState('')
  const [qcTaxNo, setQcTaxNo] = useState('')
  const [qcPhone, setQcPhone] = useState('')
  const [qcCariType, setQcCariType] = useState<'musteri' | 'tedarikci' | 'her_ikisi'>('musteri')
  const [qcSaving, setQcSaving] = useState(false)
  const [qcSuccess, setQcSuccess] = useState<string | null>(null)

  // ── File processing ──────────────────────────────────────────────────────

  async function processFile(file: File) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setState({ phase: 'error', message: 'Lütfen bir görsel (JPG, PNG) veya PDF dosyası seçin.' })
      return
    }

    try {
      // 1. Upload to storage
      setState({ phase: 'uploading', progress: 10 })
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${companyId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type })

      if (uploadError) throw new Error(`Yükleme hatası: ${uploadError.message}`)

      setState({ phase: 'uploading', progress: 50 })

      const fileUrl = path

      // 2. OCR analysis
      setState({ phase: 'ocr' })

      const base64 = await fileToBase64(file)
      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
          type: 'document',
        }),
      })

      let ocr: OcrResult = {
        firma_adi: null,
        vergi_no: null,
        telefon: null,
        tutar: null,
        tarih: null,
        belge_tipi: 'diger',
        islem_tipi: null,
        keywords_found: [],
        confidence: {
          firma_adi: 'low',
          vergi_no: 'low',
          tutar: 'low',
          tarih: 'low',
          belge_tipi: 'low',
          islem_tipi: 'low',
        },
      }

      if (ocrRes.ok) {
        const ocrData = await ocrRes.json()
        if (ocrData.data) ocr = { ...ocr, ...ocrData.data }
      }

      // Keyword-based belge_tipi override when OCR confidence is low
      if (ocr.confidence.belge_tipi === 'low') {
        const kw = ocr.keywords_found ?? []
        if (kw.some(k => ['banka', 'eft', 'havale', 'makbuz', 'tahsilat'].includes(k)))
          ocr.belge_tipi = 'dekont'
        else if (kw.some(k => ['fatura', 'kdv', 'fatura_no'].includes(k)))
          ocr.belge_tipi = 'fatura'
      }

      // 3. Find best matching cari
      const cariMatch = findBestCari(ocr.firma_adi, ocr.vergi_no, cariList)
      const suggestedCariId = cariMatch?.id ?? null
      const matchInfo = cariMatch?.matchInfo ?? null

      // 4. Check for duplicates in DB (amount + date, then name similarity)
      let isDuplicate = false
      let duplicateInfo: DuplicateInfo | null = null
      if (ocr.tutar && ocr.tarih) {
        const amount = parseFloat(ocr.tutar)
        if (!isNaN(amount)) {
          const { data: existing } = await supabase
            .from('documents')
            .select('id, extracted_name, extracted_amount, extracted_date')
            .eq('company_id', companyId)
            .eq('extracted_amount', amount)
            .eq('extracted_date', ocr.tarih)

          if (existing && existing.length > 0) {
            // If no OCR name, amount+date match is enough to flag
            if (!ocr.firma_adi) {
              isDuplicate = true
              duplicateInfo = existing[0]
            } else {
              // Require name similarity too — avoids false positives on common round amounts
              const hit = existing.find(e =>
                !e.extracted_name || nameSimilarEnough(ocr.firma_adi!, e.extracted_name)
              )
              if (hit) {
                isDuplicate = true
                duplicateInfo = hit
              }
            }
          }
        }
      }

      // Reset/pre-fill quick-create fields from OCR for this document
      setQcName(ocr.firma_adi ?? '')
      setQcTaxNo(ocr.vergi_no ?? '')
      setQcPhone(ocr.telefon ?? '')
      setQcCariType('musteri')
      setQcSuccess(null)
      // Auto-open quick-create when no cari matched at all
      setShowQuickCreate(!cariMatch)
      setDuplicateConfirmed(false)

      // 5. Transition to confirm
      setState({
        phase: 'confirm',
        fileUrl,
        suggestedCariId,
        matchInfo,
        isDuplicate,
        duplicateInfo,
        confidence: ocr.confidence ?? {},
        keywords: ocr.keywords_found ?? [],
        fields: {
          extracted_name: ocr.firma_adi ?? '',
          extracted_amount: ocr.tutar ?? '',
          extracted_date: ocr.tarih ?? '',
          extracted_tax_number: ocr.vergi_no ?? '',
          extracted_type: ocr.islem_tipi ?? '',
          file_type: ocr.belge_tipi ?? 'diger',
          linked_cari_id: suggestedCariId ?? '',
        },
      })
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message })
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (state.phase !== 'confirm') return
    setState({ phase: 'saving' })

    const { fields, fileUrl, isDuplicate } = state
    const amount = fields.extracted_amount ? parseFloat(fields.extracted_amount) : null
    // User confirmed the duplicate override → still process the hareket
    const shouldCreateHareket =
      (!isDuplicate || duplicateConfirmed) &&
      !!fields.linked_cari_id &&
      !!amount &&
      !!fields.extracted_type

    try {
      // 1. Insert document record
      const { data: docRecord, error: docErr } = await supabase
        .from('documents')
        .insert({
          company_id: companyId,
          file_url: fileUrl,
          file_type: fields.file_type,
          extracted_name: fields.extracted_name || null,
          extracted_amount: amount,
          extracted_date: fields.extracted_date || null,
          extracted_tax_number: fields.extracted_tax_number || null,
          extracted_type: fields.extracted_type || null,
          linked_cari_id: fields.linked_cari_id || null,
          is_processed: shouldCreateHareket,
          is_duplicate: isDuplicate,
        })
        .select('id')
        .single()

      if (docErr) throw new Error(`Kayıt hatası: ${docErr.message}`)

      // 2. Create cari_hareketler entry when conditions met
      if (shouldCreateHareket) {
        // Guard: skip if this receipt_url was already recorded (double-submit protection)
        const { count } = await supabase
          .from('cari_hareketler')
          .select('id', { count: 'exact', head: true })
          .eq('receipt_url', fileUrl)

        if ((count ?? 0) === 0) {
          const hareketType = fields.extracted_type === 'alis' ? 'odeme' : 'tahsilat'
          const label = fields.file_type === 'fatura' ? 'Fatura' : 'Dekont'
          const description = fields.extracted_name
            ? `${label} – ${fields.extracted_name}`
            : label

          const { error: hErr } = await supabase.from('cari_hareketler').insert({
            company_id: companyId,
            cari_id: fields.linked_cari_id,
            transaction_type: hareketType,
            amount,
            description,
            transaction_date: fields.extracted_date || null,
            receipt_url: fileUrl,
          })

          // If hareket insert failed (e.g. unique constraint on receipt_url), mark doc as not processed
          if (hErr) {
            await supabase
              .from('documents')
              .update({ is_processed: false })
              .eq('id', docRecord!.id)
            throw new Error(`Hareket kaydedilemedi: ${hErr.message}`)
          }
        }
      }

      setState({ phase: 'done' })
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message })
    }
  }

  // ── Quick-create cari ─────────────────────────────────────────────────────

  async function handleQuickCreate() {
    if (!qcName.trim()) return
    setQcSaving(true)
    try {
      const { data: newCari, error } = await supabase
        .from('cariler')
        .insert({
          company_id: companyId,
          name:  qcName.trim(),
          tax_number: qcTaxNo.trim()  || null,
          phone:      qcPhone.trim()  || null,
          cari_type:  qcCariType,
        })
        .select('id, name, tax_number')
        .single()

      if (error || !newCari) throw new Error(error?.message ?? 'Cari oluşturulamadı')

      // Add to local list, pre-select, collapse form, show brief success
      setCariList(prev => [...prev, newCari])
      setField('linked_cari_id', newCari.id)
      setShowQuickCreate(false)
      setQcSuccess(newCari.name)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setQcSaving(false)
    }
  }

  // ── Drag & drop handlers ──────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  // ── Field update helper ───────────────────────────────────────────────────

  function setField<K extends keyof ConfirmFields>(key: K, value: ConfirmFields[K]) {
    setState(prev =>
      prev.phase === 'confirm'
        ? { ...prev, fields: { ...prev.fields, [key]: value } }
        : prev
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (state.phase === 'done') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-green-800">Belge kaydedildi!</h2>
        <p className="mt-1 text-sm text-green-600">Cari hareketine otomatik olarak eklendi.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => setState({ phase: 'idle' })}
            className="rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
          >
            Yeni Belge Yükle
          </button>
          <button
            onClick={() => router.push('/documents')}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            Belgelere Git →
          </button>
        </div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-700">{state.message}</p>
        <button
          onClick={() => setState({ phase: 'idle' })}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    )
  }

  if (state.phase === 'uploading' || state.phase === 'ocr' || state.phase === 'saving') {
    const label =
      state.phase === 'uploading'
        ? 'Dosya yükleniyor…'
        : state.phase === 'ocr'
        ? 'Yapay zeka ile analiz ediliyor…'
        : 'Kaydediliyor…'

    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20 shadow-sm">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="mt-4 text-sm font-medium text-gray-600">{label}</p>
        {state.phase === 'uploading' && (
          <div className="mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  if (state.phase === 'confirm') {
    const { fields, fileUrl, suggestedCariId, matchInfo, isDuplicate, duplicateInfo, confidence, keywords } = state

    // Low confidence fields need review
    const lowFields = (Object.keys(confidence) as (keyof OcrConfidence)[])
      .filter(k => confidence[k] === 'low')

    const hasLowConfidence = lowFields.length > 0

    // Per-field input class helper
    const fieldCls = (key: keyof OcrConfidence) => {
      const c = confidence[key]
      const base = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1'
      if (c === 'low')
        return `${base} border-amber-300 bg-amber-50 focus:border-amber-500 focus:ring-amber-400`
      if (c === 'medium')
        return `${base} border-yellow-200 bg-white focus:border-blue-500 focus:ring-blue-500`
      return `${base} border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500`
    }

    const KEYWORD_STYLE: Record<string, string> = {
      fatura:    'bg-blue-50 text-blue-700',
      tahsilat:  'bg-green-50 text-green-700',
      banka:     'bg-indigo-50 text-indigo-700',
      makbuz:    'bg-purple-50 text-purple-700',
      irsaliye:  'bg-gray-100 text-gray-600',
      eft:       'bg-indigo-50 text-indigo-700',
      havale:    'bg-indigo-50 text-indigo-700',
      kdv:       'bg-orange-50 text-orange-700',
      toplam:    'bg-gray-100 text-gray-600',
      fatura_no: 'bg-blue-50 text-blue-700',
    }

    return (
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Belgeyi Onayla</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Yapay zeka tarafından çıkarılan bilgileri kontrol edin ve kaydedin.
          </p>
        </div>

        {/* Low-confidence banner */}
        {hasLowConfidence && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs text-amber-700">
              <strong>Düşük güven:</strong>{' '}
              Sarı alanlar belirsiz veya okunamadı. Lütfen görselle karşılaştırarak düzeltin.
            </p>
          </div>
        )}

        {/* Detected keywords */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400">Tespit edilen:</span>
            {keywords.map(k => (
              <span
                key={k}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${KEYWORD_STYLE[k] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {k}
              </span>
            ))}
          </div>
        )}

        {/* Duplicate warning — blocks save until confirmed */}
        {isDuplicate && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800">Bu belge daha önce işlenmiş olabilir</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Aynı tutar
                  {duplicateInfo?.extracted_date ? `, tarih (${duplicateInfo.extracted_date})` : ''}
                  {duplicateInfo?.extracted_name ? ` ve firma (${duplicateInfo.extracted_name})` : ''}
                  {' '}eşleşen bir kayıt zaten mevcut.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={duplicateConfirmed}
                onChange={e => setDuplicateConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-red-400 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs font-medium text-red-700">
                Bu belgenin kopya olduğunu anlıyorum, yine de kaydetmek istiyorum
              </span>
            </label>
          </div>
        )}

        {/* Cari match banner — shows why the cari was pre-selected */}
        {suggestedCariId && matchInfo && (
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
              </svg>
              <p className="text-sm text-blue-700">
                <strong>{cariList.find(c => c.id === suggestedCariId)?.name}</strong>
                {' '}otomatik eşleştirildi —{' '}
                <span className="font-normal">
                  {matchInfo.reason === 'tax_number'
                    ? 'vergi numarasına göre'
                    : `isim benzerliğine göre (%${Math.round((matchInfo.score ?? 0) * 100)})`}
                </span>
              </p>
            </div>
            {fields.linked_cari_id === suggestedCariId && (
              <button
                onClick={() => setField('linked_cari_id', '')}
                className="ml-4 shrink-0 text-xs text-blue-500 hover:text-blue-700 underline"
              >
                Değiştir
              </button>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Preview */}
          <div className="lg:col-span-2">
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <img
                src={fileUrl}
                alt="Belge önizleme"
                className="w-full rounded-xl border border-gray-200 object-contain shadow-sm hover:shadow-md transition-shadow max-h-80"
                onError={e => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </a>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-center text-xs text-blue-600 hover:underline"
            >
              Tam boyutta görüntüle →
            </a>
          </div>

          {/* Form */}
          <div className="space-y-3 lg:col-span-3">
            {/* Belge tipi + İşlem tipi */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel label="Belge Tipi" confidence={confidence.belge_tipi} />
                <select
                  value={fields.file_type}
                  onChange={e => setField('file_type', e.target.value as ConfirmFields['file_type'])}
                  className={fieldCls('belge_tipi')}
                >
                  <option value="fatura">Fatura</option>
                  <option value="dekont">Dekont</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>
              <div>
                <FieldLabel label="İşlem Tipi" confidence={confidence.islem_tipi} />
                <select
                  value={fields.extracted_type}
                  onChange={e => setField('extracted_type', e.target.value as ConfirmFields['extracted_type'])}
                  className={fieldCls('islem_tipi')}
                >
                  <option value="">—</option>
                  <option value="alis">Alış</option>
                  <option value="satis">Satış</option>
                </select>
              </div>
            </div>

            {/* Firma adı */}
            <div>
              <FieldLabel label="Firma Adı" confidence={confidence.firma_adi} />
              <input
                type="text"
                value={fields.extracted_name}
                onChange={e => setField('extracted_name', e.target.value)}
                className={fieldCls('firma_adi')}
                placeholder="Firma adı (opsiyonel)"
              />
            </div>

            {/* Vergi no + Tutar */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel label="Vergi No" confidence={confidence.vergi_no} />
                <input
                  type="text"
                  value={fields.extracted_tax_number}
                  onChange={e => setField('extracted_tax_number', e.target.value)}
                  className={fieldCls('vergi_no')}
                  placeholder="İsteğe bağlı"
                />
              </div>
              <div>
                <FieldLabel label="Tutar (₺)" confidence={confidence.tutar} />
                <input
                  type="number"
                  step="0.01"
                  value={fields.extracted_amount}
                  onChange={e => setField('extracted_amount', e.target.value)}
                  className={fieldCls('tutar')}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Tarih */}
            <div>
              <FieldLabel label="Belge Tarihi" confidence={confidence.tarih} />
              <input
                type="date"
                value={fields.extracted_date}
                onChange={e => setField('extracted_date', e.target.value)}
                className={fieldCls('tarih')}
              />
            </div>

            {/* Cari bağlantı */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cari Bağlantısı
                <span className="ml-1 font-normal text-gray-400">(Cari hareketi otomatik oluşturulur)</span>
              </label>
              <select
                value={fields.linked_cari_id}
                onChange={e => {
                  setField('linked_cari_id', e.target.value)
                  if (e.target.value) setShowQuickCreate(false)
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Cari seçin (opsiyonel) —</option>
                {cariList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.tax_number ? ` (${c.tax_number})` : ''}
                  </option>
                ))}
              </select>

              {/* Trigger: prominent when no match, subtle otherwise */}
              {!fields.linked_cari_id && !showQuickCreate && (
                suggestedCariId === null ? (
                  /* No match found — show as a call-to-action card */
                  <button
                    type="button"
                    onClick={() => setShowQuickCreate(true)}
                    className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100 transition-colors"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <svg className="h-3.5 w-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-blue-700">Yeni Cari Oluştur</p>
                      <p className="text-[11px] text-blue-500">
                        Eşleşen cari bulunamadı — belgeden bilgiler otomatik dolduruldu
                      </p>
                    </div>
                  </button>
                ) : (
                  /* Match exists but user cleared it — subtle link */
                  <button
                    type="button"
                    onClick={() => setShowQuickCreate(true)}
                    className="mt-1.5 text-xs text-blue-600 hover:underline"
                  >
                    + Yeni cari oluştur
                  </button>
                )
              )}
            </div>

            {/* Success notice after quick-create */}
            {qcSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                <svg className="h-4 w-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-xs text-green-700">
                  <strong>{qcSuccess}</strong> carisi oluşturuldu ve belgeye bağlandı.
                </p>
              </div>
            )}

            {/* Quick-create inline form */}
            {showQuickCreate && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-800">Yeni Cari Oluştur</p>
                  <button
                    type="button"
                    onClick={() => setShowQuickCreate(false)}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Firm name */}
                <div>
                  <label className="block text-[11px] font-medium text-blue-700 mb-1">Firma Adı *</label>
                  <input
                    type="text"
                    placeholder="Firma adı"
                    value={qcName}
                    onChange={e => setQcName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                {/* Tax no + Phone */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-blue-700 mb-1">Vergi No</label>
                    <input
                      type="text"
                      placeholder="İsteğe bağlı"
                      value={qcTaxNo}
                      onChange={e => setQcTaxNo(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-blue-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      placeholder="İsteğe bağlı"
                      value={qcPhone}
                      onChange={e => setQcPhone(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Cari type */}
                <div>
                  <label className="block text-[11px] font-medium text-blue-700 mb-1">Cari Tipi</label>
                  <select
                    value={qcCariType}
                    onChange={e => setQcCariType(e.target.value as typeof qcCariType)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="musteri">Müşteri</option>
                    <option value="tedarikci">Tedarikçi</option>
                    <option value="her_ikisi">Her İkisi</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleQuickCreate}
                  disabled={!qcName.trim() || qcSaving}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {qcSaving ? 'Kaydediliyor…' : 'Cari Oluştur ve Belgeye Bağla'}
                </button>
              </div>
            )}

            {/* Action hint */}
            {fields.linked_cari_id && fields.extracted_amount && fields.extracted_type && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700">
                Kaydettiğinizde{' '}
                <strong>{cariList.find(c => c.id === fields.linked_cari_id)?.name}</strong>{' '}
                carisine{' '}
                <strong>
                  {fields.extracted_type === 'alis' ? 'ödeme (borç)' : 'tahsilat (alacak)'}
                </strong>{' '}
                hareketi eklenir: <strong>₺{Number(fields.extracted_amount).toLocaleString('tr-TR')}</strong>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setState({ phase: 'idle' })}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={isDuplicate && !duplicateConfirmed}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                Kaydet ve İşle
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Idle (upload area) ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Belge Yükle</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Fatura veya dekont görselinizi yükleyin, yapay zeka otomatik olarak analiz eder.
        </p>
      </div>

      <div
        className={`relative flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-gray-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center gap-3 text-center px-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-7 w-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              Dosyayı sürükleyip bırakın veya{' '}
              <span className="text-blue-600">tıklayarak seçin</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">JPG, PNG, WEBP, PDF — maks. 10MB</p>
          </div>

          <div className="mt-2 flex gap-6 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Otomatik OCR analizi
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Cari eşleştirme
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Kopya tespiti
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── FieldLabel ────────────────────────────────────────────────────────────────

function FieldLabel({ label, confidence }: { label: string; confidence?: ConfidenceLevel }) {
  const dot =
    confidence === 'high'
      ? 'bg-green-400'
      : confidence === 'medium'
      ? 'bg-yellow-400'
      : confidence === 'low'
      ? 'bg-amber-500'
      : null

  const hint =
    confidence === 'low'
      ? 'Düşük güven — kontrol edin'
      : confidence === 'medium'
      ? 'Orta güven'
      : null

  return (
    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600">
      {dot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
      {hint && <span className="font-normal text-amber-600">({hint})</span>}
    </label>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
