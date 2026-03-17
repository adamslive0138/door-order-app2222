import type { OrderStatus } from '@/src/types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  siparis_alindi: 'Sipariş Alındı',
  uretimde: 'Üretimde',
  gonderildi: 'Gönderildi',
}

const STATUS_CLASSES: Record<OrderStatus, string> = {
  siparis_alindi: 'bg-amber-100 text-amber-800',
  uretimde: 'bg-blue-100 text-blue-800',
  gonderildi: 'bg-green-100 text-green-800',
}

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
