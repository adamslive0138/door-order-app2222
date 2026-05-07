'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import { ODEME_YONTEMI_OPTIONS } from '@/src/types'
import type { UserRole } from '@/src/types'
import { canDo } from '@/src/lib/role'

// ── Types ────────────────────────────────────────────────────────────────────

export interface HareketRow {
  id: string
  cari_id: string | null
  cari_name: string | null
  transaction_type: string | null
  amount: number
  payment_method: string | null
  transaction_date: string | null
  description: string | null
  receipt_url: string | null
  created_at: string
}

interface Props {
  hareketler: HareketRow[]
  cariler: { id: string; name: string }[]
  type: 'tahsilat' | 'odeme'
  newHref: string
  userRole: UserRole
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PM_LABELS: Record<string, string> = {
  nakit:       'Nakit',
  havale:      'Havale / EFT',
  cek:         'Çek',
  senet:       'Senet',
  kredi_karti: 'Kredi Kartı',
  diger:       'Diğer',
}

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  const safe = d.includes('T') ? d : d + 'T00:00:00'
  return new Date(safe).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, accent, sub,
}: {
  label: string; value: string; accent?: string; sub?: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ?? 'text-gray-800'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── Edit modal ───────────────────────────────────────────────────────────────

interface EditForm {
  cari_id: string
  amount: string
  payment_method: string
  transaction_date: string
  description: string
}

function EditModal({
  row,
  cariler,
  onClose,
  onSaved,
}: {
  row: HareketRow
  cariler: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState<EditForm>({
    cari_id:          row.cari_id          ?? '',
    amount:           String(row.amount),
    payment_method:   row.payment_method   ?? '',
    transaction_date: row.transaction_date ?? row.created_at.slice(0, 10),
    description:      row.description      ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function set(field: keyof EditForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) { setError('Geçerli bir tutar giriniz.'); return }
    if (!form.cari_id)          { setError('Cari seçiniz.'); return }

    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase
      .from('cari_hareketler')
      .update({
        cari_id:          form.cari_id          || null,
        amount:           amt,
        payment_method:   form.payment_method   || null,
        transaction_date: form.transaction_date || null,
        description:      form.description.trim() || null,
      })
      .eq('id', row.id)

    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">Kaydı Düzenle</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Cari */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Cari <span className="text-red-500">*</span></label>
            <select
              value={form.cari_id}
              onChange={e => set('cari_id', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Seçiniz —</option>
              {cariler.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tutar (₺) <span className="text-red-500">*</span></label>
              <input
                type="number" min="0.01" step="0.01"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tarih</label>
              <input
                type="date"
                value={form.transaction_date}
                onChange={e => set('transaction_date', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Ödeme Yöntemi</label>
            <select
              value={form.payment_method}
              onChange={e => set('payment_method', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— Seçiniz —</option>
              {ODEME_YONTEMI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Açıklama</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
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
  row,
  onClose,
  onDeleted,
}: {
  row: HareketRow
  onClose: () => void
  onDeleted: () => void
}) {
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const { error: dbErr } = await supabase
      .from('cari_hareketler')
      .delete()
      .eq('id', row.id)
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
          <h2 className="text-sm font-semibold text-gray-900">Kaydı sil</h2>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium">{row.cari_name ?? '—'}</span> için{' '}
            <span className="font-medium">{fmt(row.amount)}</span> tutarındaki kayıt kalıcı olarak silinecek.
          </p>
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

export default function HareketListesi({ hareketler, cariler, type, newHref, userRole }: Props) {
  const canEdit = canDo(userRole, 'finance_edit')
  const router    = useRouter()
  const isIn      = type === 'tahsilat'
  const accentCls = isIn ? 'text-green-600' : 'text-red-500'
  const btnCls    = isIn
    ? 'bg-green-600 hover:bg-green-700 text-white'
    : 'bg-red-600 hover:bg-red-700 text-white'

  const [cariId,    setCariId]    = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [amtMin,    setAmtMin]    = useState('')
  const [amtMax,    setAmtMax]    = useState('')
  const [pmFilter,  setPmFilter]  = useState('')

  const [editTarget,   setEditTarget]   = useState<HareketRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HareketRow | null>(null)

  const filtered = useMemo(() => {
    return hareketler.filter(h => {
      if (cariId   && h.cari_id !== cariId)                      return false
      if (pmFilter && h.payment_method !== pmFilter)             return false
      if (amtMin   && Number(h.amount) < parseFloat(amtMin))     return false
      if (amtMax   && Number(h.amount) > parseFloat(amtMax))     return false
      const d = h.transaction_date ?? h.created_at.slice(0, 10)
      if (dateFrom && d < dateFrom) return false
      if (dateTo   && d > dateTo)   return false
      return true
    })
  }, [hareketler, cariId, dateFrom, dateTo, amtMin, amtMax, pmFilter])

  const total = filtered.reduce((s, h) => s + Number(h.amount), 0)

  const thisMonth = useMemo(() => {
    const n = new Date()
    const ym = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
    return hareketler
      .filter(h => (h.transaction_date ?? h.created_at.slice(0, 10)).startsWith(ym))
      .reduce((s, h) => s + Number(h.amount), 0)
  }, [hareketler])

  const isFiltered = !!(cariId || dateFrom || dateTo || amtMin || amtMax || pmFilter)

  function clearFilters() {
    setCariId('')
    setDateFrom('')
    setDateTo('')
    setAmtMin('')
    setAmtMax('')
    setPmFilter('')
  }

  function handleMutated() {
    setEditTarget(null)
    setDeleteTarget(null)
    router.refresh()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Edit modal ──────────────────────────────────────────────────── */}
      {editTarget && (
        <EditModal
          row={editTarget}
          cariler={cariler}
          onClose={() => setEditTarget(null)}
          onSaved={handleMutated}
        />
      )}

      {/* ── Delete confirm ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirm
          row={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleMutated}
        />
      )}

      <div className="space-y-4">

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label={isIn ? 'Toplam Tahsilat' : 'Toplam Ödeme'}
            value={fmt(total)}
            accent={accentCls}
            sub={isFiltered ? `${filtered.length} kayıt · filtrelenmiş` : `${hareketler.length} kayıt`}
          />
          <StatCard label="Bu Ay" value={fmt(thisMonth)} accent={accentCls} />
          <StatCard
            label="Ortalama"
            value={filtered.length > 0 ? fmt(total / filtered.length) : '—'}
          />
          <StatCard label="Toplam Hareket" value={`${hareketler.length}`} />
        </div>

        {/* ── Filters + CTA ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">

            {/* Cari */}
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Cari</label>
              <select
                value={cariId}
                onChange={e => setCariId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tüm cariler</option>
                {cariler.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Tarihten</label>
              <input
                type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Tarihe kadar</label>
              <input
                type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Amount range */}
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-gray-500">Min ₺</label>
              <input
                type="number" min="0" value={amtMin} onChange={e => setAmtMin(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-gray-500">Max ₺</label>
              <input
                type="number" min="0" value={amtMax} onChange={e => setAmtMax(e.target.value)}
                placeholder="∞"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Payment method */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Ödeme Yöntemi</label>
              <select
                value={pmFilter} onChange={e => setPmFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tümü</option>
                {ODEME_YONTEMI_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {isFiltered && (
                <button
                  onClick={clearFilters}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Temizle
                </button>
              )}
              <Link
                href={newHref}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${btnCls}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {isIn ? 'Yeni Tahsilat' : 'Yeni Ödeme'}
              </Link>
            </div>
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">
                {isFiltered ? 'Filtreye uyan kayıt bulunamadı.' : 'Henüz kayıt yok.'}
              </p>
              {!isFiltered && (
                <Link
                  href={newHref}
                  className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${btnCls}`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {isIn ? 'İlk Tahsilatı Ekle' : 'İlk Ödemeyi Ekle'}
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Tarih</th>
                      <th className="px-4 py-3">Cari</th>
                      <th className="px-4 py-3">Yöntem</th>
                      <th className="px-4 py-3">Açıklama</th>
                      <th className="px-4 py-3 text-right">Tutar</th>
                      <th className="w-28 px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(h => (
                      <tr key={h.id} className="transition-colors hover:bg-gray-50/80">
                        <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-600">
                          {fmtDate(h.transaction_date ?? h.created_at.slice(0, 10))}
                        </td>
                        <td className="px-4 py-3.5">
                          {h.cari_id ? (
                            <Link
                              href={`/cari/${h.cari_id}`}
                              className="font-medium text-gray-800 transition-colors hover:text-blue-600"
                            >
                              {h.cari_name ?? '—'}
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {h.payment_method ? (
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              {PM_LABELS[h.payment_method] ?? h.payment_method}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3.5 text-sm text-gray-500">
                          {h.description ?? '—'}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3.5 text-right text-sm font-bold ${accentCls}`}>
                          {isIn ? '+' : '-'}{fmt(h.amount)}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {/* Dekont görüntüle */}
                            {h.receipt_url && (
                              <a
                                href={h.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Dekontu görüntüle"
                                className="inline-flex items-center rounded-lg border border-gray-200 p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </a>
                            )}
                            {/* Düzenle */}
                            {canEdit && (
                              <button
                                onClick={() => setEditTarget(h)}
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
                                onClick={() => setDeleteTarget(h)}
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
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer summary */}
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-4 py-3">
                <span className="text-xs text-gray-400">
                  {filtered.length} kayıt gösteriliyor{isFiltered ? ' (filtrelenmiş)' : ''}
                </span>
                <div>
                  <span className="text-xs text-gray-500">Toplam: </span>
                  <span className={`text-sm font-bold ${accentCls}`}>{fmt(total)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
