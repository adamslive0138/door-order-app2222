'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { CariHareket, HareketTipi, UserRole } from '@/src/types'
import { HAREKET_TIPI_LABELS, ODEME_YONTEMI_OPTIONS } from '@/src/types'
import { canDo } from '@/src/lib/role'
import Link from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Badge colours per transaction type
const TIPI_STYLE: Record<string, string> = {
  tahsilat: 'bg-green-50 text-green-700',
  odeme:    'bg-red-50 text-red-700',
  alacak:   'bg-blue-50 text-blue-700',
  borc:     'bg-amber-50 text-amber-700',
}

const TIPI_AMOUNT: Record<string, { sign: string; cls: string }> = {
  tahsilat: { sign: '+', cls: 'text-green-600' },
  alacak:   { sign: '+', cls: 'text-blue-600'  },
  odeme:    { sign: '−', cls: 'text-red-500'   },
  borc:     { sign: '−', cls: 'text-amber-600' },
}

async function exportToExcel(rows: CariHareket[]) {
  const ExcelJS = (await import('exceljs')).default

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Kapı Sipariş'
  wb.created = new Date()

  const ws = wb.addWorksheet('Hareketler')

  ws.columns = [
    { header: 'Tarih',      key: 'tarih',        width: 14 },
    { header: 'İşlem Tipi', key: 'type',         width: 16 },
    { header: 'Tutar (₺)',  key: 'amount',       width: 16 },
    { header: 'Açıklama',   key: 'description',  width: 40 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 20

  rows.forEach((h) => {
    const signed = (h.transaction_type === 'alacak' || h.transaction_type === 'tahsilat')
      ? Number(h.amount) : -Number(h.amount)
    const row = ws.addRow({
      tarih:       fmtDate(h.transaction_date ?? h.created_at.slice(0, 10)),
      type:        HAREKET_TIPI_LABELS[h.transaction_type] ?? h.transaction_type,
      amount:      signed,
      description: h.description ?? '',
    })

    const amountCell = row.getCell('amount')
    amountCell.font = { color: { argb: signed >= 0 ? 'FF15803D' : 'FFDC2626' }, bold: true }
    amountCell.numFmt = '#,##0.00 "₺"'
    amountCell.alignment = { horizontal: 'right' }

    if (row.number % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
    }
  })

  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: 'A1', to: 'D1' }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hareketler_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Edit modal ────────────────────────────────────────────────────────────────

interface EditForm {
  transaction_type: HareketTipi
  amount: string
  payment_method: string
  transaction_date: string
  description: string
}

function EditModal({
  hareket,
  onClose,
  onSaved,
}: {
  hareket: CariHareket
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState<EditForm>({
    transaction_type: hareket.transaction_type,
    amount:           String(hareket.amount),
    payment_method:   hareket.payment_method   ?? '',
    transaction_date: hareket.transaction_date ?? hareket.created_at.slice(0, 10),
    description:      hareket.description      ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function set<K extends keyof EditForm>(field: K, value: EditForm[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) { setError('Geçerli bir tutar giriniz.'); return }

    setSaving(true)
    setError(null)
    const { error: dbErr } = await supabase
      .from('cari_hareketler')
      .update({
        transaction_type: form.transaction_type,
        amount:           amt,
        payment_method:   form.payment_method   || null,
        transaction_date: form.transaction_date || null,
        description:      form.description.trim() || null,
      })
      .eq('id', hareket.id)

    setSaving(false)
    if (dbErr) { setError(dbErr.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">Hareketi Düzenle</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Transaction type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">İşlem Tipi</label>
            <select
              value={form.transaction_type}
              onChange={e => set('transaction_type', e.target.value as HareketTipi)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="alacak">Satış / Alacak</option>
              <option value="borc">Alış / Borç</option>
              <option value="tahsilat">Tahsilat (Nakit Giriş)</option>
              <option value="odeme">Ödeme (Nakit Çıkış)</option>
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
  hareket,
  onClose,
  onDeleted,
}: {
  hareket: CariHareket
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
      .eq('id', hareket.id)
    setDeleting(false)
    if (dbErr) { setError(dbErr.message); return }
    onDeleted()
  }

  const label = HAREKET_TIPI_LABELS[hareket.transaction_type] ?? hareket.transaction_type

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="px-5 py-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Hareketi sil</h2>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium">{label}</span> —{' '}
            <span className="font-medium">{fmt(hareket.amount)}</span> tutarındaki kayıt kalıcı olarak silinecek.
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingApproval {
  id: string
  amount: number
  description: string | null
  payment_method: string | null
  created_at: string
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HareketListesi({
  hareketler,
  cariId,
  userRole,
  pendingApprovals = [],
}: {
  hareketler: CariHareket[]
  cariId: string
  userRole: UserRole
  pendingApprovals?: PendingApproval[]
}) {
  const canEdit = canDo(userRole, 'finance_edit')
  const router = useRouter()

  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [exporting,    setExporting]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<CariHareket | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CariHareket | null>(null)

  const allSelected = hareketler.length > 0 && selected.size === hareketler.length

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(hareketler.map((h) => h.id)))
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleExport() {
    const rows = hareketler.filter((h) => selected.has(h.id))
    if (rows.length === 0) return
    setExporting(true)
    try {
      await exportToExcel(rows)
    } finally {
      setExporting(false)
    }
  }

  function handleMutated() {
    setEditTarget(null)
    setDeleteTarget(null)
    router.refresh()
  }

  return (
    <>
      {editTarget && (
        <EditModal
          hareket={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleMutated}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          hareket={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleMutated}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Hareketler
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
              {hareketler.length + pendingApprovals.length}
            </span>
            {pendingApprovals.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {pendingApprovals.length} onay bekliyor
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={selected.size === 0 || exporting}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Hazırlanıyor…' : `Excel${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>

            <Link
              href={`/cari/${cariId}/yeni-hareket`}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              + Yeni Hareket
            </Link>
          </div>
        </div>

        {hareketler.length === 0 && pendingApprovals.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-400">Henüz hareket kaydı yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                      aria-label="Tümünü seç"
                    />
                  </th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">İşlem Tipi</th>
                  <th className="px-4 py-3">Açıklama</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                  <th className="w-20 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Pending approvals — readonly, excluded from balance */}
                {pendingApprovals.map((pa) => (
                  <tr key={`pa-${pa.id}`} className="bg-amber-50/60">
                    <td className="px-4 py-3.5">
                      <input type="checkbox" disabled className="h-4 w-4 rounded border-gray-300 opacity-30" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-500">
                      {fmtDate(pa.created_at.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Onay Bekliyor
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3.5 text-sm text-gray-400 italic">
                      {pa.description ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-amber-600">
                      +{fmt(pa.amount)}
                    </td>
                    <td className="px-3 py-3.5" />
                  </tr>
                ))}
                {hareketler.map((h) => (
                  <tr
                    key={h.id}
                    onClick={() => toggleRow(h.id)}
                    className={`cursor-pointer transition-colors ${
                      selected.has(h.id) ? 'bg-blue-50' : 'hover:bg-gray-50/80'
                    }`}
                  >
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(h.id)}
                        onChange={() => toggleRow(h.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-600">
                      {fmtDate(h.transaction_date ?? h.created_at.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          TIPI_STYLE[h.transaction_type] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {HAREKET_TIPI_LABELS[h.transaction_type] ?? h.transaction_type}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3.5 text-sm text-gray-500">
                      {h.description ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold">
                      {(() => {
                        const s = TIPI_AMOUNT[h.transaction_type] ?? { sign: '', cls: 'text-gray-600' }
                        return <span className={s.cls}>{s.sign}{fmt(h.amount)}</span>
                      })()}
                    </td>
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
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
        )}
      </div>
    </>
  )
}
