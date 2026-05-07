import type { UserRole } from '@/src/types'

export type RoleAction =
  | 'finance_edit'   // finans + admin
  | 'docs_edit'      // operasyon + admin
  | 'checks_edit'    // operasyon + finans + admin
  | 'checks_status'  // operasyon + admin
  | 'cari_status'    // satis + admin
  | 'orders_status'  // operasyon + admin

export function canDo(role: UserRole, action: RoleAction): boolean {
  switch (action) {
    case 'finance_edit':  return role === 'admin' || role === 'finans'
    case 'docs_edit':     return role === 'admin' || role === 'operasyon'
    case 'checks_edit':   return role === 'admin' || role === 'finans' || role === 'operasyon'
    case 'checks_status': return role === 'admin' || role === 'operasyon'
    case 'cari_status':   return role === 'admin' || role === 'satis'
    case 'orders_status': return role === 'admin' || role === 'operasyon'
  }
}
