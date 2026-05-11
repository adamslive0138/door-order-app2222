'use server'

import { createClient } from '@/src/lib/supabase/server'

export async function syncOrderFinanceMovement(orderId: string): Promise<void> {
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, company_id, cari_id, total_price, status, is_archived, customer_name, quantity, created_at')
    .eq('id', orderId)
    .single()

  if (!order || !order.cari_id) return

  const isCancelled = order.status === 'iptal' || order.is_archived === true
  const amount      = isCancelled ? 0 : (order.total_price ?? 0)
  const description = isCancelled
    ? `[İPTAL] Sipariş: ${order.customer_name}`
    : `Sipariş: ${order.customer_name} — ${order.quantity} adet`
  const transaction_date = (order.created_at as string).slice(0, 10)

  // PostgREST does not resolve onConflict against partial unique indexes,
  // so upsert would insert a second row. Use explicit select → update/insert instead.
  const { data: existing } = await supabase
    .from('cari_hareketler')
    .select('id')
    .eq('linked_order_id', orderId)
    .eq('is_auto_generated', true)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('cari_hareketler')
      .update({ amount, description, transaction_date, cari_id: order.cari_id })
      .eq('id', existing.id)
  } else {
    await supabase.from('cari_hareketler').insert({
      company_id:        order.company_id,
      cari_id:           order.cari_id,
      transaction_type:  'alacak',
      amount,
      description,
      transaction_date,
      linked_order_id:   orderId,
      is_auto_generated: true,
    })
  }
}
