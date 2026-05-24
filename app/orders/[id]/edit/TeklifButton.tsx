'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

interface Props {
  orderId: string
  companyId: string
  existingOfferId?: string | null
  orderData: {
    cari_id: string | null
    customer_name: string
    customer_phone: string | null
    customer_city: string | null
    door_type: string | null
    dimensions: string | null
    quantity: number
    unit_price: number
    notes: string | null
    image_url?: string | null
  }
}

export default function TeklifButton({ orderId, companyId, existingOfferId, orderData }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (existingOfferId) {
      router.push(`/offers/${existingOfferId}`)
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('offers')
        .insert({
          company_id:     companyId,
          order_id:       orderId,
          cari_id:        orderData.cari_id,
          customer_name:  orderData.customer_name,
          customer_phone: orderData.customer_phone || null,
          customer_city:  orderData.customer_city  || null,
          door_type:      orderData.door_type as any,
          dimensions:     orderData.dimensions,
          quantity:       orderData.quantity,
          unit_price:     orderData.unit_price,
          notes:          orderData.notes,
          image_url:      orderData.image_url ?? null,
          status:         'taslak',
        })
        .select('id')
        .single()

      if (error || !data) {
        alert('Teklif oluşturulamadı: ' + (error?.message ?? 'Bilinmeyen hata'))
        return
      }

      router.push(`/offers/${data.id}`)
    } catch {
      alert('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
    >
      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {loading ? 'Hazırlanıyor…' : existingOfferId ? 'Teklifi Aç' : 'Teklif Oluştur'}
    </button>
  )
}
