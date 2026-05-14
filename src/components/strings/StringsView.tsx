import { useState } from 'react'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { theme } from '../../theme'
import { useInfluxMulti, type Period } from '../../hooks/useInfluxDB'
import { useHAWebSocket } from '../../hooks/useHAWebSocket'
import { TimeNav } from '../shared/TimeNav'

const STR1 = {
  power:   'santanu_s_growatt_inverter_input_1_wattage',
  voltage: 'santanu_s_growatt_inverter_input_1_voltage',
  current: 'santanu_s_growatt_inverter_input_1_amperage',
  energy:  'input_1_energy_today',
  color:   theme.colors.solar.DEFAULT,
  label:   'String 1',
}
const STR2 = {
  power:   'santanu_s_growatt_inverter_input_2_wattage',
  voltage: 'santanu_s_growatt_inverter_input_2_voltage',
  current: 'santanu_s_growatt_inverter_input_2_amperage',
  energy:  'input_2_energy_today',
  color:   theme.colors.accent.DEFAULT,
  label:   'String 2',
}

// ── Shared style helpers ──────────────────────────────────────────────────────
const card = (accent?: string): React.CSSProperties => ({
  background: 'linear-gradient(135deg,rgba(15,26,46,0.80) 0%,rgba(10,18,35,0.85) 100%)',
  border: `1px solid ${accent ? accent + '30' : 'rgba(241,245,249,0.06)'}`,
  borderRadius: 14,
  padding: '14px 16px',
  marginBottom: 10,
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
    <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: theme.colors.text.muted, fontSize: 12 }}>Loading…</div>
  )
}

const ttStyle: React.CSSProperties = {
  background: 'rgba(8,14,26,0.95)', border: '1px solid rgba(0,212,170,0.2)',
  borderRadius: 8, fontSize: 11, color: theme.colors.text.primary,
}

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

