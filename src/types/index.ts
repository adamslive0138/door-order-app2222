import type { OrderItem } from '../lib/order-item'
export type { OrderItem } from '../lib/order-item'

export type OrderStatus =
  | 'beklemede'
  | 'onaylandi'
  | 'uretimde'
  | 'hazir'
  | 'sevkte'
  | 'tamamlandi'
  | 'iptal'
  // legacy values — kept for backward-compat with existing DB records
  | 'teslim_edildi'
  | 'odeme_bekleniyor'
  | 'kismi_odeme'
  | 'odendi'
export type DoorType = 'celik_kapi' | 'villa_kapisi' | 'yangin_kapisi' | 'menfezli_kapi' | 'panjurlu_kapi'

export interface Order {
  id: string
  company_id: string
  owner_id: string | null
  cari_id: string | null
  customer_name: string
  customer_phone: string
  customer_city: string
  door_type: DoorType
  dimensions: string
  image_url: string | null
  quantity: number
  unit_price: number
  total_price: number
  notes: string | null
  deadline_date: string | null
  status: OrderStatus
  created_at: string
  updated_at: string | null
  is_archived: boolean | null
  operation_note: string | null
  production_start_date: string | null
  ready_date: string | null
  shipped_date: string | null
  delivered_date: string | null
  lock_brand: string | null
  lock_system: string | null
  frame_color: string | null
  mdf_thickness: string | null
  mdf_thickness_other: string | null
  steel_thickness: string | null
  /** KDV (VAT) rate in percent. Defaults to 20 for legacy records. */
  kdv_rate: number | null
  /** JSONB column — array of per-door items. Null on legacy records with no items. */
  items: OrderItem[] | null
}

export const DOOR_TYPE_LABELS: Record<DoorType, string> = {
  celik_kapi:    'Çelik Kapı',
  villa_kapisi:  'Villa Kapısı',
  yangin_kapisi: 'Yangın Kapısı',
  menfezli_kapi: 'Menfezli Kapı',
  panjurlu_kapi: 'Panjurlu Kapı',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  beklemede:        'Beklemede',
  onaylandi:        'Onaylandı',
  uretimde:         'Üretimde',
  hazir:            'Hazır',
  sevkte:           'Sevkte',
  tamamlandi:       'Tamamlandı',
  iptal:            'İptal',
  // legacy
  teslim_edildi:    'Teslim Edildi',
  odeme_bekleniyor: 'Ödeme Bekleniyor',
  kismi_odeme:      'Kısmi Ödeme',
  odendi:           'Ödendi',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  beklemede:        'bg-gray-100 text-gray-600',
  onaylandi:        'bg-blue-50 text-blue-700',
  uretimde:         'bg-blue-100 text-blue-700',
  hazir:            'bg-indigo-100 text-indigo-700',
  sevkte:           'bg-purple-100 text-purple-700',
  tamamlandi:       'bg-green-100 text-green-700',
  iptal:            'bg-red-100 text-red-700',
  // legacy
  teslim_edildi:    'bg-green-100 text-green-700',
  odeme_bekleniyor: 'bg-yellow-100 text-yellow-700',
  kismi_odeme:      'bg-amber-100 text-amber-700',
  odendi:           'bg-emerald-100 text-emerald-700',
}

/** Higher = further along the operational pipeline. iptal = -1 (terminal / off-track). */
export const ORDER_STATUS_RANK: Record<OrderStatus, number> = {
  beklemede:        0,
  onaylandi:        1,
  uretimde:         2,
  hazir:            3,
  sevkte:           4,
  tamamlandi:       5,
  iptal:           -1,
  // legacy — mapped to nearest equivalent rank
  teslim_edildi:    5,
  odeme_bekleniyor: 5,
  kismi_odeme:      5,
  odendi:           5,
}

/** Active statuses shown in the progress stepper (excludes legacy + iptal). */
export const ORDER_STATUS_STEPS: OrderStatus[] = [
  'beklemede', 'onaylandi', 'uretimde', 'hazir', 'sevkte', 'tamamlandi',
]

// ─── Cari Takip ────────────────────────────────────────────────────────────────

export type CariTipi    = 'musteri' | 'tedarikci' | 'her_ikisi'
export type CariStatus  = 'aktif' | 'pasif' | 'arsiv'
export type HareketTipi = 'tahsilat' | 'odeme' | 'alacak' | 'borc'

export const CARI_STATUS_LABELS: Record<CariStatus, string> = {
  aktif: 'Aktif',
  pasif: 'Pasif',
  arsiv: 'Arşiv',
}

export const CARI_STATUS_COLORS: Record<CariStatus, string> = {
  aktif: 'bg-green-50 text-green-700',
  pasif: 'bg-gray-100 text-gray-500',
  arsiv: 'bg-red-50 text-red-600',
}

export interface Cari {
  id: string
  company_id: string
  owner_id: string | null
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  city: string | null
  address: string | null
  tax_office: string | null
  tax_number: string | null
  notes: string | null
  cari_type: CariTipi
  cari_status: CariStatus | null
  image_url: string | null
  created_at: string
  updated_at: string | null
}

export interface CariHareket {
  id: string
  company_id: string
  cari_id: string
  transaction_type: HareketTipi
  payment_method: string | null
  amount: number
  description: string | null
  transaction_date: string | null
  receipt_url: string | null
  created_at: string
}

export const CARI_TIPI_LABELS: Record<CariTipi, string> = {
  musteri:   'Müşteri',
  tedarikci: 'Tedarikçi',
  her_ikisi: 'Her İkisi',
}

