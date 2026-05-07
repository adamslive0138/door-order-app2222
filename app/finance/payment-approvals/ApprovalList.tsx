'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const PAYMENT_LABELS: Record<string, string> = {
  nakit: 'Nakit', havale: 'Havale/EFT', kart: 'Kart', cek: 'Çek',
}

type Approval = {
  id: string
  amount: number
  description: string | null
  payment_method: string | null
  receipt_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  cariler: { id: string; name: string } | null
  owner?: { full_name: string | null } | null
}

function ApprovalRow({ approval, onAction }: { approval: Approval; onAction: () => void }) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [done, setDone] = useState(false)

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    const res = await fetch(`/api/payment-approvals/${approval.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setLoading(null)
    if (res.ok) { setDone(true); onAction() }
  }

  if (done) return null

  const isPending = approval.status === 'pending'

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/60">
      <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">
        {fmtDate(approval.created_at)}
      </td>
      <td className="px-4 py-3.5 text-sm font-medium text-gray-900">
        {approval.cariler?.name ?? '—'}
      </td>
      <td className="px-4 py-3.5 text-xs text-gray-500">
        {approval.owner?.full_name ?? '—'}
      </td>
      <td className="px-4 py-3.5 text-sm font-semibold text-green-600 whitespace-nowrap">
        {fmt(approval.amount)}
      </td>
      <td className="px-4 py-3.5 text-xs text-gray-500">
        {approval.payment_method ? PAYMENT_LABELS[approval.payment_method] ?? approval.payment_method : '—'}
      </td>
      <td className="max-w-xs truncate px-4 py-3.5 text-sm text-gray-500">
        {approval.description ?? '—'}
      </td>
      <td className="px-4 py-3.5">
        {approval.receipt_url ? (
          <a
            href={approval.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-blue-200 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Görüntüle
          </a>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {isPending ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => act('approve')}
              disabled={!!loading}
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'approve' ? '...' : '✓ Onayla'}
            </button>
            <button
              onClick={() => act('reject')}
              disabled={!!loading}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {loading === 'reject' ? '...' : '✕ Reddet'}
            </button>
          </div>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            approval.status === 'approved'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-600'
          }`}>
            {approval.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
          </span>
        )}
      </td>
    </tr>
  )
}

export default function ApprovalList({
  pending,
  resolved,
}: {
  pending: Approval[]
  resolved: Approval[]
}) {
  const router = useRouter()

  function onAction() {
    router.refresh()
  }

  const cols = (
    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
      <th className="px-4 py-3">Tarih</th>
      <th className="px-4 py-3">Cari</th>
      <th className="px-4 py-3">Satışçı</th>
      <th className="px-4 py-3">Tutar</th>
      <th className="px-4 py-3">Yöntem</th>
      <th className="px-4 py-3">Açıklama</th>
      <th className="px-4 py-3">Dekont</th>
      <th className="px-4 py-3">İşlem</th>
    </tr>
  )

  return (
    <div className="space-y-6">
      {/* Pending */}
      <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-amber-800">
            Onay Bekleyenler
            {pending.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                {pending.length}
              </span>
            )}
          </h2>
        </div>
        {pending.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Onay bekleyen tahsilat yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>{cols}</thead>
              <tbody>
                {pending.map(a => (
                  <ApprovalRow key={a.id} approval={a} onAction={onAction} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-600">Geçmiş</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>{cols}</thead>
              <tbody>
                {resolved.map(a => (
                  <ApprovalRow key={a.id} approval={a} onAction={onAction} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
