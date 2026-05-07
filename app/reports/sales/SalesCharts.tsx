'use client'

import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import ChartCard from '@/app/dashboard/ChartCard'

export type MonthlySalesPoint = { month: string; count: number; ciro: number }
export type DoorTypePie       = { name: string; value: number; color: string }
export type TopCustomerRow    = { name: string; total: number }

interface Props {
  monthly:      MonthlySalesPoint[]
  doorPie:      DoorTypePie[]
  topCustomers: TopCustomerRow[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n)

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="mb-1 font-semibold text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: {p.name === 'Ciro' ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-semibold" style={{ color: payload[0].payload.color }}>{payload[0].name}</p>
      <p className="text-gray-600">{payload[0].value} sipariş</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">{text}</div>
}

export default function SalesCharts({ monthly, doorPie, topCustomers }: Props) {
  const hasMonthly = monthly.length > 0
  const hasDoor    = doorPie.some(s => s.value > 0)

  return (
    <div className="space-y-4">

      {/* Row 1: Aylık Ciro + Kapı Tipi Pie */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Aylık Ciro" className="lg:col-span-2">
          {!hasMonthly ? <Empty text="Sipariş yok." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gCiro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CurrencyTooltip />} />
                <Area type="monotone" dataKey="ciro" name="Ciro" stroke="#3b82f6" strokeWidth={2}
                  fill="url(#gCiro)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Kapı Tipi Dağılımı">
          {!hasDoor ? <Empty text="Sipariş yok." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={doorPie} cx="50%" cy="50%" outerRadius={88}
                  dataKey="value" labelLine={false} label={<PieLabel />}>
                  {doorPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Aylık Sipariş Sayısı + Top Customers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Aylık Sipariş Sayısı">
          {!hasMonthly ? <Empty text="Sipariş yok." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
                        <p className="mb-1 font-semibold text-gray-700">{label}</p>
                        <p className="text-blue-600">Sipariş: {payload[0].value}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" name="Sipariş" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="En Yüksek Cirolu Müşteriler (Top 5)">
          {topCustomers.length === 0 ? <Empty text="Veri yok." /> : (
            <div className="divide-y divide-gray-50">
              {topCustomers.map((c, i) => (
                <div key={c.name} className="flex items-center gap-4 py-3 px-1">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                    ${i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-gray-800">{c.name}</span>
                  <div className="hidden sm:flex w-28 items-center">
                    <div className="h-1.5 rounded-full bg-blue-100 w-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.min(100, (c.total / topCustomers[0].total) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-blue-700">{fmt(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
