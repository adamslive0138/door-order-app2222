'use client'

import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import ChartCard from '@/app/dashboard/ChartCard'

export type MonthlyPoint = { month: string; tahsilat: number; odeme: number; net: number }
export type CariBalance  = { id: string; name: string; bakiye: number }

interface Props {
  monthly:      MonthlyPoint[]
  cariBalances: CariBalance[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="mb-1 font-semibold text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">{text}</div>
}

export default function CariCharts({ monthly, cariBalances }: Props) {
  const hasMonthly = monthly.length > 0
  const hasCari    = cariBalances.length > 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Aylık Tahsilat vs Ödeme */}
        <ChartCard title="Aylık Tahsilat vs Ödeme">
          {!hasMonthly ? <Empty text="Hareket kaydı yok." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gCT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="tahsilat" name="Tahsilat" stroke="#22c55e" strokeWidth={2}
                  fill="url(#gCT)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="odeme"    name="Ödeme"    stroke="#ef4444" strokeWidth={2}
                  fill="url(#gCO)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Cari Bakiye Dağılımı */}
        <ChartCard title="Cari Bakiye Dağılımı (Top 10)">
          {!hasCari ? <Empty text="Cari hareketi yok." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cariBalances} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v.length > 8 ? v.slice(0, 8) + '…' : v} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="bakiye" name="Bakiye" radius={[4, 4, 0, 0]}>
                  {cariBalances.map((entry, i) => (
                    <Cell key={i} fill={entry.bakiye >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
