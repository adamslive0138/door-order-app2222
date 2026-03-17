'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import type { DoorType, Order, OrderStatus } from '@/src/types'
import { DOOR_TYPE_LABELS } from '@/src/types'
import StatusSelect from './StatusSelect'
import { exportOrdersToExcel } from './exportExcel'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('tr-TR')
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  siparis_alindi: 'Sipariş Alındı',
  uretimde: 'Üretimde',
  gonderildi: 'Gönderildi',
}

interface Props {
  orders: Order[]
  error: boolean
}

// ─── Password confirmation modal ─────────────────────────────────────────────
interface DeleteDialogProps {
  count: number
  onConfirm: (password: string) => Promise<string | null>
  onClose: () => void
}

function DeleteDialog({ count, onConfirm, onClose }: DeleteDialogProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await onConfirm(password)
    if (err) {
      setError(err)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900">Silme İşlemini Onayla</h2>
        <p className="mt-2 text-sm text-gray-500">
          <strong>{count}</strong> sipariş kalıcı olarak silinecek. Devam etmek için şifrenizi girin.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Şifreniz</label>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? 'Kontrol ediliyor...' : 'Sil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OrdersTable({ orders, error }: Props) {
  const router = useRouter()

  // Filters
  const [search, setSearch] = useState('')
  const [doorType, setDoorType] = useState<DoorType | ''>('')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selectAllRef = useRef<HTMLInputElement>(null)

  // Bulk operation state
  const [bulkBusy, setBulkBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = dateFrom ? new Date(dateFrom) : null
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : null
    return orders.filter((o) => {
      if (
        q &&
        !o.customer_name.toLowerCase().includes(q) &&
        !o.customer_phone.toLowerCase().includes(q) &&
        !o.customer_city.toLowerCase().includes(q)
      ) return false
      if (doorType && o.door_type !== doorType) return false
      if (status && o.status !== status) return false
      if (from && new Date(o.created_at) < from) return false
      if (to && new Date(o.created_at) > to) return false
      return true
    })
  }, [orders, search, doorType, status, dateFrom, dateTo])

  const filteredIds = useMemo(() => filtered.map((o) => o.id), [filtered])
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))
  const someFilteredSelected = filteredIds.some((id) => selectedIds.has(id)) && !allFilteredSelected
  const selectedCount = [...selectedIds].filter((id) => orders.some((o) => o.id === id)).length

  // Sync indeterminate state on select-all checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected
    }
  }, [someFilteredSelected])

  const hasActiveFilters = search || doorType || status || dateFrom || dateTo

  // ── Selection handlers ────────────────────────────────────────────────────
  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id))
      } else {
        filteredIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Single archive ────────────────────────────────────────────────────────
  async function handleArchive(id: string) {
    if (!window.confirm('Bu sipariş arşivlensin mi?')) return
    setArchivingId(id)
    const supabase = createClient()
    await supabase.from('orders').update({ is_archived: true }).eq('id', id)
    router.refresh()
    setArchivingId(null)
  }

  // ── Bulk archive ──────────────────────────────────────────────────────────
  async function handleBulkArchive() {
    if (!window.confirm(`Seçilen ${selectedCount} sipariş arşivlensin mi?`)) return
    setBulkBusy(true)
    const supabase = createClient()
    await supabase.from('orders').update({ is_archived: true }).in('id', [...selectedIds])
    setSelectedIds(new Set())
    router.refresh()
    setBulkBusy(false)
  }

  // ── Bulk delete (password-confirmed) ─────────────────────────────────────
  async function handleDeleteConfirm(password: string): Promise<string | null> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return 'Kullanıcı bilgisi alınamadı.'

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })
    if (authError) return 'Şifre hatalı. Silme işlemi iptal edildi.'

    await supabase.from('orders').delete().in('id', [...selectedIds])
    setSelectedIds(new Set())
    setShowDeleteDialog(false)
    router.refresh()
    return null
  }

  // ── Excel export ──────────────────────────────────────────────────────────
  async function handleExport() {
    const rows = filtered.filter((o) => selectedIds.has(o.id))
    setExporting(true)
    try {
      await exportOrdersToExcel(rows)
    } finally {
      setExporting(false)
    }
  }

  // ── Shared input style ────────────────────────────────────────────────────
  const inputClass =
    'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showDeleteDialog && (
        <DeleteDialog
          count={selectedCount}
          onConfirm={handleDeleteConfirm}
          onClose={() => setShowDeleteDialog(false)}
        />
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3">
          {/* Row 1: search + dropdowns + new order */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                placeholder="Müşteri, telefon veya şehir ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} w-full sm:w-64`}
              />
              <select
                value={doorType}
                onChange={(e) => setDoorType(e.target.value as DoorType | '')}
                className={`${inputClass} w-full sm:w-44`}
              >
                <option value="">Tüm Kapı Tipleri</option>
                {(Object.keys(DOOR_TYPE_LABELS) as DoorType[]).map((key) => (
                  <option key={key} value={key}>{DOOR_TYPE_LABELS[key]}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus | '')}
                className={`${inputClass} w-full sm:w-44`}
              >
                <option value="">Tüm Durumlar</option>
                {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((key) => (
                  <option key={key} value={key}>{STATUS_LABELS[key]}</option>
                ))}
              </select>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-gray-400">{filtered.length} / {orders.length} sipariş</span>
              <Link
                href="/orders/new"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                + Yeni Sipariş
              </Link>
            </div>
          </div>

          {/* Row 2: date range */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-xs font-medium text-gray-500 sm:w-28">Sipariş Tarihi:</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputClass}
                title="Başlangıç Tarihi"
              />
              <span className="text-xs text-gray-400">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputClass}
                title="Bitiş Tarihi"
              />
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearch(''); setDoorType(''); setStatus(''); setDateFrom(''); setDateTo('') }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Filtreleri temizle
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Bulk actions bar ── */}
        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-blue-100 bg-blue-50 px-4 py-2">
            <span className="text-sm font-medium text-blue-700">
              Seçilen: {selectedCount} sipariş
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleBulkArchive}
                disabled={bulkBusy}
                className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200 disabled:opacity-50"
              >
                Arşivle
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                disabled={bulkBusy}
                className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
              >
                Sil
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="rounded-lg border border-green-300 bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 transition-colors hover:bg-green-200 disabled:opacity-50"
              >
                {exporting ? 'Hazırlanıyor...' : 'Excel\'e Aktar'}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Seçimi temizle
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-8 text-center text-sm text-red-500">
            Siparişler yüklenirken bir hata oluştu.
          </div>
        )}

        {/* Empty — no orders at all */}
        {!error && orders.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            Henüz sipariş bulunmuyor.
          </div>
        )}

        {/* Empty — filtered to nothing */}
        {!error && orders.length > 0 && filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            Arama kriterlerine uyan sipariş bulunamadı.
          </div>
        )}

        {/* ── Table ── */}
        {!error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      title="Tümünü Seç"
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3">Görsel</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Kapı Tipi</th>
                  <th className="px-4 py-3">Şehir</th>
                  <th className="px-4 py-3 text-right">Adet</th>
                  <th className="px-4 py-3 text-right">Toplam</th>
                  <th className="px-4 py-3">Tarihler</th>
                  <th className="px-4 py-3">Kapının Özellikleri</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((order) => {
                  const isSelected = selectedIds.has(order.id)
                  const mdfDisplay = order.mdf_thickness === 'Diğer'
                    ? (order.mdf_thickness_other ?? '—')
                    : (order.mdf_thickness ?? null)

                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors hover:bg-gray-50 ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(order.id)}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-blue-600"
                        />
                      </td>

                      {/* Görsel */}
                      <td className="px-4 py-3">
                        {order.image_url ? (
                          <a href={order.image_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={order.image_url}
                              alt="Sipariş görseli"
                              className="h-10 w-10 rounded-md border border-gray-200 object-cover transition-opacity hover:opacity-75"
                            />
                          </a>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50">
                            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </td>

                      {/* Müşteri */}
                      <td className="px-4 py-3 font-medium text-gray-900">{order.customer_name}</td>

                      {/* Kapı Tipi */}
                      <td className="px-4 py-3 text-gray-600">
                        {DOOR_TYPE_LABELS[order.door_type] ?? order.door_type}
                      </td>

                      {/* Şehir */}
                      <td className="px-4 py-3 text-gray-600">{order.customer_city}</td>

                      {/* Adet */}
                      <td className="px-4 py-3 text-right text-gray-600">{order.quantity}</td>

                      {/* Toplam */}
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(order.total_price)}
                      </td>

                      {/* Tarihler */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-xs">
                          <div>
                            <span className="text-gray-400">Sipariş:</span>{' '}
                            <span className="text-gray-700">{formatDate(order.created_at)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Termin:</span>{' '}
                            <span className="font-medium text-gray-800">{formatDate(order.deadline_date)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Kapının Özellikleri */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-xs leading-5">
                          {order.dimensions && <div><span className="text-gray-400">Ölçü:</span> <span className="text-gray-700">{order.dimensions}</span></div>}
                          {order.lock_brand && <div><span className="text-gray-400">Kilit Markası:</span> <span className="text-gray-700">{order.lock_brand}</span></div>}
                          {order.lock_system && <div><span className="text-gray-400">Kilit Sistemi:</span> <span className="text-gray-700">{order.lock_system}</span></div>}
                          {order.frame_color && <div><span className="text-gray-400">Kasa Rengi:</span> <span className="text-gray-700">{order.frame_color}</span></div>}
                          {mdfDisplay && <div><span className="text-gray-400">MDF Kalınlığı:</span> <span className="text-gray-700">{mdfDisplay}</span></div>}
                          {order.steel_thickness && <div><span className="text-gray-400">Sac Kalınlığı:</span> <span className="text-gray-700">{order.steel_thickness}</span></div>}
                          {!order.dimensions && !order.lock_brand && !order.lock_system && !order.frame_color && !mdfDisplay && !order.steel_thickness && (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>
                      </td>

                      {/* Durum */}
                      <td className="px-4 py-3">
                        <StatusSelect orderId={order.id} status={order.status} />
                      </td>

                      {/* Eylemler */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <Link
                            href={`/orders/${order.id}/edit`}
                            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-center text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            Düzenle
                          </Link>
                          <button
                            onClick={() => handleArchive(order.id)}
                            disabled={archivingId === order.id}
                            className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                          >
                            {archivingId === order.id ? '...' : 'Arşivle'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