// ── Live stat badge ────────────────────────────────────────────────────────────
function StatBadge({ label, val, unit, color }: { label: string; val: number; unit: string; color: string }) {
  return (
    <div style={{ flex: 1, background: `${color}10`, borderRadius: 10,
      border: `1px solid ${color}22`, padding: '8px 6px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 8, color: theme.colors.text.muted, letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>{val.toFixed(1)}</div>
      <div style={{ fontSize: 9, color: theme.colors.text.muted, marginTop: 2 }}>{unit}</div>
    </div>
  )
}

// ── String stats row (live) ────────────────────────────────────────────────────
function StringLiveStats({ color, label }: { color: string; label: string }) {
  const { getNum } = useHAWebSocket()
  const power   = label === 'String 1' ? getNum('sensor.santanu_s_growatt_inverter_input_1_wattage') : getNum('sensor.santanu_s_growatt_inverter_input_2_wattage')
  const voltage = label === 'String 1' ? getNum('sensor.input_1_voltage') : getNum('sensor.input_2_voltage')
  const current = label === 'String 1' ? getNum('sensor.input_1_amperage') : getNum('sensor.input_2_amperage')
  const energy  = label === 'String 1' ? getNum('sensor.santanu_s_growatt_inverter_input_1_energy_today') : getNum('sensor.santanu_s_growatt_inverter_input_2_energy_today')

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <StatBadge label="POWER"   val={power}   unit="W"   color={color} />
        <StatBadge label="VOLTAGE" val={voltage} unit="V"   color={color} />
        <StatBadge label="CURRENT" val={current} unit="A"   color={color} />
        <StatBadge label="TODAY"   val={energy}  unit="kWh" color={color} />
      </div>
    </div>
  )
}

// ── Power comparison chart (both strings on same chart) ────────────────────────
function PowerCompareChart({ period, offset }: { period: Period; offset: number }) {
  const { series, loading } = useInfluxMulti('W',
    [STR1.power, STR2.power], period, offset)

  // Merge into one data array keyed by time
  const merged = (() => {
    const map = new Map<number, { time: number; str1?: number; str2?: number }>()
    ;(series[STR1.power] ?? []).forEach(d => map.set(d.time, { time: d.time, str1: d.value }))
    ;(series[STR2.power] ?? []).forEach(d => {
      const existing = map.get(d.time)
      if (existing) existing.str2 = d.value
      else map.set(d.time, { time: d.time, str2: d.value })
    })
    return Array.from(map.values()).sort((a, b) => a.time - b.time)
  })()

  return (
    <div style={card()}>
      <SectionLabel text="POWER — STRING 1 vs STRING 2" />
      {loading ? <ChartLoading /> : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={merged} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gStr1P" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STR1.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={STR1.color} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gStr2P" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STR2.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={STR2.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
              tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
              tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtW} tick={{ fill: theme.colors.text.muted, fontSize: 9 }}
              axisLine={false} tickLine={false} width={38} />
            <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
              formatter={(v: unknown, name: unknown) => [fmtW(Number(v)), name === 'str1' ? 'String 1' : 'String 2']} />
            <Area type="monotone" dataKey="str1" stroke={STR1.color} strokeWidth={1.5}
              fill="url(#gStr1P)" dot={false} name="str1" />
            <Area type="monotone" dataKey="str2" stroke={STR2.color} strokeWidth={1.5}
              fill="url(#gStr2P)" dot={false} name="str2" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Voltage comparison chart ───────────────────────────────────────────────────
function VoltageChart({ period, offset }: { period: Period; offset: number }) {
  const { series, loading } = useInfluxMulti('V',
    [STR1.voltage, STR2.voltage], period, offset)

  const merged = (() => {
    const map = new Map<number, { time: number; str1?: number; str2?: number }>()
    ;(series[STR1.voltage] ?? []).forEach(d => map.set(d.time, { time: d.time, str1: d.value }))
    ;(series[STR2.voltage] ?? []).forEach(d => {
      const existing = map.get(d.time)
      if (existing) existing.str2 = d.value
      else map.set(d.time, { time: d.time, str2: d.value })
    })
    return Array.from(map.values()).sort((a, b) => a.time - b.time)
  })()

  return (
    <div style={card()}>
      <SectionLabel text="VOLTAGE — STRING 1 vs STRING 2" />
      {loading ? <ChartLoading /> : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={merged} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
              tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
              tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false}
              width={34} tickFormatter={v => `${v}V`} />
            <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
              formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)} V`, name === 'str1' ? 'String 1' : 'String 2']} />
            <Line type="monotone" dataKey="str1" stroke={STR1.color} strokeWidth={1.5} dot={false} name="str1" />
            <Line type="monotone" dataKey="str2" stroke={STR2.color} strokeWidth={1.5} dot={false} name="str2" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Current comparison chart ───────────────────────────────────────────────────
function CurrentChart({ period, offset }: { period: Period; offset: number }) {
  const { series, loading } = useInfluxMulti('A',
    [STR1.current, STR2.current], period, offset)

  const merged = (() => {
    const map = new Map<number, { time: number; str1?: number; str2?: number }>()
    ;(series[STR1.current] ?? []).forEach(d => map.set(d.time, { time: d.time, str1: d.value }))
    ;(series[STR2.current] ?? []).forEach(d => {
      const existing = map.get(d.time)
      if (existing) existing.str2 = d.value
      else map.set(d.time, { time: d.time, str2: d.value })
    })
    return Array.from(map.values()).sort((a, b) => a.time - b.time)
  })()

  return (
    <div style={card()}>
      <SectionLabel text="CURRENT — STRING 1 vs STRING 2" />
      {loading ? <ChartLoading /> : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={merged} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <XAxis dataKey="time" scale="time" type="number" domain={['dataMin','dataMax']}
              tickFormatter={v => fmtAxisTime(v, period)} tickCount={6}
              tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: theme.colors.text.muted, fontSize: 9 }} axisLine={false} tickLine={false}
              width={30} tickFormatter={v => `${v}A`} />
            <Tooltip contentStyle={ttStyle} labelFormatter={v => new Date(v).toLocaleTimeString('en-GB')}
              formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(2)} A`, name === 'str1' ? 'String 1' : 'String 2']} />
            <Line type="monotone" dataKey="str1" stroke={STR1.color} strokeWidth={1.5} dot={false} name="str1" />
            <Line type="monotone" dataKey="str2" stroke={STR2.color} strokeWidth={1.5} dot={false} name="str2" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Mismatch indicator ─────────────────────────────────────────────────────────
function MismatchBanner() {
  const { getNum } = useHAWebSocket()
  const p1 = getNum('sensor.santanu_s_growatt_inverter_input_1_wattage')
  const p2 = getNum('sensor.santanu_s_growatt_inverter_input_2_wattage')
  const total = p1 + p2
  if (total < 200) return null  // not enough generation to compare

  const diff = Math.abs(p1 - p2)
  const pct  = (diff / Math.max(p1, p2)) * 100
  if (pct < 20) return null  // within 20% — no banner

  const weaker = p1 < p2 ? 'String 1' : 'String 2'
  const weaker_color = p1 < p2 ? STR1.color : STR2.color

  return (
    <div style={{ background: `${theme.colors.warning}14`, border: `1px solid ${theme.colors.warning}35`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16 }}>⚠</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.colors.warning }}>String mismatch detected</div>
        <div style={{ fontSize: 10, color: theme.colors.text.secondary, marginTop: 2 }}>
          <span style={{ color: weaker_color, fontWeight: 600 }}>{weaker}</span>
          {` is ${pct.toFixed(0)}% below the other — possible shading or degradation`}
        </div>
      </div>
    </div>
  )
}

// ── Legend pill ────────────────────────────────────────────────────────────────
function StringLegend() {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 12 }}>
      {[STR1, STR2].map(s => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: theme.colors.text.secondary }}>
          <span style={{ width: 20, height: 3, borderRadius: 2, background: s.color, display: 'inline-block' }} />
          {s.label}
        </div>
      ))}
    </div>
  )
}

// ── Tigo placeholder ───────────────────────────────────────────────────────────
function TigoPlaceholder() {
  return (
    <div style={card(theme.colors.accent.DEFAULT)}>
      <SectionLabel text="TIGO PANEL-LEVEL DATA" />
      <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 11, color: theme.colors.text.muted, lineHeight: 1.6 }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🔭</div>
        <div style={{ color: theme.colors.text.secondary, fontWeight: 600, marginBottom: 4 }}>Coming soon</div>
        Panel-level V/A monitoring via Tigo Cloud API for String 2.<br />
        Will help pinpoint shaded or underperforming panels.
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function StringsView() {
  const [period, setPeriod] = useState<Period>('D')
  const [offset, setOffset] = useState(0)

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '4px 12px 20px' }}>
        <TimeNav period={period} offset={offset} onPeriod={setPeriod} onOffset={setOffset} />

        {/* Live stats for both strings — full width */}
        <div style={card()}>
          <SectionLabel text="LIVE READINGS" />
          <MismatchBanner />
          <StringLiveStats color={STR1.color} label="String 1" />
          <StringLiveStats color={STR2.color} label="String 2" />
        </div>

        <StringLegend />

        <PowerCompareChart period={period} offset={offset} />
        <VoltageChart      period={period} offset={offset} />
        <CurrentChart      period={period} offset={offset} />

        <TigoPlaceholder />
      </div>
    </div>
  )
}
