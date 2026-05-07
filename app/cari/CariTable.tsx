'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/client'
import type { Cari, CariStatus } from '@/src/types'
import { CARI_TIPI_LABELS, CARI_STATUS_LABELS, CARI_STATUS_COLORS } from '@/src/types'

type CariWithBakiye = Cari & { bakiye: number }

function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

export default function CariTable({
  cariler,
  activeType,
  showArsiv,
  ownerNames = {},
  isAdmin = false,
}: {
  cariler: CariWithBakiye[]
  activeType?: string
  showArsiv?: boolean
  ownerNames?: Record<string, string>
  isAdmin?: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!isAdmin) return
    if (!window.confirm('Bu cariyi silmek istiyor musun?')) return
    setDeletingId(id)
    await createClient().from('cariler').delete().eq('id', id)
    setDeletingId(null)
    router.refresh()
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    const arsivParam = showArsiv ? '&arsiv=1' : ''
    router.push(val ? `/cari?type=${val}${arsivParam}` : showArsiv ? '/cari?arsiv=1' : '/cari')
  }

  function toggleArsiv() {
    const typeParam = activeType ? `type=${activeType}&` : ''
    router.push(showArsiv ? `/cari${activeType ? `?type=${activeType}` : ''}` : `/cari?${typeParam}arsiv=1`)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cariler
    return cariler.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    )
  }, [cariler, search])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-gray-800">
          Cariler{' '}
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
            {filtered.length}
          </span>
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Firma, şehir, telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={activeType ?? ''}
            onChange={handleTypeChange}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tümü</option>
            <option value="musteri">Müşteri</option>
            <option value="tedarikci">Tedarikçi</option>
          </select>
          <button
            onClick={toggleArsiv}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              showArsiv
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {showArsiv ? 'Arşivi Gizle' : 'Arşivi Göster'}
          </button>
          <Link
            href="/cari/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            + Yeni Cari
          </Link>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="px-4 py-12 text-center text-sm text-gray-400">
          {cariler.length === 0 ? 'Henüz cari eklenmemiş.' : 'Sonuç bulunamadı.'}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Firma Adı</th>
                <th className="px-4 py-3">Cari Tipi</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Sorumlu</th>
                <th className="px-4 py-3">Telefon</th>
                <th className="px-4 py-3">Şehir</th>
                <th className="px-4 py-3 text-right">Bakiye</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((cari) => (
                <tr key={cari.id} className="transition-colors hover:bg-gray-50/80">
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/cari/${cari.id}`}
                      className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {cari.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <CariTipiBadge tipi={cari.cari_type} />
                  </td>
                  <td className="px-4 py-3.5">
                    <CariStatusBadge status={cari.cari_status} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">
                    {cari.owner_id ? (ownerNames[cari.owner_id] ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">{cari.phone ?? '—'}</td>
                  <td className="px-4 py-3.5 text-gray-500">{cari.city ?? '—'}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span
                      className={
                        cari.bakiye > 0
                          ? 'font-semibold text-green-600'
                          : cari.bakiye < 0
                          ? 'font-semibold text-red-500'
                          : 'text-gray-400'
                      }
                    >
                      {formatCurrency(cari.bakiye)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(cari.id)}
                        disabled={deletingId === cari.id}
                        className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 transition-colors"
                      >
                        {deletingId === cari.id ? '…' : 'Sil'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CariStatusBadge({ status }: { status: CariStatus | null }) {
  const s = status ?? 'aktif'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CARI_STATUS_COLORS[s]}`}>
      {CARI_STATUS_LABELS[s]}
    </span>
  )
}

function CariTipiBadge({ tipi }: { tipi: string }) {
  const colors: Record<string, string> = {
    musteri: 'bg-blue-50 text-blue-700',
    tedarikci: 'bg-amber-50 text-amber-700',
    her_ikisi: 'bg-purple-50 text-purple-700',
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[tipi] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {CARI_TIPI_LABELS[tipi as keyof typeof CARI_TIPI_LABELS] ?? tipi}
    </span>
  )
}
