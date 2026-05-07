'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/client'
import type { OfferStatus } from '@/src/types'
import { OFFER_STATUS_LABELS } from '@/src/types'

interface Props {
  offerId:        string
  currentStatus:  OfferStatus
  customer_phone: string | null
  orderId:        string | null   // set when already converted to order
}

const NEXT_STATUSES: Record<OfferStatus, OfferStatus[]> = {
  taslak:       ['gonderildi'],
  gonderildi:   ['kabul_edildi', 'reddedildi'],
  kabul_edildi: [],
  reddedildi:   ['taslak'],
}

export default function OfferActions({
  offerId, currentStatus, customer_phone, orderId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [updating,    setUpdating]    = useState<OfferStatus | null>(null)
  const [converting,  setConverting]  = useState(false)
  const [convertErr,  setConvertErr]  = useState<string | null>(null)
  const [showWA,      setShowWA]      = useState(false)

  async function updateStatus(newStatus: OfferStatus) {
    setUpdating(newStatus)
    await supabase.from('offers').update({ status: newStatus }).eq('id', offerId)
    setUpdating(null)
    router.refresh()
  }

  async function convertToOrder() {
    setConverting(true)
    setConvertErr(null)
    try {
      const res  = await fetch(`/api/offers/${offerId}/convert-to-order`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setConvertErr(data.error ?? 'Bir hata oluştu.'); return }
      router.push(`/orders/${data.orderId}/edit`)
    } catch {
      setConvertErr('Ağ hatası. Tekrar deneyin.')
    } finally {
      setConverting(false)
    }
  }

  const printUrl = `/offers/${offerId}/print`

  return (
    <div className="flex flex-wrap items-center gap-2">

      {/* ── Convert to order (only when approved and not yet converted) ─── */}
      {currentStatus === 'kabul_edildi' && !orderId && (
        <button
          onClick={convertToOrder}
          disabled={converting}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {converting ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Dönüştürülüyor…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Siparişe Dönüştür
            </>
          )}
        </button>
      )}

      {/* ── Link to existing order (already converted) ─────────────────── */}
      {currentStatus === 'kabul_edildi' && orderId && (
        <Link
          href={`/orders/${orderId}/edit`}
          className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Siparişi Görüntüle
        </Link>
      )}

      {convertErr && (
        <p className="w-full text-xs text-red-600 mt-1">{convertErr}</p>
      )}

      {/* ── PDF ────────────────────────────────────────────────────────── */}
      <a
        href={printUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
      >
        <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        PDF İndir
      </a>

      {/* ── Excel ──────────────────────────────────────────────────────── */}
      <a
        href={`/api/offers/${offerId}/excel`}
        download
        className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors shadow-sm"
      >
        <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Excel İndir
      </a>

      {/* ── WhatsApp ───────────────────────────────────────────────────── */}
      <div className="relative">
        <button
          onClick={() => setShowWA(v => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.12 1.522 5.853L.057 23.517a.75.75 0 00.917.943l5.906-1.473A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.7-.5-5.253-1.377l-.376-.218-3.899.972.984-3.796-.24-.386A9.937 9.937 0 012 12C2 6.478 6.478 2 12 2s10 4.478 10 10-4.478 10-10 10z"/>
          </svg>
          WhatsApp
        </button>

        {showWA && (
          <div className="absolute right-0 top-full mt-2 z-20 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            <p className="text-xs font-semibold text-gray-700 mb-2">WhatsApp ile Paylaş</p>
            {customer_phone ? (
              <a
                href={`https://wa.me/${customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent('Teklifiniz hazır. Lütfen belgeyi görüntüleyin.')}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 transition-colors"
              >
                {customer_phone} numarasına gönder
              </a>
            ) : (
              <p className="text-xs text-amber-600">Müşteri telefon numarası kayıtlı değil.</p>
            )}
            <button onClick={() => setShowWA(false)}
              className="mt-2 w-full text-center text-xs text-gray-400 hover:text-gray-600">
              Kapat
            </button>
          </div>
        )}
      </div>

      {/* ── Status transitions ─────────────────────────────────────────── */}
      {NEXT_STATUSES[currentStatus].map(next => (
        <button
          key={next}
          onClick={() => updateStatus(next)}
          disabled={updating === next}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
        >
          {updating === next ? 'Güncelleniyor…' : `→ ${OFFER_STATUS_LABELS[next]}`}
        </button>
      ))}
    </div>
  )
}
