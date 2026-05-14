import { useState, useMemo } from 'react'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { theme } from '../../theme'
import { TARIFF, formatPounds } from '../../tariff'
import { useHAWebSocket } from '../../hooks/useHAWebSocket'
import { useInfluxSeries, useInfluxMulti, type Period } from '../../hooks/useInfluxDB'
import { TimeNav } from '../shared/TimeNav'
import type { NodeKey } from '../../types'

// ── Shared helpers ────────────────────────────────────────────────────────────
const card = (accent?: string): React.CSSProperties => ({
  background: 'linear-gradient(135deg,rgba(15,26,46,0.80) 0%,rgba(10,18,35,0.85) 100%)',
  border: `1px solid ${accent ? accent + '30' : 'rgba(241,245,249,0.06)'}`,
  borderRadius: 14,
  padding: '14px 16px',
})

function SectionLabel({ text }: { text: string }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    color: theme.colors.text.muted, marginBottom: 8 }}>{text}</div>
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ flex: 1, background: `${color}12`, borderRadius: 10,
      border: `1px solid ${color}25`, padding: '10px 8px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 9, color: theme.colors.text.muted, letterSpacing: '0.08em',
        marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: theme.colors.text.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function ChartLoading() {
  return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: theme.colors.text.muted, fontSize: 12 }}>Loading…</div>
}

