'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/client'
import { CHECK_STATUS_LABELS, CHECK_STATUS_COLORS, CHECK_DIRECTION_LABELS } from '@/src/types'
import type { CheckStatus } from '@/src/types'

type CheckRow = {
  id: string
  owner_id?: string | null
  check_direction: 'alindi' | 'verildi'
  check_status: CheckStatus
  amount: number
  due_date: string | null
  check_no: string | null
  bank_name: string | null
  source_cari: { name: string } | null
  target_cari: { name: string } | null
  front_image_path?: string | null
  back_image_path?: string | null
}

interface Props {
  rows: CheckRow[]
  ownerNames?: Record<string, string>
}

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR')
}

export default function ChecksTable({ rows, ownerNames = {} }: Props) {
  const router = useRouter()
  const [busy,        setBusy]        = useState<string | null>(null)
  const [signedUrls,  setSignedUrls]  = useState<Record<string, string>>({})
  const [previewRow,  setPreviewRow]  = useState<CheckRow | null>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Pre-generate signed URLs for all image paths
  useEffect(() => {
    const paths = rows.flatMap(r =>
      [r.front_image_path, r.back_image_path].filter((p): p is string => !!p)
    )
    if (!paths.length) return

    const supabase = createClient()
    Promise.all(
      paths.map(async path => {
        const { data } = await supabase.storage.from('check-images').createSignedUrl(path, 3600)
        return [path, data?.signedUrl ?? null] as [string, string | null]
      })
    ).then(results => {
      const map: Record<string, string> = {}
      results.forEach(([p, url]) => { if (url) map[p] = url })
      setSignedUrls(map)
    })
  }, [rows])

  async function handleTahsil(id: string) {
    const confirmed = window.confirm('Bu çeki tahsil etmek istiyor musunuz?')
    if (!confirmed) return
    setBusy(id)
    const { error } = await createClient()
      .from('checks')
      .update({ check_status: 'tahsil_edildi' })
      .eq('id', id)
    setBusy(null)
    if (error) { alert(error.message); return }
    router.refresh()
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3" />
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Tür</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Sorumlu</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Cari</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Tutar</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Vade</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Çek No</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Banka</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500">Durum</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => {
              const thumbPath = r.front_image_path ?? r.back_image_path ?? null
              const thumbUrl  = thumbPath ? signedUrls[thumbPath] : null
              const dueDate   = r.due_date ? new Date(r.due_date) : null
              const isOverdue = !!dueDate && dueDate < today && r.check_status !== 'tahsil_edildi'
              const isTahsil  = r.check_status === 'tahsil_edildi'

              return (
                <tr key={r.id} className={`transition-colors hover:bg-gray-50 ${isOverdue ? 'bg-red-50/40' : ''}`}>

                  {/* Thumbnail */}
                  <td className="px-4 py-3">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt="Çek"
                        onClick={() => setPreviewRow(r)}
                        className="h-10 w-10 cursor-pointer rounded border object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded border border-dashed border-gray-200 bg-gray-50" />
                    )}
                  </td>

                  {/* Tür */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.check_direction === 'alindi' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {CHECK_DIRECTION_LABELS[r.check_direction]}
                      </span>
                      {isOverdue && <span title="Vadesi geçmiş">⚠️</span>}
                    </div>
                  </td>

                  {/* Sorumlu */}
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {r.owner_id ? (ownerNames[r.owner_id] ?? '—') : '—'}
                  </td>

                  {/* Cari */}
                  <td className="px-4 py-3 text-gray-800">
                    {r.source_cari?.name ?? '—'}
                    {r.target_cari && (
                      <span className="ml-1 text-xs text-gray-400">→ {r.target_cari.name}</span>
                    )}
                  </td>

                  {/* Tutar */}
                  <td className="px-4 py-3 font-semibold text-gray-900">₺{fmt(Number(r.amount))}</td>

                  {/* Vade */}
                  <td className={`px-4 py-3 ${isOverdue ? 'font-medium text-red-600' : 'text-gray-600'}`}>
                    {fmtDate(r.due_date)}
                  </td>

                  {/* Çek No */}
                  <td className="px-4 py-3 text-gray-500">{r.check_no ?? '—'}</td>

                  {/* Banka */}
                  <td className="px-4 py-3 text-gray-500">{r.bank_name ?? '—'}</td>

                  {/* Durum */}
                  <td className="px-4 py-3">
                    {isOverdue && !isTahsil ? (
                      <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Ödenmedi
                      </span>
                    ) : (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${CHECK_STATUS_COLORS[r.check_status]}`}>
                        {CHECK_STATUS_LABELS[r.check_status]}
                      </span>
                    )}
                  </td>

                  {/* Aksiyonlar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {!isTahsil && (
                        <button
                          onClick={() => handleTahsil(r.id)}
                          disabled={busy === r.id}
                          className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                        >
                          {busy === r.id ? '…' : 'Tahsil Et'}
                        </button>
                      )}
                      <Link href={`/checks/${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                        Detay →
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Image preview modal — front on top, back below */}
      {previewRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewRow(null)}
        >
          <div
            className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {previewRow.front_image_path && signedUrls[previewRow.front_image_path] && (
              <div>
                <p className="mb-1 text-center text-xs font-medium text-white/60">Ön Yüz</p>
                <img
                  src={signedUrls[previewRow.front_image_path]}
                  alt="Ön yüz"
                  className="max-w-[80vw] rounded-lg"
                />
              </div>
            )}
            {previewRow.back_image_path && signedUrls[previewRow.back_image_path] && (
              <div>
                <p className="mb-1 text-center text-xs font-medium text-white/60">Arka Yüz</p>
                <img
                  src={signedUrls[previewRow.back_image_path]}
                  alt="Arka yüz"
                  className="max-w-[80vw] rounded-lg"
                />
              </div>
            )}
            <button
              onClick={() => setPreviewRow(null)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </>
  )
}
