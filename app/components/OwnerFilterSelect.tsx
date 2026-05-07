'use client'

import { useRouter } from 'next/navigation'

interface Props {
  staffList: { id: string; full_name: string | null }[]
  selectedOwnerId: string
  basePath: string
}

export default function OwnerFilterSelect({ staffList, selectedOwnerId, basePath }: Props) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    router.push(val ? `${basePath}?owner_id=${val}` : basePath)
  }

  return (
    <select
      value={selectedOwnerId}
      onChange={handleChange}
      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="">Tüm Satıcılar</option>
      {staffList.map(s => (
        <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>
      ))}
    </select>
  )
}
