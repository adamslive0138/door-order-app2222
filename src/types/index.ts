export type OrderStatus = 'siparis_alindi' | 'uretimde' | 'gonderildi'
export type DoorType = 'celik_kapi' | 'villa_kapisi' | 'yangin_kapisi' | 'menfezli_kapi' | 'panjurlu_kapi'

export interface Order {
  id: string
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
  company_id: string
  is_archived: boolean | null
  lock_brand: string | null
  lock_system: string | null
  frame_color: string | null
  mdf_thickness: string | null
  mdf_thickness_other: string | null
  steel_thickness: string | null
}

export const DOOR_TYPE_LABELS: Record<DoorType, string> = {
  celik_kapi: 'Çelik Kapı',
  villa_kapisi: 'Villa Kapısı',
  yangin_kapisi: 'Yangın Kapısı',
  menfezli_kapi: 'Menfezli Kapı',
  panjurlu_kapi: 'Panjurlu Kapı',
}
