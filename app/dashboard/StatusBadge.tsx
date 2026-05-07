import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/src/types'
import type { OrderStatus } from '@/src/types'

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const label = ORDER_STATUS_LABELS[status] ?? status
  const color = ORDER_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}
