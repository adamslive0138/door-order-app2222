'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { UserRole } from '@/src/types'
import { canDo } from '@/src/lib/role'

// ── Types ─────────────────────────────────────────────────────────────────────

type Doc = {
  id: string
  file_url: string
  display_url: string | null
  file_type: string
  extracted_name: string | null
  extracted_amount: number | null
  extracted_date: string | null
  extracted_tax_number: string | null
  extracted_type: string | null
  linked_cari_id: string | null
  is_processed: boolean
  is_duplicate: boolean
  created_at: string
  cariler: { name: string } | null
}

type CariOption = {
  id: string
  name: string
  tax_number: string | null
}

type Tab = 'all' | 'bekleyen' | 'islenmis' | 'duplicate' | 'eksik'

/**
 * Eksik kural:
 *   İşlenmemiş + kopya değil + (cari bağlı değil VEYA tutar eksik/sıfır)
 *   → harekete dönüştürmek için gerekli veri eksik
 */
function isEksik(d: Doc) {
  return (
    !d.is_processed &&
    !d.is_duplicate &&
    (!d.linked_cari_id || !d.extracted_amount || d.extracted_amount <= 0)
  )
}
type Msg = { id: string; text: string; ok: boolean }

interface Props {
  documents: Doc[]
  cariler: CariOption[]
  companyId: string
  userRole: UserRole
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FILE_TYPE_LABEL: Record<string, string> = {
  fatura: 'Fatura',
  dekont: 'Dekont',
  diger: 'Diğer',
}
const FILE_TYPE_STYLE: Record<string, string> = {
  fatura: 'bg-blue-50 text-blue-700',
  dekont: 'bg-purple-50 text-purple-700',
  diger: 'bg-gray-100 text-gray-600',
}
const EXTRACTED_TYPE_LABEL: Record<string, string> = {
  alis: 'Alış',
  satis: 'Satış',
}

function fmtCur(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(n)
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  const safe = d.includes('T') ? d : d + 'T00:00:00'
  return new Date(safe).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ doc }: { doc: Doc }) {
  if (doc.is_duplicate)
    return <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">Kopya Şüpheli</span>
  if (doc.is_processed)
    return <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">İşlendi</span>
  return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">İşlenmemiş</span>
}

// ── Edit modal ────────────────────────────────────────────────────────────────

interface EditForm {
  file_type: string
  extracted_type: string
  extracted_amount: string
  extracted_date: string
  extracted_name: string
  linked_cari_id: string
}