export const HAREKET_TIPI_LABELS: Record<HareketTipi, string> = {
  tahsilat: 'Tahsilat',
  odeme:    'Ödeme',
  alacak:   'Satış / Alacak',
  borc:     'Alış / Borç',
}

export const ODEME_YONTEMI_OPTIONS = [
  { value: 'nakit',       label: 'Nakit' },
  { value: 'havale',      label: 'Havale / EFT' },
  { value: 'cek',         label: 'Çek' },
  { value: 'senet',       label: 'Senet' },
  { value: 'kredi_karti', label: 'Kredi Kartı' },
  { value: 'diger',       label: 'Diğer' },
] as const

// ─── Roles ─────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'satis' | 'finans' | 'operasyon'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:     'Yönetici',
  satis:     'Satış',
  finans:    'Finans',
  operasyon: 'Operasyon',
}

// ─── Offers (Teklifler) ────────────────────────────────────────────────────────

export type OfferStatus = 'taslak' | 'gonderildi' | 'kabul_edildi' | 'reddedildi'

export interface Offer {
  id: string
  company_id: string
  order_id: string | null
  cari_id: string | null
  customer_name: string
  customer_phone: string | null
  customer_city: string | null
  door_type: DoorType | null
  dimensions: string | null
  image_url: string | null
  quantity: number
  unit_price: number
  total_price: number
  notes: string | null
  offer_text: string | null
  status: OfferStatus
  created_at: string
  updated_at: string | null
}

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  taslak:       'Hazırlanıyor',
  gonderildi:   'Gönderildi',
  kabul_edildi: 'Onaylandı',
  reddedildi:   'Reddedildi',
}

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  taslak:       'bg-gray-100 text-gray-600',
  gonderildi:   'bg-blue-100 text-blue-700',
  kabul_edildi: 'bg-green-100 text-green-700',
  reddedildi:   'bg-red-100 text-red-700',
}

// ─── Checks (Çekler) ──────────────────────────────────────────────────────────

export type CheckDirection = 'alindi' | 'verildi'
export type CheckStatus    = 'portfoy' | 'devredildi' | 'tahsil_edildi' | 'iade'

export interface Check {
  id: string
  company_id: string
  owner_id: string | null
  source_cari_id: string | null
  target_cari_id: string | null
  check_direction: CheckDirection
  check_status: CheckStatus
  check_no: string | null
  bank_name: string | null
  branch_name: string | null
  account_no: string | null
  amount: number
  due_date: string
  issue_date: string | null
  description: string | null
  receipt_url: string | null
  created_at: string
  updated_at: string | null
}

export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = {
  portfoy:       'Portföyde',
  devredildi:    'Devredildi',
  tahsil_edildi: 'Tahsil Edildi',
  iade:          'İade',
}

export const CHECK_STATUS_COLORS: Record<CheckStatus, string> = {
  portfoy:       'bg-blue-50 text-blue-700',
  devredildi:    'bg-amber-50 text-amber-700',
  tahsil_edildi: 'bg-green-50 text-green-700',
  iade:          'bg-red-50 text-red-700',
}

export const CHECK_DIRECTION_LABELS: Record<CheckDirection, string> = {
  alindi:   'Alınan Çek',
  verildi:  'Verilen Çek',
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentFileType = 'fatura' | 'dekont' | 'diger'
export type DocumentExtractedType = 'alis' | 'satis'

export interface Document {
  id: string
  company_id: string
  file_url: string
  file_type: DocumentFileType
  extracted_name: string | null
  extracted_amount: number | null
  extracted_date: string | null
  extracted_tax_number: string | null
  extracted_type: DocumentExtractedType | null
  extracted_description: string | null
  linked_cari_id: string | null
  is_processed: boolean
  is_duplicate: boolean
  created_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a single hareket's signed contribution to net bakiye.
 *   alacak / odeme  →  +amount  (increases net in our favour)
 *   borc   / tahsilat → -amount  (decreases net in our favour)
 * Use this wherever you need a per-row delta without importing calcBakiye.
 */
export function hareketNetDelta(h: Pick<CariHareket, 'transaction_type' | 'amount'>): number {
  const amt = Number(h.amount)
  return (h.transaction_type === 'alacak' || h.transaction_type === 'odeme') ? amt : -amt
}

/**
 * Calculates cari account balance from all movement types.
 *
 * Business semantics (from company perspective):
 *   alacak   — receivable created by a sale  → increases net (they owe us)
 *   odeme    — cash we paid to them          → increases net (reduces our debt)
 *   borc     — payable created by a purchase → decreases net (we owe them)
 *   tahsilat — cash we received from them    → decreases net (reduces their debt)
 *
 * Formula: net = (alacak + odeme) - (borc + tahsilat)
 *   net > 0 → the other party owes us
 *   net < 0 → we owe the other party
 */
export function calcBakiye(hareketler: CariHareket[]) {
  const alacak   = hareketler.filter(h => h.transaction_type === 'alacak').reduce((s, h) => s + Number(h.amount), 0)
  const borc     = hareketler.filter(h => h.transaction_type === 'borc').reduce((s, h) => s + Number(h.amount), 0)
  const tahsilat = hareketler.filter(h => h.transaction_type === 'tahsilat').reduce((s, h) => s + Number(h.amount), 0)
  const odeme    = hareketler.filter(h => h.transaction_type === 'odeme').reduce((s, h) => s + Number(h.amount), 0)
  const net = (alacak + odeme) - (borc + tahsilat)
  return { alacak, borc, tahsilat, odeme, net }
}
