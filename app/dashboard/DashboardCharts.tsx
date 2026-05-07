'use client'

import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import ChartCard from './ChartCard'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MonthPoint     = { month: string; tahsilat: number; odeme: number; net: number }
export type CariBarPoint   = { name: string; bakiye: number }
export type PieSlice       = { name: string; value: number; color: string }
export type TopCustomer    = { id: string; name: string; bakiye: number }

interface Props {
  monthly:      MonthPoint[]
  cariBalances: CariBarPoint[]
  orderPie:     PieSlice[]
  topCustomers: TopCustomer[]
}

// ── Tooltip formatters ───────────────────────────────────────────────────────

const tryCurrency = (v: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v)

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="mb-1 font-semibold text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: {tryCurrency(p.value)}
        </p>
      ))}
    </div>
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

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-semibold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ── Net bar color helper ─────────────────────────────────────────────────────

function NetBarColor({ x, y, width, height, value }: any) {
  const fill = value >= 0 ? '#22c55e' : '#ef4444'
  const barHeight = Math.abs(height)
  const barY = value >= 0 ? y : y + height
  return <rect x={x} y={barY} width={width} height={barHeight} fill={fill} rx={3} ry={3} />
}

// ════════════════════════════════════════════════════════════════════════════

export default function DashboardCharts({ monthly, cariBalances, orderPie, topCustomers }: Props) {
  const hasMonthly  = monthly.length > 0
  const hasCari     = cariBalances.length > 0
  const hasOrders   = orderPie.some(s => s.value > 0)
  const hasCustomers = topCustomers.length > 0

  return (
    <div className="space-y-4">

      {/* ── Row 1: Cash Flow Area + Order Status Pie ───────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Cash Flow – area chart */}
        <ChartCard title="Nakit Akışı — Tahsilat vs Ödeme" className="lg:col-span-2">
          {!hasMonthly ? (
            <Empty text="Henüz hareket kaydı yok." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gTahsilat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOdeme" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#gTahsilat)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="odeme"    name="Ödeme"    stroke="#ef4444" strokeWidth={2}
                  fill="url(#gOdeme)"    dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Order Status – pie chart */}
        <ChartCard title="Sipariş Durumu">
          {!hasOrders ? (
            <Empty text="Sipariş yok." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={orderPie}
                  cx="50%" cy="50%"
                  outerRadius={88}
                  dataKey="value"
                  labelLine={false}
                  label={<PieLabel />}
                >
                  {orderPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Row 2: Monthly Net Revenue Bar + Cari Balances ────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Monthly Net Revenue — single bar per month, green/red */}
        <ChartCard title="Aylık Net Gelir (Tahsilat − Ödeme)">
          {!hasMonthly ? (
            <Empty text="Henüz hareket kaydı yok." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const v = payload[0].value as number
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
                        <p className="mb-1 font-semibold text-gray-700">{label}</p>
                        <p style={{ color: v >= 0 ? '#22c55e' : '#ef4444' }}>
                          Net: {tryCurrency(v)}
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="net" name="Net" shape={<NetBarColor />} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Cari Balance Bar */}
        <ChartCard title="Cari Bakiye Dağılımı (Top 8)">
          {!hasCari ? (
            <Empty text="Cari hareketi yok." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cariBalances} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + '…' : v} />
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

      {/* ── Row 3: Top Customers ──────────────────────────────────────────── */}
      <ChartCard title="En Yüksek Bakiyeli Cariler (Top 5 Alacak)">
        {!hasCustomers ? (
          <Empty text="Alacaklı cari yok." />
        ) : (
          <div className="divide-y divide-gray-50">
            {topCustomers.map((c, i) => (
              <div key={c.id} className="flex items-center gap-4 py-3 px-1">
                {/* Rank */}
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                  ${i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-gray-100 text-gray-600' :
                    i === 2 ? 'bg-orange-50 text-orange-600' :
                              'bg-gray-50 text-gray-400'}`}>
                  {i + 1}
                </span>
                {/* Name */}
                <span className="flex-1 truncate text-sm font-medium text-gray-800">{c.name}</span>
                {/* Balance bar */}
                <div className="hidden sm:flex w-32 items-center">
                  <div className="h-1.5 rounded-full bg-green-100 w-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${Math.min(100, (c.bakiye / topCustomers[0].bakiye) * 100)}%` }}
                    />
                  </div>
                </div>
                {/* Amount */}
                <span className="shrink-0 text-sm font-semibold text-green-700">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(c.bakiye)}
                </span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">{text}</div>
  )
}
