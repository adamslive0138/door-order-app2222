'use client'

import { useState, useMemo } from 'react'
import type { CariHareket } from '@/src/types'
import { HAREKET_TIPI_LABELS, calcBakiye, hareketNetDelta } from '@/src/types'

interface Props {
  hareketler: CariHareket[]
  firmName: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function Ekstrem({ hareketler, firmName }: Props) {
  const [startDate, setStartDate] = useState(firstDayOfMonth())
  const [endDate,   setEndDate]   = useState(today())
  const [open,      setOpen]      = useState(false)

  const { before, during } = useMemo(() => {
    const before: CariHareket[] = []
    const during: CariHareket[] = []

    for (const h of hareketler) {
      const d = h.transaction_date
      if (!d) {
        // No date → always include in period, never in opening
        during.push(h)
        continue
      }
      if (startDate && d < startDate) {
        before.push(h)
      } else if ((!startDate || d >= startDate) && (!endDate || d <= endDate)) {
        during.push(h)
      }
    }

    // Sort during ascending for running balance
    during.sort((a, b) => {
      const da = a.transaction_date ?? ''
      const db = b.transaction_date ?? ''
      return da < db ? -1 : da > db ? 1 : 0
    })

    return { before, during }
  }, [hareketler, startDate, endDate])

  const openingNet  = calcBakiye(before).net
  const duringNet   = during.reduce((s, h) => s + hareketNetDelta(h), 0)
  const closingNet  = openingNet + duringNet

  // Running balance rows
  const rows = useMemo(() => {
    let running = openingNet
    return during.map(h => {
      const delta = hareketNetDelta(h)
      running += delta
      return { h, delta, running }
    })
  }, [during, openingNet])

  return (
    <>
      {/* Print styles — only active inside @media print */}
      <style>{`
        @media print {
          body > * { visibility: hidden; }
          .ekstrem-print-area, .ekstrem-print-area * { visibility: visible; }
          .ekstrem-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
        }
      `}</style>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Collapsible header */}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Ekstre / Mutabakat
          </span>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="border-t border-gray-100">
            {/* Date range picker */}
            <div className="flex flex-wrap items-end gap-3 px-5 py-4 no-print">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Başlangıç</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Bitiş</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Yazdır
              </button>
            </div>

            {/* Printable area */}
            <div className="ekstrem-print-area px-5 pb-5">
              {/* Print header (visible only in print) */}
              <div className="mb-4 hidden print:block">
                <h1 className="text-lg font-bold">{firmName}</h1>
                <p className="text-sm text-gray-500">
                  Ekstre: {fmtDate(startDate || null)} — {fmtDate(endDate || null)}
                </p>
              </div>

              {/* Opening balance */}
              <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
                <span className="text-xs font-semibold text-gray-500">
                  Açılış Bakiyesi
                  {startDate && <span className="ml-1 font-normal text-gray-400">({fmtDate(startDate)} öncesi — {before.length} hareket)</span>}
                </span>
                <span className={`text-sm font-bold ${openingNet >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                  {fmt(openingNet)}
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    {openingNet >= 0 ? 'alacak' : 'borç'}
                  </span>
                </span>
              </div>

              {/* Period movements table */}
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Seçilen dönemde hareket yok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-2 pr-4 text-xs font-medium text-gray-400">Tarih</th>
                        <th className="py-2 pr-4 text-xs font-medium text-gray-400">Tür</th>
                        <th className="py-2 pr-4 text-xs font-medium text-gray-400">Açıklama</th>
                        <th className="py-2 pr-4 text-right text-xs font-medium text-gray-400">Tutar</th>
                        <th className="py-2 pr-4 text-right text-xs font-medium text-gray-400">Kümülatif Bakiye</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map(({ h, delta, running }) => (
                        <tr key={h.id} className="hover:bg-gray-50/50">
                          <td className="whitespace-nowrap py-2 pr-4 text-gray-500">
                            {fmtDate(h.transaction_date)}
                          </td>
                          <td className="py-2 pr-4">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              h.transaction_type === 'alacak' ? 'bg-blue-50 text-blue-700'
                              : h.transaction_type === 'tahsilat' ? 'bg-green-50 text-green-700'
                              : h.transaction_type === 'odeme' ? 'bg-purple-50 text-purple-700'
                              : 'bg-amber-50 text-amber-700'
                            }`}>
                              {HAREKET_TIPI_LABELS[h.transaction_type]}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-gray-600 text-xs max-w-[200px] truncate">
                            {h.description ?? '—'}
                          </td>
                          <td className={`whitespace-nowrap py-2 pr-4 text-right text-xs font-semibold ${delta >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                            {delta >= 0 ? '+' : ''}{fmt(delta)}
                          </td>
                          <td className={`whitespace-nowrap py-2 text-right text-sm font-bold ${running >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                            {fmt(running)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Closing balance */}
              <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div>
                  <span className="text-xs font-semibold text-gray-500">Kapanış Bakiyesi</span>
                  {endDate && <span className="ml-1 text-xs text-gray-400">({fmtDate(endDate)} itibarıyla)</span>}
                  <p className="mt-0.5 text-xs text-gray-400">
                    Dönem içi net: <span className={`font-medium ${duringNet >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                      {duringNet >= 0 ? '+' : ''}{fmt(duringNet)}
                    </span>
                    <span className="ml-2 text-gray-300">({rows.length} hareket)</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${closingNet >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                    {fmt(Math.abs(closingNet))}
                  </p>
                  <p className="text-xs text-gray-400">{closingNet >= 0 ? 'Net alacak' : 'Net borç'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
