/**
 * Normalized shape of a single item stored in the JSONB `orders.items` column.
 * Legacy records may have `width` / `height` instead of `measurement`.
 */
export interface OrderItem {
  door_type:           string
  measurement:         string | null
  width:               number | null
  height:              number | null
  right_opening_count: number | null
  left_opening_count:  number | null
  quantity:            number
  unit_price:          number
  lock_brand:          string | null
  lock_system:         string | null
  frame_color:         string | null
  mdf_thickness:       string | null
  sac_kalinligi:       string | null
  kanat_kalinligi:     string | null
  image_path:          string | null
  /** Set when the item was created from a stock model. Used to decrement stock on order creation. */
  stock_model_id:      string | null | undefined
}

export const DOOR_LABELS: Record<string, string> = {
  celik_kapi:    'Çelik Kapı',
  villa_kapisi:  'Villa Kapısı',
  yangin_kapisi: 'Yangın Kapısı',
  menfezli_kapi: 'Menfezli Kapı',
  panjurlu_kapi: 'Panjurlu Kapı',
  diger:         'Diğer',
}

export function doorTypeLabel(doorType: string | null | undefined): string {
  if (!doorType) return '-'
  return DOOR_LABELS[doorType] ?? doorType
}

/** Resolves measurement, falling back to legacy width×height for old records. */
export function itemMeasurement(item: Pick<OrderItem, 'measurement' | 'width' | 'height'>): string {
  if (item.measurement) return item.measurement
  if (item.width && item.height) return `${item.width}×${item.height}`
  return '-'
}

/**
 * Builds spec detail parts for an item (e.g. kilit, kasa, MDF…).
 * Returns raw strings — caller decides separator (HTML · or newline for text).
 */
export function buildItemSpecParts(
  item: Pick<OrderItem, 'lock_system' | 'lock_brand' | 'frame_color' | 'mdf_thickness' | 'sac_kalinligi' | 'kanat_kalinligi'>,
): string[] {
  return [
    item.lock_system     ? `Kilit Sistemi: ${item.lock_system}`              : null,
    item.lock_brand      ? `Kilit Markası: ${item.lock_brand}`               : null,
    item.frame_color     ? `Kasa Rengi: ${item.frame_color}`                 : null,
    item.mdf_thickness   ? `MDF Kalınlığı: ${item.mdf_thickness}`           : null,
    item.sac_kalinligi   ? `Sac Kalınlığı: ${item.sac_kalinligi} mm`       : null,
    item.kanat_kalinligi ? `Kanat Kalınlığı: ${item.kanat_kalinligi} mm`   : null,
  ].filter((x): x is string => x !== null)
}

/**
 * Builds compact multi-line specs text for Excel cells.
 * No pricing — production use only.
 */
export function buildItemSpecsText(item: OrderItem): string {
  const dims = itemMeasurement(item)
  const sag  = Number(item.right_opening_count) || 0
  const sol  = Number(item.left_opening_count)  || 0

  return [
    `Kapı Tipi: ${doorTypeLabel(item.door_type)}`,
    dims !== '-'         ? `Ölçü: ${dims}`               : null,
    sag > 0              ? `Sağ: ${sag}`                  : null,
    sol > 0              ? `Sol: ${sol}`                  : null,
    `Adet: ${Number(item.quantity) || 0}`,
    item.lock_brand      ? `Kilit: ${item.lock_brand}`    : null,
    item.lock_system     ? `Sistem: ${item.lock_system}`  : null,
    item.frame_color     ? `Kasa: ${item.frame_color}`    : null,
    item.mdf_thickness   ? `MDF: ${item.mdf_thickness}`   : null,
    item.sac_kalinligi   ? `Sac: ${item.sac_kalinligi}`  : null,
    item.kanat_kalinligi ? `Kanat: ${item.kanat_kalinligi}` : null,
  ].filter((x): x is string => x !== null).join('\n')
}
