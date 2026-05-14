import { useState, useMemo } from 'react'
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell, type PieLabelRenderProps,
} from 'recharts'
import { theme } from '../../theme'
import { TARIFF, savedPence, formatPounds } from '../../tariff'
import { useHAWebSocket } from '../../hooks/useHAWebSocket'
import { useInfluxSeries, useInfluxMulti, getTimeRange, type Period } from '../../hooks/useInfluxDB'
import { TimeNav } from '../shared/TimeNav'

// ── Shared style helpers ──────────────────────────────────────────────────────
const card = (accent?: string): React.CSSProperties => ({
  background: 'linear-gradient(135deg,rgba(15,26,46,0.80) 0%,rgba(10,18,35,0.85) 100%)',
  border: `1px solid ${accent ? accent + '30' : 'rgba(241,245,249,0.06)'}`,
  borderRadius: 14,
  padding: '14px 16px',
})

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      color: theme.colors.text.muted, marginBottom: 8, paddingLeft: 2 }}>
      {text}
    </div>
  )
}

function ChartLoading() {
  return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: theme.colors.text.muted, fontSize: 12 }}>Loading…</div>
  )
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: theme.colors.text.muted }}>
      <span style={{ width: 20, height: 3, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// ── Axis / tooltip formatting ─────────────────────────────────────────────────
function fmtAxisTime(ms: number, period: Period) {
  const d = new Date(ms)
  if (period === 'H') return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (period === 'D') return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (period === 'M') return d.toLocaleDateString('en-GB', { day: 'numeric' })
  return d.toLocaleDateString('en-GB', { month: 'short' })
}

function fmtW(v: number) {
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}kW` : `${Math.round(v)}W`
}

const ttStyle: React.CSSProperties = {
  background: 'rgba(8,14,26,0.95)', border: '1px solid rgba(0,212,170,0.2)',
  borderRadius: 8, fontSize: 11, color: theme.colors.text.primary,
}

// ── KPI strip ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ flex: 1, background: `${color}12`, borderRadius: 10,
      border: `1px solid ${color}25`, padding: '10px 8px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 9, color: theme.colors.text.muted, letterSpacing: '0.08em',
        marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: theme.colors.text.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── ShinePhone-style combined energy flow chart ───────────────────────────────
function EnergyFlowChart({ period, offset }: { period: Period; offset: number }) {
  const { series, loading } = useInfluxMulti('W',
    ['solar_power_total', 'grid_net_power', 'battery_net_power'],
    period, offset)

  const data = useMemo(() => {
    const solarPts = series['solar_power_total'] ?? []
    const gridPts  = series['grid_net_power'] ?? []
    const batPts   = series['battery_net_power'] ?? []

    const map = new Map<number, { time: number; solar: number; gridNet: number; batNet: number }>()
    solarPts.forEach(d => map.set(d.time, { time: d.time, solar: d.value, gridNet: 0, batNet: 0 }))
    gridPts.forEach(d => { const r = map.get(d.time); if (r) r.gridNet = d.value })
    batPts.forEach(d  => { const r = map.get(d.time); if (r) r.batNet  = d.value })

    return Array.from(map.values())
      .sort((a, b) => a.time - b.time)
      .map(r => ({
        time:       r.time,
        toHome:     Math.max(0, r.solar - Math.max(0, -r.gridNet) - Math.max(0, -r.batNet)),
        toBattery:  Math.max(0, -r.batNet),
        toGrid:     Math.max(0, -r.gridNet),
      }))
  }, [series])

  return (
    <div style={{ ...card(), gridColumn: '1 / -1' }}>
      <SectionLabel text="ENERGY FLOW — WHERE SOLAR WENT" />
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
        <LegendPill color={theme.colors.solar.DEFAULT}   label="Self-consumed" />
        <LegendPill color={theme.colors.battery.DEFAULT}  label="Battery charged" />
        <LegendPill color={theme.colors.grid.DEFAULT}     label="Grid export" />
      </div>
      {loading ? <ChartLoading /> : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
              tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
              tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtW} tick={{ fill: theme.colors.text.muted, fontSize: 9 }}
              axisLine={false} tickLine={false} width={38} />
            <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
              formatter={(v: unknown, name: unknown) => {
                const labels: Record<string, string> = {
                  toHome: 'Self-consumed', toBattery: 'Battery', toGrid: 'Export',
                }
                return [fmtW(Number(v)), labels[name as string] ?? String(name)]
              }} />
            <Area type="monotone" dataKey="toHome"    stackId="s"
              stroke={theme.colors.solar.DEFAULT}  strokeWidth={1}
              fill={`${theme.colors.solar.DEFAULT}55`}  dot={false} />
            <Area type="monotone" dataKey="toBattery" stackId="s"
              stroke={theme.colors.battery.DEFAULT} strokeWidth={1}
              fill={`${theme.colors.battery.DEFAULT}55`} dot={false} />
            <Area type="monotone" dataKey="toGrid"    stackId="s"
              stroke={theme.colors.grid.DEFAULT}    strokeWidth={1}
              fill={`${theme.colors.grid.DEFAULT}55`}    dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Energy donut ──────────────────────────────────────────────────────────────
const RADIAN = Math.PI / 180

function EnergyDonut({ generated, selfUsed, exported, batCharged }: {
  generated: number; selfUsed: number; exported: number; batCharged: number
}) {
  const unaccounted = Math.max(0, generated - selfUsed - exported - batCharged)
  const isEmpty = generated < 0.01

  const segments = [
    { name: 'Self',  fullName: 'Self-used',   value: selfUsed,    color: theme.colors.solar.DEFAULT },
    { name: 'Bat',   fullName: 'Battery',     value: batCharged,  color: theme.colors.battery.DEFAULT },
    { name: 'Grid',  fullName: 'Grid export', value: exported,    color: theme.colors.grid.DEFAULT },
    { name: 'Other', fullName: 'Other',       value: unaccounted, color: 'rgba(100,116,139,0.5)' },
  ].filter(s => s.value > 0.001)

  const renderLabel = ({
    cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0, name = '',
  }: PieLabelRenderProps) => {
    if (percent < 0.06) return null
    const rIn  = innerRadius + (outerRadius - innerRadius) * 0.55
    const xIn  = cx + rIn  * Math.cos(-midAngle * RADIAN)
    const yIn  = cy + rIn  * Math.sin(-midAngle * RADIAN)
    const rOut = outerRadius + 20
    const xOut = cx + rOut * Math.cos(-midAngle * RADIAN)
    const yOut = cy + rOut * Math.sin(-midAngle * RADIAN)
    return (
      <g>
        <text x={xIn} y={yIn} textAnchor="middle" dominantBaseline="central"
          fill="rgba(8,14,26,0.9)" fontSize={11} fontWeight="700">
          {`${(percent * 100).toFixed(0)}%`}
        </text>
        <text x={xOut} y={yOut} textAnchor="middle" dominantBaseline="central"
          fill={theme.colors.text.secondary} fontSize={10}>
          {name}
        </text>
      </g>
    )
  }

  return (
    <div style={card(theme.colors.solar.DEFAULT)}>
      <SectionLabel text="TODAY'S SOLAR BREAKDOWN" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <PieChart width={220} height={220}>
            <Pie
              data={isEmpty ? [{ name: '', fullName: '', value: 1, color: 'rgba(100,116,139,0.15)' }] : segments}
              cx={110} cy={110} innerRadius={62} outerRadius={88}
              startAngle={90} endAngle={-270}
              dataKey="value" stroke="none" paddingAngle={isEmpty ? 0 : 2}
              label={isEmpty ? undefined : renderLabel} labelLine={false}
              isAnimationActive={false}>
              {isEmpty
                ? <Cell fill="rgba(100,116,139,0.15)" />
                : segments.map((s, i) => <Cell key={i} fill={s.color} />)
              }
            </Pie>
          </PieChart>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: theme.colors.solar.DEFAULT, lineHeight: 1 }}>
              {isEmpty ? '—' : generated.toFixed(1)}
            </div>
            <div style={{ fontSize: 9, color: theme.colors.text.muted, marginTop: 2 }}>kWh today</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          {isEmpty
            ? <span style={{ fontSize: 11, color: theme.colors.text.muted }}>No generation yet</span>
            : segments.map(s => (
              <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ color: theme.colors.text.muted }}>{s.fullName}</span>
                <span style={{ color: theme.colors.text.secondary, fontWeight: 600 }}>{s.value.toFixed(2)} kWh</span>
              </span>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Solar chart ───────────────────────────────────────────────────────────────
function SolarChart({ period, offset }: { period: Period; offset: number }) {
  const { data, loading } = useInfluxSeries('W', 'solar_power_total', period, offset)

  return (
    <div style={card(theme.colors.solar.DEFAULT)}>
      <SectionLabel text="SOLAR GENERATION" />
      {loading ? <ChartLoading /> : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.colors.solar.DEFAULT} stopOpacity={0.4} />
                <stop offset="95%" stopColor={theme.colors.solar.DEFAULT} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
              tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
              tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtW} tick={{ fill: theme.colors.text.muted, fontSize: 9 }}
              axisLine={false} tickLine={false} width={38} />
            <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
              formatter={(v: unknown) => [fmtW(Number(v)), 'Solar']} />
            <Area type="monotone" dataKey="value" stroke={theme.colors.solar.DEFAULT}
              strokeWidth={1.5} fill="url(#gSolar)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Grid chart with tariff zone shading ───────────────────────────────────────
function GridChart({ period, offset }: { period: Period; offset: number }) {
  const { data, loading } = useInfluxSeries('W', 'grid_net_power', period, offset)

  const tariffBands = useMemo(() => {
    if (period !== 'D' && period !== 'H') return []
    const { from, to } = getTimeRange(period, offset)
    const fromMs = parseInt(from), toMs = parseInt(to)
    const bands: { x1: number; night: boolean }[] = []
    let cursor = fromMs
    while (cursor < toMs) {
      const h = new Date(cursor).getHours()
      const night = h < 6
      const next = night
        ? new Date(new Date(cursor).setHours(6, 0, 0, 0)).getTime()
        : new Date(new Date(cursor).setHours(24, 0, 0, 0)).getTime()
      bands.push({ x1: cursor, night })
      cursor = Math.min(next, toMs)
    }
    return bands
  }, [period, offset])

  return (
    <div style={card(theme.colors.grid.DEFAULT)}>
      <SectionLabel text="GRID FLOW  (+import  −export)" />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <LegendPill color="rgba(129,140,248,0.5)" label="Night 3.99p" />
        <LegendPill color="rgba(255,255,255,0.2)" label="Day 26.53p" />
      </div>
      {loading ? <ChartLoading /> : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gImport" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.colors.grid.DEFAULT} stopOpacity={0.5} />
                <stop offset="95%" stopColor={theme.colors.grid.DEFAULT} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
              tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
              tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtW} tick={{ fill: theme.colors.text.muted, fontSize: 9 }}
              axisLine={false} tickLine={false} width={40} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
            <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
              formatter={(v: unknown) => { const n = Number(v); return [fmtW(n), n >= 0 ? 'Import' : 'Export'] }} />
            {tariffBands.filter(b => b.night).map((b, i) => (
              <ReferenceLine key={i} x={b.x1} stroke="rgba(129,140,248,0.08)" strokeWidth={0} />
            ))}
            <Area type="monotone" dataKey="value" stroke={theme.colors.grid.DEFAULT}
              strokeWidth={1.5} fill="url(#gImport)" dot={false}
              activeDot={{ r: 3, fill: theme.colors.grid.DEFAULT }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Battery SOC chart ─────────────────────────────────────────────────────────
function BatteryChart({ period, offset }: { period: Period; offset: number }) {
  const { data, loading } = useInfluxSeries('%', 'santanu_s_growatt_inverter_soc', period, offset)

  return (
    <div style={card(theme.colors.battery.DEFAULT)}>
      <SectionLabel text="BATTERY STATE OF CHARGE" />
      {loading ? <ChartLoading /> : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gBat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.colors.battery.DEFAULT} stopOpacity={0.45} />
                <stop offset="95%" stopColor={theme.colors.battery.DEFAULT} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
              tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
              tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`}
              tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={34} />
            <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
              formatter={(v: unknown) => [`${Number(v).toFixed(0)}%`, 'SOC']} />
            <Area type="monotone" dataKey="value" stroke={theme.colors.battery.DEFAULT}
              strokeWidth={1.5} fill="url(#gBat)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── EV story card ─────────────────────────────────────────────────────────────
function EvStoryCard({ sessionKwh, evWatts, solarWatts, homeWatts }: {
  sessionKwh: number; evWatts: number; solarWatts: number; homeWatts: number
}) {
  if (sessionKwh <= 0 && evWatts <= 0) return null

  const basePlant = Math.max(0, homeWatts - evWatts)
  const solarToEv = Math.max(0, Math.min(evWatts, solarWatts - basePlant))
  const solarFrac = evWatts > 0 ? solarToEv / evWatts : 0

  const gridKwh  = sessionKwh * (1 - solarFrac)
  const gridCost = gridKwh * TARIFF.dayRate
  const saving   = sessionKwh * solarFrac * TARIFF.dayRate
  const fullCost = sessionKwh * TARIFF.dayRate

  const ac = theme.colors.ev.DEFAULT
  return (
    <div style={card(ac)}>
      <SectionLabel text="EV SESSION" />
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <KpiCard label="Session"  value={`${sessionKwh.toFixed(2)} kWh`} color={ac} />
        <KpiCard label="Solar"    value={`${(solarFrac * 100).toFixed(0)}%`}
          sub={`${(sessionKwh * solarFrac).toFixed(2)} kWh free`} color={theme.colors.solar.DEFAULT} />
        <KpiCard label="Cost"     value={formatPounds(gridCost)}
          sub={`vs ${formatPounds(fullCost)} grid`} color={theme.colors.warning} />
      </div>
      <div style={{ fontSize: 11, color: theme.colors.text.muted, lineHeight: 1.5 }}>
        {solarFrac > 0.5
          ? `Your Tesla is mostly charging on sunshine — saving ${formatPounds(saving)} vs full grid charge.`
          : `Charging mainly from grid at ${TARIFF.dayRate}p/kWh. Try charging when solar output is higher.`
        }
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function AnalyticsView() {
  const [period, setPeriod] = useState<Period>('D')
  const [offset, setOffset] = useState(0)

  const { getNum, getState } = useHAWebSocket()
  const solar           = getNum('sensor.solar_power_total')
  const batSoc          = getNum('sensor.santanu_s_growatt_inverter_soc')
  const gridNet         = getNum('sensor.grid_net_power')
  const batNet          = getNum('sensor.battery_net_power')
  const str1Today       = getNum('sensor.santanu_s_growatt_inverter_input_1_energy_today')
  const str2Today       = getNum('sensor.santanu_s_growatt_inverter_input_2_energy_today')
  const selfUseToday    = getNum('sensor.santanu_s_growatt_inverter_energy_to_user_today')
  const gridExportToday = getNum('sensor.santanu_s_growatt_inverter_energy_to_grid_today')
  const batChargedToday = getNum('sensor.santanu_s_growatt_inverter_battery_charged_today')
  const evEnergy        = getNum('sensor.psl_153242_current_energy')
  const evStatus        = getState('sensor.psl_153242_status')

  const todayGen     = str1Today + str2Today
  const gridImport   = Math.max(0, gridNet)
  const batDischarge = Math.max(0, -batNet)
  const homeWatts    = Math.round(solar + gridImport + batDischarge - Math.max(0, batNet) - Math.max(0, -gridNet))
  const evCharging   = evStatus.toLowerCase().includes('charg')
  const evWatts      = evCharging ? Math.min(7360, Math.max(0, homeWatts - 350)) : 0
  const savedToday   = savedPence(selfUseToday)

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '4px 12px 20px' }}>
      <TimeNav period={period} offset={offset} onPeriod={setPeriod} onOffset={setOffset} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(max(280px, calc((100% - 20px) / 3)), 1fr))',
        gap: 10,
      }}>
        {/* KPI strip — full width, always today */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <KpiCard label="GENERATED" value={`${todayGen.toFixed(1)} kWh`}    color={theme.colors.solar.DEFAULT} />
          <KpiCard label="SELF-USED"
            value={selfUseToday > 0 ? `${((selfUseToday / Math.max(todayGen, 0.01)) * 100).toFixed(0)}%` : '—'}
            sub={selfUseToday > 0 ? `${selfUseToday.toFixed(1)} kWh` : undefined}
            color={theme.colors.accent.DEFAULT} />
          <KpiCard label="SAVED"   value={savedToday > 0 ? formatPounds(savedToday) : '—'} color={theme.colors.positive} />
          <KpiCard label="BATTERY" value={`${Math.round(batSoc)}%`}           color={theme.colors.battery.DEFAULT} />
        </div>

        {/* ShinePhone combined chart — full width */}
        <EnergyFlowChart period={period} offset={offset} />

        {/* Cards that pair on desktop, stack on mobile */}
        <EnergyDonut
          generated={todayGen}
          selfUsed={selfUseToday}
          exported={gridExportToday}
          batCharged={batChargedToday}
        />
        <SolarChart   period={period} offset={offset} />
        <GridChart    period={period} offset={offset} />
        <BatteryChart period={period} offset={offset} />

        <EvStoryCard
          sessionKwh={evEnergy}
          evWatts={evWatts}
          solarWatts={solar}
          homeWatts={homeWatts}
        />

        {/* Hot Water placeholder */}
        <div style={card(theme.colors.heat.DEFAULT)}>
          <SectionLabel text="HOT WATER" />
          <div style={{ fontSize: 12, color: theme.colors.text.muted, textAlign: 'center', padding: '24px 0' }}>
            Diverter / immersion controller not yet installed
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