function fmtAxisTime(ms: number, period: Period) {
  const d = new Date(ms)
  if (period === 'H' || period === 'D') return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
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

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: theme.colors.text.muted }}>
      <span style={{ width: 18, height: 3, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// ── Solar detail ──────────────────────────────────────────────────────────────
function SolarDetail({ period, offset }: { period: Period; offset: number }) {
  const { getNum } = useHAWebSocket()
  const str1Today = getNum('sensor.santanu_s_growatt_inverter_input_1_energy_today')
  const str2Today = getNum('sensor.santanu_s_growatt_inverter_input_2_energy_today')
  const str1W     = getNum('sensor.santanu_s_growatt_inverter_input_1_wattage')
  const str2W     = getNum('sensor.santanu_s_growatt_inverter_input_2_wattage')
  const todayGen  = str1Today + str2Today

  const { series, loading } = useInfluxMulti('W',
    ['santanu_s_growatt_inverter_input_1_wattage', 'santanu_s_growatt_inverter_input_2_wattage'],
    period, offset)

  const data = useMemo(() => {
    const s1 = series['santanu_s_growatt_inverter_input_1_wattage'] ?? []
    const s2 = series['santanu_s_growatt_inverter_input_2_wattage'] ?? []
    const map = new Map<number, { time: number; str1?: number; str2?: number }>()
    s1.forEach(d => map.set(d.time, { time: d.time, str1: d.value }))
    s2.forEach(d => { const r = map.get(d.time); if (r) r.str2 = d.value; else map.set(d.time, { time: d.time, str2: d.value }) })
    return Array.from(map.values()).sort((a, b) => a.time - b.time)
  }, [series])

  return (
    <>
      {/* KPIs */}
      <div style={{ ...card(theme.colors.solar.DEFAULT), gridColumn: '1 / -1' }}>
        <SectionLabel text="SOLAR GENERATION — TODAY" />
        <div style={{ display: 'flex', gap: 8 }}>
          <KpiCard label="TOTAL"    value={`${todayGen.toFixed(2)} kWh`}  color={theme.colors.solar.DEFAULT} />
          <KpiCard label="STRING 1" value={`${str1Today.toFixed(2)} kWh`}
            sub={`${fmtW(str1W)} now`} color={theme.colors.solar.DEFAULT} />
          <KpiCard label="STRING 2" value={`${str2Today.toFixed(2)} kWh`}
            sub={`${fmtW(str2W)} now`} color={theme.colors.accent.DEFAULT} />
        </div>
      </div>

      {/* String comparison chart */}
      <div style={{ ...card(), gridColumn: '1 / -1' }}>
        <SectionLabel text="STRING 1 vs STRING 2 — POWER" />
        <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
          <LegendPill color={theme.colors.solar.DEFAULT}  label="String 1" />
          <LegendPill color={theme.colors.accent.DEFAULT} label="String 2" />
        </div>
        {loading ? <ChartLoading /> : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="dGs1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={theme.colors.solar.DEFAULT}  stopOpacity={0.45} />
                  <stop offset="95%" stopColor={theme.colors.solar.DEFAULT}  stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="dGs2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={theme.colors.accent.DEFAULT} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={theme.colors.accent.DEFAULT} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
                tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
                tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtW} tick={{ fill: theme.colors.text.muted, fontSize: 9 }}
                axisLine={false} tickLine={false} width={38} />
              <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
                formatter={(v: unknown, name: unknown) => [fmtW(Number(v)), name === 'str1' ? 'String 1' : 'String 2']} />
              <Area type="monotone" dataKey="str1" stroke={theme.colors.solar.DEFAULT}
                strokeWidth={1.5} fill="url(#dGs1)" dot={false} />
              <Area type="monotone" dataKey="str2" stroke={theme.colors.accent.DEFAULT}
                strokeWidth={1.5} fill="url(#dGs2)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  )
}

// ── Battery detail ────────────────────────────────────────────────────────────
function BatteryDetail({ period, offset }: { period: Period; offset: number }) {
  const { getNum } = useHAWebSocket()
  const soc          = getNum('sensor.santanu_s_growatt_inverter_soc')
  const batNet       = getNum('sensor.battery_net_power')
  const charged      = getNum('sensor.santanu_s_growatt_inverter_battery_charged_today')
  const discharged   = getNum('sensor.santanu_s_growatt_inverter_battery_discharged_today')
  const { data: socData,    loading: l1 } = useInfluxSeries('%', 'santanu_s_growatt_inverter_soc',         period, offset)
  const { data: powerData,  loading: l2 } = useInfluxSeries('W', 'battery_net_power',                       period, offset)

  return (
    <>
      <div style={{ ...card(theme.colors.battery.DEFAULT), gridColumn: '1 / -1' }}>
        <SectionLabel text="BATTERY — TODAY" />
        <div style={{ display: 'flex', gap: 8 }}>
          <KpiCard label="SOC NOW"   value={`${Math.round(soc)}%`}          color={theme.colors.battery.DEFAULT} />
          <KpiCard label="CHARGED"   value={`${charged.toFixed(2)} kWh`}    color={theme.colors.battery.DEFAULT} />
          <KpiCard label="DISCHARGED" value={discharged > 0 ? `${discharged.toFixed(2)} kWh` : '—'}
            color={theme.colors.warning} />
          <KpiCard label="POWER NOW"
            value={fmtW(Math.abs(batNet))}
            sub={batNet < -5 ? 'Charging' : batNet > 5 ? 'Discharging' : 'Idle'}
            color={theme.colors.battery.DEFAULT} />
        </div>
      </div>

      <div style={card(theme.colors.battery.DEFAULT)}>
        <SectionLabel text="STATE OF CHARGE" />
        {l1 ? <ChartLoading /> : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={socData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dGsoc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={theme.colors.battery.DEFAULT} stopOpacity={0.5} />
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
                strokeWidth={1.5} fill="url(#dGsoc)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={card()}>
        <SectionLabel text="CHARGE / DISCHARGE POWER" />
        <div style={{ fontSize: 9, color: theme.colors.text.muted, marginBottom: 8 }}>
          Positive = discharging · Negative = charging
        </div>
        {l2 ? <ChartLoading /> : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={powerData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dGbatP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={theme.colors.battery.DEFAULT} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={theme.colors.battery.DEFAULT} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
                tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
                tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtW} tick={{ fill: theme.colors.text.muted, fontSize: 9 }}
                axisLine={false} tickLine={false} width={40} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
              <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
                formatter={(v: unknown) => { const n = Number(v); return [fmtW(n), n > 0 ? 'Discharge' : 'Charge'] }} />
              <Area type="monotone" dataKey="value" stroke={theme.colors.battery.DEFAULT}
                strokeWidth={1.5} fill="url(#dGbatP)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  )
}

// ── Grid detail ───────────────────────────────────────────────────────────────
function GridDetail({ period, offset }: { period: Period; offset: number }) {
  const { getNum } = useHAWebSocket()
  const gridNet    = getNum('sensor.grid_net_power')
  const exported   = getNum('sensor.santanu_s_growatt_inverter_energy_to_grid_today')
  const { data, loading } = useInfluxSeries('W', 'grid_net_power', period, offset)

  // Rough cost estimate: integrate positive (import) values at day rate
  const importKwh  = data.filter(d => d.value > 0).reduce((s, d) => s + d.value / 1000 / 12, 0) // 5m intervals
  const importCost = importKwh * TARIFF.dayRate

  return (
    <>
      <div style={{ ...card(theme.colors.grid.DEFAULT), gridColumn: '1 / -1' }}>
        <SectionLabel text="GRID — TODAY" />
        <div style={{ display: 'flex', gap: 8 }}>
          <KpiCard label="NOW"       value={fmtW(Math.abs(gridNet))}
            sub={gridNet > 5 ? 'Importing' : gridNet < -5 ? 'Exporting' : 'Balanced'}
            color={theme.colors.grid.DEFAULT} />
          <KpiCard label="EXPORTED"  value={exported > 0 ? `${exported.toFixed(2)} kWh` : '—'}
            color={theme.colors.accent.DEFAULT} />
          <KpiCard label="EST. COST" value={importCost > 0 ? formatPounds(importCost) : '—'}
            sub="day rate" color={theme.colors.warning} />
        </div>
      </div>

      <div style={{ ...card(theme.colors.grid.DEFAULT), gridColumn: '1 / -1' }}>
        <SectionLabel text="GRID FLOW  (+import  −export)" />
        {loading ? <ChartLoading /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="dGgrid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={theme.colors.grid.DEFAULT} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={theme.colors.grid.DEFAULT} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
                tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
                tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtW} tick={{ fill: theme.colors.text.muted, fontSize: 9 }}
                axisLine={false} tickLine={false} width={40} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
                formatter={(v: unknown) => { const n = Number(v); return [fmtW(n), n >= 0 ? 'Import' : 'Export'] }} />
              <Area type="monotone" dataKey="value" stroke={theme.colors.grid.DEFAULT}
                strokeWidth={1.5} fill="url(#dGgrid)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tariff info card */}
      <div style={card()}>
        <SectionLabel text="E.ON NEXT DRIVE FIXED V11" />
        {[
          { label: 'Day rate (06:00–24:00)', value: `${TARIFF.dayRate}p/kWh`, color: theme.colors.warning },
          { label: 'Night rate (00:00–06:00)', value: `${TARIFF.nightRate}p/kWh`, color: theme.colors.grid.DEFAULT },
          { label: 'Standing charge', value: `${TARIFF.standing}p/day`, color: theme.colors.text.muted },
          { label: 'Export rate', value: 'None (no MCS)', color: theme.colors.text.muted },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 11, color: theme.colors.text.secondary }}>{r.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.value}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── EV detail ─────────────────────────────────────────────────────────────────
function EvDetail({ period, offset }: { period: Period; offset: number }) {
  const { getNum, getState } = useHAWebSocket()
  const evStatus    = getState('sensor.psl_153242_status')
  const evEnergy    = getNum('sensor.psl_153242_current_energy')
  const evChargeMode = getState('sensor.psl_153242_charge_mode')
  const solar       = getNum('sensor.solar_power_total')
  const gridNet     = getNum('sensor.grid_net_power')
  const batNet      = getNum('sensor.battery_net_power')
  const charging    = evStatus.toLowerCase().includes('charg')

  const homeWatts   = Math.round(solar + Math.max(0, gridNet) + Math.max(0, batNet))
  const evWatts     = charging ? Math.min(7360, Math.max(0, homeWatts - 350)) : 0
  const basePlant   = Math.max(0, homeWatts - evWatts)
  const solarToEv   = Math.max(0, Math.min(evWatts, solar - basePlant))
  const solarFrac   = evWatts > 0 ? solarToEv / evWatts : 0
  const gridCost    = evEnergy * (1 - solarFrac) * TARIFF.dayRate
  const fullCost    = evEnergy * TARIFF.dayRate

  const { data, loading } = useInfluxSeries('kWh', 'psl_153242_current_energy', period, offset)

  const ac = theme.colors.ev.DEFAULT
  return (
    <>
      <div style={{ ...card(ac), gridColumn: '1 / -1' }}>
        <SectionLabel text="EV CHARGING — POD POINT SOLO" />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <KpiCard label="STATUS"    value={evStatus}                                    color={charging ? ac : theme.colors.text.muted} />
          <KpiCard label="SESSION"   value={`${evEnergy.toFixed(2)} kWh`}               color={ac} />
          <KpiCard label="SOLAR %"   value={`${(solarFrac * 100).toFixed(0)}%`}
            sub={`${(evEnergy * solarFrac).toFixed(2)} kWh free`} color={theme.colors.solar.DEFAULT} />
          <KpiCard label="EST. COST" value={gridCost > 0 ? formatPounds(gridCost) : '—'}
            sub={fullCost > 0 ? `vs ${formatPounds(fullCost)}` : undefined} color={theme.colors.warning} />
        </div>
        {evChargeMode && evChargeMode !== 'unknown' && (
          <div style={{ fontSize: 11, color: theme.colors.text.muted }}>
            Mode: <span style={{ color: ac, fontWeight: 600 }}>{evChargeMode}</span>
          </div>
        )}
        {charging && evWatts > 0 && (
          <div style={{ fontSize: 11, color: theme.colors.text.muted, marginTop: 4 }}>
            Estimated draw: <span style={{ color: ac, fontWeight: 600 }}>{fmtW(evWatts)}</span>
            {' '}(Pod Point has no power sensor — derived from home load)
          </div>
        )}
      </div>

      <div style={{ ...card(ac), gridColumn: '1 / -1' }}>
        <SectionLabel text="SESSION ENERGY" />
        {loading ? <ChartLoading /> : data.length === 0
          ? <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: theme.colors.text.muted }}>No session data for this period</div>
          : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
                  tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
                  tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme.colors.text.muted, fontSize: 9 }}
                  axisLine={false} tickLine={false} width={38} tickFormatter={v => `${v}kWh`} />
                <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
                  formatter={(v: unknown) => [`${Number(v).toFixed(2)} kWh`, 'Session']} />
                <Line type="monotone" dataKey="value" stroke={ac} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )
        }
      </div>
    </>
  )
}

// ── Home detail ───────────────────────────────────────────────────────────────
function HomeDetail({ period, offset }: { period: Period; offset: number }) {
  const { getNum } = useHAWebSocket()
  const solar    = getNum('sensor.solar_power_total')
  const gridNet  = getNum('sensor.grid_net_power')
  const batNet   = getNum('sensor.battery_net_power')
  const selfUse  = getNum('sensor.santanu_s_growatt_inverter_energy_to_user_today')

  const homeWatts = Math.round(solar + Math.max(0, gridNet) + Math.max(0, batNet))
  const solarPct  = homeWatts > 0 ? Math.min(100, (solar / homeWatts) * 100) : 0
  const gridPct   = homeWatts > 0 ? Math.min(100, (Math.max(0, gridNet) / homeWatts) * 100) : 0
  const batPct    = homeWatts > 0 ? Math.min(100, (Math.max(0, batNet)  / homeWatts) * 100) : 0

  const { series, loading } = useInfluxMulti('W',
    ['solar_power_total', 'grid_net_power', 'battery_net_power'],
    period, offset)

  const data = useMemo(() => {
    const solarPts = series['solar_power_total']  ?? []
    const gridPts  = series['grid_net_power']     ?? []
    const batPts   = series['battery_net_power']  ?? []
    const map = new Map<number, { time: number; solar: number; gridNet: number; batNet: number }>()
    solarPts.forEach(d => map.set(d.time, { time: d.time, solar: d.value, gridNet: 0, batNet: 0 }))
    gridPts.forEach(d => { const r = map.get(d.time); if (r) r.gridNet = d.value })
    batPts.forEach(d  => { const r = map.get(d.time); if (r) r.batNet  = d.value })
    return Array.from(map.values())
      .sort((a, b) => a.time - b.time)
      .map(r => ({
        time: r.time,
        home: Math.max(0, r.solar + Math.max(0, r.gridNet) + Math.max(0, r.batNet)),
      }))
  }, [series])

  const hc = theme.colors.home.DEFAULT
  return (
    <>
      <div style={{ ...card(hc), gridColumn: '1 / -1' }}>
        <SectionLabel text="HOME CONSUMPTION — NOW" />
        <div style={{ display: 'flex', gap: 8 }}>
          <KpiCard label="CONSUMING"  value={fmtW(homeWatts)}             color={hc} />
          <KpiCard label="FROM SOLAR" value={`${solarPct.toFixed(0)}%`}
            sub={fmtW(solar)} color={theme.colors.solar.DEFAULT} />
          <KpiCard label="FROM GRID"  value={`${gridPct.toFixed(0)}%`}
            sub={fmtW(Math.max(0, gridNet))} color={theme.colors.grid.DEFAULT} />
          <KpiCard label="FROM BAT"   value={`${batPct.toFixed(0)}%`}
            sub={fmtW(Math.max(0, batNet))}  color={theme.colors.battery.DEFAULT} />
        </div>
        {selfUse > 0 && (
          <div style={{ fontSize: 11, color: theme.colors.text.muted, marginTop: 10 }}>
            Self-consumed solar today: <span style={{ color: theme.colors.accent.DEFAULT, fontWeight: 600 }}>{selfUse.toFixed(2)} kWh</span>
          </div>
        )}
      </div>

      <div style={{ ...card(hc), gridColumn: '1 / -1' }}>
        <SectionLabel text="HOME CONSUMPTION — HISTORY" />
        {loading ? <ChartLoading /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="dGhome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={hc} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={hc} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
                tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
                tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtW} tick={{ fill: theme.colors.text.muted, fontSize: 9 }}
                axisLine={false} tickLine={false} width={38} />
              <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
                formatter={(v: unknown) => [fmtW(Number(v)), 'Home load']} />
              <Area type="monotone" dataKey="home" stroke={hc} strokeWidth={1.5}
                fill="url(#dGhome)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
const NODE_LABELS: Record<NodeKey, string> = {
  solar:   'Solar Generation',
  battery: 'Battery',
  grid:    'Grid',
  ev:      'EV Charging',
  home:    'Home Consumption',
}

export function nodeLabel(n: NodeKey) { return NODE_LABELS[n] }

export function NodeDetailView({ node }: { node: NodeKey }) {
  const [period, setPeriod] = useState<Period>('D')
  const [offset, setOffset] = useState(0)

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '4px 12px 20px' }}>
        <TimeNav period={period} offset={offset} onPeriod={setPeriod} onOffset={setOffset} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(max(280px, calc((100% - 20px) / 3)), 1fr))', gap: 10 }}>
          {node === 'solar'   && <SolarDetail   period={period} offset={offset} />}
          {node === 'battery' && <BatteryDetail period={period} offset={offset} />}
          {node === 'grid'    && <GridDetail    period={period} offset={offset} />}
          {node === 'ev'      && <EvDetail      period={period} offset={offset} />}
          {node === 'home'    && <HomeDetail    period={period} offset={offset} />}
        </div>
      </div>
    </div>
  )
}