function EditModal({
  doc,
  cariler,
  onClose,
  onSaved,
}: {
  doc: Doc
  cariler: CariOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState<EditForm>({
    file_type:        doc.file_type         ?? 'diger',
    extracted_type:   doc.extracted_type    ?? '',
    extracted_amount: doc.extracted_amount != null ? String(doc.extracted_amount) : '',
    extracted_date:   doc.extracted_date    ?? '',
    extracted_name:   doc.extracted_name    ?? '',
    linked_cari_id:   doc.linked_cari_id    ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function set<K extends keyof EditForm>(field: K, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const amt = form.extracted_amount !== '' ? parseFloat(form.extracted_amount) : null
    if (form.extracted_amount !== '' && (isNaN(amt!) || amt! < 0)) {
      setError('Geçerli bir tutar giriniz.')
      setSaving(false)
      return
    }

    const { error: dbErr } = await supabase
      .from('documents')
      .update({
        file_type:        form.file_type                         || null,
        extracted_type:   form.extracted_type                   || null,
        extracted_amount: amt,
        extracted_date:   form.extracted_date                   || null,
        extracted_name:   form.extracted_name.trim()            || null,
        linked_cari_id:   form.linked_cari_id                   || null,
      })
      .eq('id', doc.id)

    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">Belgeyi Düzenle</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Belge tipi + İşlem tipi */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Belge Tipi</label>
              <select
                value={form.file_type}
                onChange={e => set('file_type', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="fatura">Fatura</option>
                <option value="dekont">Dekont</option>
                <option value="diger">Diğer</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">İşlem Tipi</label>
              <select
                value={form.extracted_type}
                onChange={e => set('extracted_type', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Belirsiz —</option>
                <option value="alis">Alış</option>
                <option value="satis">Satış</option>
              </select>
            </div>
          </div>

          {/* Tutar + Tarih */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tutar (₺)</label>
              <input
                type="number" min="0" step="0.01"
                value={form.extracted_amount}
                onChange={e => set('extracted_amount', e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Belge Tarihi</label>
              <input
                type="date"
                value={form.extracted_date}
                onChange={e => set('extracted_date', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Firma adı / açıklama */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Firma / Açıklama</label>
            <input
              type="text"
              value={form.extracted_name}
              onChange={e => set('extracted_name', e.target.value)}
              placeholder="OCR ile çıkarılan firma adı veya açıklama"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Cari */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Bağlı Cari</label>
            <select
              value={form.linked_cari_id}
              onChange={e => set('linked_cari_id', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Cari bağlanmadı —</option>
              {cariler.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  doc,
  onClose,
  onDeleted,
}: {
  doc: Doc
  onClose: () => void
  onDeleted: () => void
}) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)

    // Attempt storage deletion first (best-effort: file_url may be a path or legacy URL).
    // Records uploaded before Phase E (storage migration) store full public URLs as file_url.
    // storage.remove() will silently fail for those — orphan files may remain in the bucket.
    // TODO: one-time cleanup script needed to remove orphaned storage files from legacy records.
    await supabase.storage.from('documents').remove([doc.file_url]).catch(() => {})

    const { error: dbErr } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id)

    setDeleting(false)
    if (dbErr) { setError(dbErr.message); return }
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="px-5 py-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Belgeyi sil</h2>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium">{FILE_TYPE_LABEL[doc.file_type] ?? doc.file_type}</span>
            {doc.extracted_name ? ` — ${doc.extracted_name}` : ''}
            {' '}belgesi ve depolama alanındaki dosya kalıcı olarak silinecek.
          </p>
          {doc.is_processed && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Bu belge işlenmiş ve bir cari harekete dönüştürülmüş olabilir. Belge silinse bile ilgili hareket kayıtları korunur.
            </p>
          )}
          {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Siliniyor…' : 'Sil'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════

export default function DocumentList({ documents, cariler, companyId, userRole }: Props) {
  const canEdit = canDo(userRole, 'docs_edit')
  const router = useRouter()

  const [tab,          setTab]          = useState<Tab>('bekleyen')
  const [linkingId,    setLinkingId]    = useState<string | null>(null)
  const [linkCariId,   setLinkCariId]   = useState('')
  const [busy,         setBusy]         = useState<string | null>(null)
  const [msg,          setMsg]          = useState<Msg | null>(null)
  const [editTarget,   setEditTarget]   = useState<Doc | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null)

  // Auto-clear feedback after 3 s
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3000)
    return () => clearTimeout(t)
  }, [msg])

  // ── Cari suggestion by tax_number ─────────────────────────────────────────
  function suggestCari(doc: Doc): string {
    if (doc.extracted_tax_number) {
      const m = cariler.find(c => c.tax_number === doc.extracted_tax_number)
      if (m) return m.id
    }
    return ''
  }

  function openLink(doc: Doc) {
    setLinkingId(doc.id)
    setLinkCariId(doc.linked_cari_id ?? suggestCari(doc))
    setMsg(null)
  }

  // ── Action: Cariye Bağla ──────────────────────────────────────────────────
  async function handleLinkCari(docId: string) {
    if (!linkCariId) { setMsg({ id: docId, text: 'Bir cari seçiniz.', ok: false }); return }
    setBusy(docId)
    const { error } = await createClient()
      .from('documents')
      .update({ linked_cari_id: linkCariId })
      .eq('id', docId)
    setBusy(null)
    setLinkingId(null)
    if (error) {
      setMsg({ id: docId, text: `Hata: ${error.message}`, ok: false })
    } else {
      setMsg({ id: docId, text: 'Cari bağlandı.', ok: true })
      router.refresh()
    }
  }

  // ── Action: Harekete Dönüştür ─────────────────────────────────────────────
  async function handleConvert(doc: Doc) {
    if (doc.is_processed) {
      setMsg({ id: doc.id, text: 'Bu belge zaten işlendi — tekrar harekete dönüştürülemez.', ok: false })
      return
    }
    if (!doc.linked_cari_id) {
      setMsg({ id: doc.id, text: 'Önce cariye bağlayın.', ok: false })
      return
    }
    if (!doc.extracted_amount || doc.extracted_amount <= 0) {
      setMsg({ id: doc.id, text: 'Tutar bilgisi eksik veya sıfır.', ok: false })
      return
    }

    setBusy(doc.id)
    const supabase = createClient()

    // Dedup guard: check if a movement already exists for this file_url
    const { count } = await supabase
      .from('cari_hareketler')
      .select('id', { count: 'exact', head: true })
      .eq('receipt_url', doc.file_url)

    if ((count ?? 0) > 0) {
      setBusy(null)
      setMsg({ id: doc.id, text: 'Bu belge için hareket zaten mevcut.', ok: false })
      return
    }

    const transaction_type = doc.extracted_type === 'alis' ? 'odeme' : 'tahsilat'

    const { error: hErr } = await supabase.from('cari_hareketler').insert({
      company_id:       companyId,
      cari_id:          doc.linked_cari_id,
      transaction_type,
      amount:           doc.extracted_amount,
      transaction_date: doc.extracted_date || null,
      receipt_url:      doc.file_url,
      description:      doc.extracted_name || `${FILE_TYPE_LABEL[doc.file_type] ?? 'Belge'} işlemi`,
    })

    if (hErr) {
      setBusy(null)
      setMsg({ id: doc.id, text: `Hareket oluşturulamadı: ${hErr.message}`, ok: false })
      return
    }

    // Mark document as processed
    await supabase.from('documents').update({ is_processed: true }).eq('id', doc.id)

    setBusy(null)
    setMsg({ id: doc.id, text: 'Hareket oluşturuldu ve belge işlendi.', ok: true })
    router.refresh()
  }

  // ── Action: Kopya İşaretle ────────────────────────────────────────────────
  async function handleMarkDuplicate(docId: string) {
    setBusy(docId)
    const { error } = await createClient()
      .from('documents')
      .update({ is_duplicate: true })
      .eq('id', docId)
    setBusy(null)
    if (error) {
      setMsg({ id: docId, text: `Hata: ${error.message}`, ok: false })
    } else {
      setMsg({ id: docId, text: 'Kopya olarak işaretlendi.', ok: true })
      router.refresh()
    }
  }

  // ── Mutation callbacks ────────────────────────────────────────────────────
  function handleMutated() {
    setEditTarget(null)
    setDeleteTarget(null)
    router.refresh()
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = documents.filter(d => {
    if (tab === 'bekleyen')  return !d.is_processed && !d.is_duplicate
    if (tab === 'islenmis')  return d.is_processed
    if (tab === 'duplicate') return d.is_duplicate
    if (tab === 'eksik')     return isEksik(d)
    return true
  })

  const counts = {
    all:       documents.length,
    bekleyen:  documents.filter(d => !d.is_processed && !d.is_duplicate).length,
    islenmis:  documents.filter(d => d.is_processed).length,
    duplicate: documents.filter(d => d.is_duplicate).length,
    eksik:     documents.filter(isEksik).length,
  }

  const tabCls = (t: Tab) => {
    const active = tab === t
    if (t === 'eksik')
      return `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-red-500'}`
    if (t === 'islenmis')
      return `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`
    return `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {editTarget && (
        <EditModal
          doc={editTarget}
          cariler={cariler}
          onClose={() => setEditTarget(null)}
          onSaved={handleMutated}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          doc={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleMutated}
        />
      )}

      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Belge Merkezi</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Fatura ve dekontlarınızı yükleyin, cari ile eşleştirin
            </p>
          </div>
          <Link
            href="/documents/upload"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Belge Yükle
          </Link>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            onClick={() => setTab('bekleyen')}
            className={`rounded-xl border p-4 text-left shadow-sm transition-colors ${tab === 'bekleyen' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Bekleyen</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{counts.bekleyen}</p>
            <p className="mt-0.5 text-xs text-gray-400">İşlem bekliyor</p>
          </button>
          <button
            onClick={() => setTab('islenmis')}
            className={`rounded-xl border p-4 text-left shadow-sm transition-colors ${tab === 'islenmis' ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-green-600">İşlenmiş</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{counts.islenmis}</p>
            <p className="mt-0.5 text-xs text-gray-400">Harekete dönüştürüldü</p>
          </button>
          <button
            onClick={() => setTab('eksik')}
            className={`rounded-xl border p-4 text-left shadow-sm transition-colors ${tab === 'eksik' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Eksik / Hatalı</p>
            <p className="mt-1 text-2xl font-bold text-red-700">{counts.eksik}</p>
            <p className="mt-0.5 text-xs text-gray-400">Cari veya tutar eksik</p>
          </button>
          <button
            onClick={() => setTab('duplicate')}
            className={`rounded-xl border p-4 text-left shadow-sm transition-colors ${tab === 'duplicate' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Kopya Şüpheli</p>
            <p className="mt-1 text-2xl font-bold text-orange-700">{counts.duplicate}</p>
            <p className="mt-0.5 text-xs text-gray-400">İnceleme gerekiyor</p>
          </button>
        </div>

        {/* Tabs + table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex border-b border-gray-100 px-4">
            <button className={tabCls('all')}       onClick={() => setTab('all')}>       Tümü ({counts.all})</button>
            <button className={tabCls('bekleyen')}  onClick={() => setTab('bekleyen')}>  Bekleyen ({counts.bekleyen})</button>
            <button className={tabCls('islenmis')}  onClick={() => setTab('islenmis')}>  İşlenmiş ({counts.islenmis})</button>
            <button className={tabCls('duplicate')} onClick={() => setTab('duplicate')}> Kopya ({counts.duplicate})</button>
            <button className={tabCls('eksik')}     onClick={() => setTab('eksik')}>
              Eksik
              {counts.eksik > 0 && (
                <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">
                  {counts.eksik}
                </span>
              )}
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-3 text-sm text-gray-400">Bu kategoride belge yok.</p>
              {tab === 'all' && (
                <Link href="/documents/upload" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                  İlk belgeyi yükleyin →
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Belge</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Firma / Cari</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Tutar</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Belge Tarihi</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Durum</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(doc => (
                    <>
                      <tr key={doc.id} className="transition-colors hover:bg-gray-50/60">

                        {/* Belge */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <a
                              href={doc.display_url ?? doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100"
                              title="Belgeyi görüntüle"
                            >
                              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </a>
                            <div>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FILE_TYPE_STYLE[doc.file_type] ?? FILE_TYPE_STYLE.diger}`}>
                                {FILE_TYPE_LABEL[doc.file_type] ?? doc.file_type}
                              </span>
                              {doc.extracted_type && (
                                <span className="ml-1.5 text-xs text-gray-400">
                                  {EXTRACTED_TYPE_LABEL[doc.extracted_type] ?? doc.extracted_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Firma / Cari */}
                        <td className="px-4 py-3">
                          {doc.linked_cari_id ? (
                            <Link href={`/cari/${doc.linked_cari_id}`} className="font-medium text-gray-800 transition-colors hover:text-blue-600">
                              {doc.cariler?.name ?? doc.extracted_name ?? '—'}
                            </Link>
                          ) : (
                            <span className="text-gray-500">{doc.extracted_name ?? '—'}</span>
                          )}
                          {doc.extracted_tax_number && (
                            <p className="text-xs text-gray-400">VN: {doc.extracted_tax_number}</p>
                          )}
                        </td>

                        {/* Tutar */}
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">
                          {fmtCur(doc.extracted_amount)}
                        </td>

                        {/* Belge Tarihi */}
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                          {fmtDate(doc.extracted_date)}
                        </td>

                        {/* Durum */}
                        <td className="px-4 py-3">
                          <StatusBadge doc={doc} />
                          {isEksik(doc) && (
                            <p className="mt-1 text-xs text-red-500">
                              {!doc.linked_cari_id && '↳ cari eksik'}
                              {doc.linked_cari_id && (!doc.extracted_amount || doc.extracted_amount <= 0) && '↳ tutar eksik'}
                            </p>
                          )}
                        </td>

                        {/* İşlemler */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!doc.is_processed && !doc.is_duplicate && (
                              <>
                                {/* Cariye Bağla */}
                                <button
                                  onClick={() => linkingId === doc.id ? setLinkingId(null) : openLink(doc)}
                                  disabled={busy === doc.id}
                                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {doc.linked_cari_id ? 'Cariyi Değiştir' : 'Cariye Bağla'}
                                </button>

                                {/* Harekete Dönüştür — only when cari is linked */}
                                {doc.linked_cari_id && (
                                  <button
                                    onClick={() => handleConvert(doc)}
                                    disabled={busy === doc.id}
                                    className="rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {busy === doc.id ? '…' : 'Harekete Dönüştür'}
                                  </button>
                                )}

                                {/* Kopya İşaretle */}
                                <button
                                  onClick={() => handleMarkDuplicate(doc.id)}
                                  disabled={busy === doc.id}
                                  className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                                >
                                  Kopya İşaretle
                                </button>
                              </>
                            )}

                            {doc.is_processed && (
                              <a
                                href={doc.display_url ?? doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-blue-600 hover:underline"
                              >
                                Görüntüle
                              </a>
                            )}

                            {/* Düzenle */}
                            {canEdit && (
                              <button
                                onClick={() => setEditTarget(doc)}
                                title="Düzenle"
                                className="inline-flex items-center rounded-lg border border-gray-200 p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}

                            {/* Sil */}
                            {canEdit && (
                              <button
                                onClick={() => setDeleteTarget(doc)}
                                title="Sil"
                                className="inline-flex items-center rounded-lg border border-gray-200 p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Inline feedback */}
                      {msg?.id === doc.id && (
                        <tr key={`msg-${doc.id}`}>
                          <td colSpan={6} className="px-4 py-2">
                            <div className={`rounded-lg px-3 py-2 text-xs font-medium ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                              {msg.text}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Inline cari link form */}
                      {linkingId === doc.id && (
                        <tr key={`link-${doc.id}`} className="bg-blue-50/50">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-xs font-medium text-gray-600">Cari seç:</span>

                              {/* Tax number match hint */}
                              {doc.extracted_tax_number && cariler.find(c => c.tax_number === doc.extracted_tax_number) && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                                  Vergi no eşleşti
                                </span>
                              )}

                              <select
                                value={linkCariId}
                                onChange={e => setLinkCariId(e.target.value)}
                                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">— Cari seçiniz —</option>
                                {cariler.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>

                              <button
                                onClick={() => handleLinkCari(doc.id)}
                                disabled={!linkCariId || busy === doc.id}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                              >
                                {busy === doc.id ? 'Kaydediliyor…' : 'Bağla'}
                              </button>
                              <button
                                onClick={() => setLinkingId(null)}
                                className="text-xs text-gray-400 hover:text-gray-700"
                              >
                                İptal
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
