'use client'

import Link from 'next/link'

interface Props {
  orderId: string
  existingOfferId?: string | null
}

export default function TeklifButton({ orderId, existingOfferId }: Props) {
  const href = existingOfferId
    ? `/offers/${existingOfferId}`
    : `/offers/new?order_id=${orderId}`

  return (
    <Link
      href={href}
      prefetch
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
    >
      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {existingOfferId ? 'Teklifi Aç' : 'Teklif Oluştur'}
    </Link>
  )
}
