import { useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, type PieLabelRenderProps } from 'recharts'
import { useHAWebSocket } from '../../hooks/useHAWebSocket'
import { useIsMobile } from '../../hooks/useIsMobile'
import { AnimatedPath } from './AnimatedPath'
import { theme } from '../../theme'
import type { NodeKey } from '../../types'

const RADIAN = Math.PI / 180

// ── Entity IDs ────────────────────────────────────────────────────────────────
const E = {
  solarTotal:      'sensor.solar_power_total',
  solarStr1:       'sensor.santanu_s_growatt_inverter_input_1_wattage',
  solarStr2:       'sensor.santanu_s_growatt_inverter_input_2_wattage',
  solarStr1V:      'sensor.santanu_s_growatt_inverter_input_1_voltage',
  solarStr1A:      'sensor.santanu_s_growatt_inverter_input_1_amperage',
  solarStr2V:      'sensor.santanu_s_growatt_inverter_input_2_voltage',
  solarStr2A:      'sensor.santanu_s_growatt_inverter_input_2_amperage',
  gridNet:         'sensor.grid_net_power',        // + = import, - = export
  batteryNet:      'sensor.battery_net_power',     // + = discharge, - = charge
  batterySoc:      'sensor.santanu_s_growatt_inverter_soc',
  invTemp:         'sensor.santanu_s_growatt_inverter_temperature',
  invStatus:       'sensor.santanu_s_growatt_inverter_status',
  outputPower:     'sensor.santanu_s_growatt_inverter_output_power',
  evStatus:        'sensor.psl_153242_status',
  evEnergy:        'sensor.psl_153242_current_energy',
  evCable:         'binary_sensor.psl_153242_cable_status',
  evChargeMode:    'sensor.psl_153242_charge_mode',
  str1EnergyToday:  'sensor.santanu_s_growatt_inverter_input_1_energy_today',
  str2EnergyToday:  'sensor.santanu_s_growatt_inverter_input_2_energy_today',
  gridExportToday:  'sensor.santanu_s_growatt_inverter_energy_to_grid_today',
  selfUseToday:     'sensor.santanu_s_growatt_inverter_energy_to_user_today',
  batChargedToday:  'sensor.santanu_s_growatt_inverter_battery_charged_today',
}

// ── EV power estimation ───────────────────────────────────────────────────────
// Pod Point exposes no real-time power sensor. We subtract an assumed standby
// load from total home consumption. Works well when EV is the dominant load.
const EV_STANDBY_W = 350   // typical UK home standby (lights, router, fridge…)
const EV_MAX_AC_W  = 7360  // Tesla MY max AC: 32 A × 230 V

// ── Layout constants ──────────────────────────────────────────────────────────
const VW = 900, VH = 580
const INV  = { x: 450, y: 285, w: 150, h: 90 }
const SOL  = { x: 450, y: 75,  r: 58 }
const GRID = { x: 220, y: 285, r: 52 }
const BAT  = { x: 680, y: 285, r: 52 }
const HOME = { x: 450, y: 490, r: 50 }
const EV   = { x: 220, y: 490, r: 44 }   // same row as HOME
const WATR = { x: 680, y: 490, r: 44 }   // same row as HOME

// Paths — EV and water now exit HOME sides horizontally (all three nodes same y)
const PATHS = {
  solar:       `M ${SOL.x},${SOL.y + SOL.r} L ${INV.x},${INV.y - INV.h / 2}`,
  gridImport:  `M ${GRID.x + GRID.r},${GRID.y} L ${INV.x - INV.w / 2},${INV.y}`,
  gridExport:  `M ${INV.x - INV.w / 2},${INV.y} L ${GRID.x + GRID.r},${GRID.y}`,
  batCharge:   `M ${INV.x + INV.w / 2},${INV.y} L ${BAT.x - BAT.r},${BAT.y}`,
  batDischarge:`M ${BAT.x - BAT.r},${BAT.y} L ${INV.x + INV.w / 2},${INV.y}`,
  home:        `M ${INV.x},${INV.y + INV.h / 2} L ${HOME.x},${HOME.y - HOME.r}`,
  ev:          `M ${HOME.x - HOME.r},${HOME.y} L ${EV.x + EV.r},${EV.y}`,
  water:       `M ${HOME.x + HOME.r},${HOME.y} L ${WATR.x - WATR.r},${WATR.y}`,
}

function fmt(w: number) {
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(1)} kW`
  return `${Math.round(w)} W`
}

// ── Node subcomponents ────────────────────────────────────────────────────────

// 3×2 grid solar panel icon
function SolarPanelIcon({ cx, cy, color, active }: { cx: number; cy: number; color: string; active: boolean }) {
  const pw = 6, ph = 4, gap = 1
  const pW = 3 * pw + 2 * gap   // 20 px wide
  const pH = 2 * ph + gap        //  9 px tall
  const px0 = cx - pW / 2, py0 = cy - pH / 2
  return (
    <g>
      <rect x={px0 - 1} y={py0 - 1} width={pW + 2} height={pH + 2} rx={1.5}
        fill="none" stroke={color} strokeWidth={0.8} strokeOpacity={0.7} />
      {[0, 1, 2].flatMap(col => [0, 1].map(row => (
        <rect key={`${col}-${row}`}
          x={px0 + col * (pw + gap)} y={py0 + row * (ph + gap)}
          width={pw} height={ph}
          fill={active ? `${color}40` : `${color}12`} rx={0.5}
        />
      )))}
    </g>
  )
}

// String sub-node — rounded rectangle showing V / A / W
function StringNode({ cx, cy, label, watts, volts, amps }:
  { cx: number; cy: number; label: string; watts: number; volts: number; amps: number }) {
  const W = 60, H = 76
  const x0 = cx - W / 2, y0 = cy - H / 2
  const active = watts > 5
  const c = active ? theme.colors.solar.DEFAULT : theme.colors.text.muted

  return (
    <g>
      {/* Card */}
      <rect x={x0} y={y0} width={W} height={H} rx={8}
        fill={active ? `${theme.colors.solar.DEFAULT}12` : `${theme.colors.solar.DEFAULT}06`}
        stroke={c} strokeWidth={1.2} />

      {/* Header */}
      <text x={cx} y={cy - 27} textAnchor="middle" fill={theme.colors.text.muted}
        fontSize={8.5} letterSpacing="0.06em">{label.toUpperCase()}</text>

      {/* Solar panel icon */}
      <SolarPanelIcon cx={cx} cy={cy - 13} color={theme.colors.solar.DEFAULT} active={active} />

      {/* Divider */}
      <line x1={x0 + 10} y1={cy - 3} x2={x0 + W - 10} y2={cy - 3}
        stroke={c} strokeWidth={0.5} strokeOpacity={0.3} />

      {/* Voltage */}
      <text x={cx} y={cy + 11} textAnchor="middle" fill={theme.colors.text.secondary} fontSize={10}>
        {volts > 0 ? `${volts.toFixed(1)} V` : '— V'}
      </text>
      {/* Current */}
      <text x={cx} y={cy + 23} textAnchor="middle" fill={theme.colors.text.secondary} fontSize={10}>
        {amps > 0 ? `${amps.toFixed(1)} A` : '— A'}
      </text>
      {/* Power — bold, coloured */}
      <text x={cx} y={cy + 36} textAnchor="middle" fill={c} fontSize={11} fontWeight="700">
        {fmt(watts)}
      </text>
    </g>
  )
}

// ── Recharts donut — today's solar breakdown, embedded via foreignObject ──────
function PowerFlowDonut({ generated, selfUsed, batCharged, exported }: {
  generated: number; selfUsed: number; batCharged: number; exported: number
}) {
  const isEmpty = generated < 0.01
  const segments = [
    { name: 'Self',  value: selfUsed,    color: theme.colors.solar.DEFAULT },
    { name: 'Bat',   value: batCharged,  color: theme.colors.battery.DEFAULT },
    { name: 'Grid',  value: exported,    color: theme.colors.grid.DEFAULT },
  ].filter(s => s.value > 0.001)

  const renderLabel = ({
    cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0, name = '', index = 0,
  }: PieLabelRenderProps & { index?: number }) => {
    if (percent < 0.06) return null
    const midR = innerRadius + (outerRadius - innerRadius) * 0.5
    // Determine upper/lower half by the actual Y position of the segment midpoint.
    // Raw midAngle from Recharts can exceed [-180,180] for late segments, so angle
    // comparisons fail — Y position is unambiguous regardless of winding.
    const midRad = -midAngle * RADIAN
    const segMidY = cy + midR * Math.sin(midRad)
    const isCCW = segMidY > cy   // below centre → CCW arc reads upright
    // CCW paths: glyphs extend inward (+3px); CW paths: glyphs extend outward (-3px).
    const r = isCCW ? midR + 3 : midR - 3
    const halfSpan = percent * 180
    const a1 = -(midAngle + halfSpan) * RADIAN
    const a2 = -(midAngle - halfSpan) * RADIAN
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    const largeArc = percent > 0.5 ? 1 : 0
    const pathId = `pf-arc-${index}`
    const d = isCCW
      ? `M ${x2} ${y2} A ${r} ${r} 0 ${largeArc} 0 ${x1} ${y1}`
      : `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
    return (
      <g>
        <defs><path id={pathId} d={d} fill="none" /></defs>
        <text fontSize={11} fontWeight="700" fill="rgba(8,14,26,0.9)">
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {String(name)} {Math.round(percent * 100)}%
          </textPath>
        </text>
      </g>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={isEmpty ? [{ name: '', value: 1 }] : segments}
            cx="50%" cy="50%"
            innerRadius="38%" outerRadius="55%"
            startAngle={90} endAngle={-270}
            dataKey="value" stroke="none" paddingAngle={isEmpty ? 0 : 2}
            label={isEmpty ? undefined : renderLabel} labelLine={false}
            isAnimationActive={false}>
            {isEmpty
              ? <Cell fill="rgba(100,116,139,0.12)" />
              : segments.map((s, i) => <Cell key={i} fill={s.color} />)
            }
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: theme.colors.solar.DEFAULT, lineHeight: 1 }}>
          {isEmpty ? '—' : generated.toFixed(1)}
        </div>
        <div style={{ fontSize: 11, color: theme.colors.text.muted, marginTop: 3 }}>kWh today</div>
      </div>
    </div>
  )
}

function SolarNode({ cx, cy, r, watts, str1, str2, v1, i1, v2, i2, onClick, showStrings = true }:
  { cx: number; cy: number; r: number; watts: number
    str1: number; str2: number; v1: number; i1: number; v2: number; i2: number
    onClick?: () => void; showStrings?: boolean }) {
  const MAX_W = 6000
  const pct = Math.min(Math.max(watts, 0) / MAX_W, 1)
  const ringThick = 14
  const ringR = r - ringThick / 2          // centre of ring stroke
  const circum = 2 * Math.PI * ringR
  const filled = circum * pct
  const unfilled = circum * (1 - pct)
  const solarColor = theme.colors.solar.DEFAULT
  const s1cx = cx - 115, s2cx = cx + 115
  const halfW = 30
  // Bottom arc path (CCW left→right via 6 o'clock, sweep=0) for watts textPath
  // +3px radius offset corrects for CCW arcs where glyphs extend inward
  const arcId = `sun-w-${cx}`
  const textR = ringR + 3
  const arcD = `M ${cx - textR} ${cy} A ${textR} ${textR} 0 0 0 ${cx + textR} ${cy}`

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {showStrings && <>
        <AnimatedPath
          d={`M ${s1cx + halfW},${cy} L ${cx - r},${cy}`}
          color={solarColor} watts={str1} width={2} arrows={2} small
        />
        <AnimatedPath
          d={`M ${s2cx - halfW},${cy} L ${cx + r},${cy}`}
          color={solarColor} watts={str2} width={2} arrows={2} small
        />
        <StringNode cx={s1cx} cy={cy} label="String 1" watts={str1} volts={v1} amps={i1} />
        <StringNode cx={s2cx} cy={cy} label="String 2" watts={str2} volts={v2} amps={i2} />
      </>}

      {/* Dark hole fill */}
      <circle cx={cx} cy={cy} r={r - ringThick} fill="#0d1b2e" />
      {/* Track ring: always visible amber, soft glow even at night */}
      <circle cx={cx} cy={cy} r={ringR} fill="none"
        stroke={solarColor} strokeWidth={ringThick} strokeOpacity={0.45}
        style={{ filter: `drop-shadow(0 0 5px ${solarColor}55)` }} />
      {/* Progress arc: bright amber + strong glow, fills from 12 o'clock CW */}
      {pct > 0.01 && (
        <circle cx={cx} cy={cy} r={ringR} fill="none"
          stroke={solarColor} strokeWidth={ringThick}
          strokeDasharray={`${filled} ${unfilled}`}
          strokeDashoffset={circum / 4}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${solarColor}dd)` }}
        />
      )}

      {/* Watts arc text: white — readable on both dim track and bright arc */}
      <defs><path id={arcId} d={arcD} fill="none" /></defs>
      <text fontSize={11} fontWeight="700" fill="rgba(255,255,255,0.95)">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          {fmt(watts)}
        </textPath>
      </text>

      {/* Sun icon centred in ring hole */}
      <circle cx={cx} cy={cy} r={12} fill={solarColor} fillOpacity={0.9} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
        const rad = deg * RADIAN
        return (
          <line key={deg}
            x1={cx + Math.cos(rad) * 15} y1={cy + Math.sin(rad) * 15}
            x2={cx + Math.cos(rad) * 20} y2={cy + Math.sin(rad) * 20}
            stroke={solarColor} strokeWidth={2} strokeLinecap="round" />
        )
      })}

      <text x={cx} y={cy + r + 16} textAnchor="middle"
        fill={theme.colors.text.primary} fontSize={12} fontWeight="600">Solar</text>
    </g>
  )
}

function GridNode({ cx, cy, r, watts, exportToday, totalGenToday, onClick }:
  { cx: number; cy: number; r: number; watts: number; exportToday: number; totalGenToday: number; onClick?: () => void }) {
  const importing = watts > 5
  const exporting = watts < -5
  const gc = theme.colors.grid.DEFAULT

  const ringThick = 14
  const ringR     = r - ringThick / 2  // 45
  const holeR     = r - ringThick       // 38
  const circum    = 2 * Math.PI * ringR

  // Fill = today's export fraction of total solar generated (0–100%)
  const pct      = totalGenToday > 0.01 ? Math.min(1, exportToday / totalGenToday) : 0
  const filled   = circum * pct
  const unfilled = circum * (1 - pct)

  // Arc text — live watt flow
  const arcId    = `grid-w-${cx}`
  const textR    = ringR + 3
  const arcD     = `M ${cx - textR} ${cy} A ${textR} ${textR} 0 0 0 ${cx + textR} ${cy}`
  const arcLabel = importing ? `↓ ${fmt(watts)}`
                 : exporting ? `↑ ${fmt(Math.abs(watts))}`
                 : '0 W'

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Dark hole */}
      <circle cx={cx} cy={cy} r={holeR} fill="#0d1b2e" />

      {/* Track ring — dim violet + soft glow, always visible */}
      <circle cx={cx} cy={cy} r={ringR} fill="none"
        stroke={gc} strokeWidth={ringThick} strokeOpacity={0.45}
        style={{ filter: `drop-shadow(0 0 5px ${gc}55)` }} />

      {/* Progress arc — solid violet, strong glow when exporting */}
      {pct > 0.01 && (
        <circle cx={cx} cy={cy} r={ringR} fill="none"
          stroke={gc} strokeWidth={ringThick}
          strokeDasharray={`${filled} ${unfilled}`}
          strokeDashoffset={circum / 4}
          strokeLinecap="round"
          style={{ filter: exporting
            ? `drop-shadow(0 0 10px ${gc}dd)`
            : `drop-shadow(0 0 6px ${gc}88)` }}
        />
      )}

      {/* Transmission tower — scaled to fit inside holeR=38 */}
      <line x1={cx} y1={cy-20} x2={cx} y2={cy+11} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      <line x1={cx} y1={cy-20} x2={cx-4} y2={cy-14} stroke={gc} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={cx} y1={cy-20} x2={cx+4} y2={cy-14} stroke={gc} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={cx-11} y1={cy-11} x2={cx+11} y2={cy-11} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      <line x1={cx-14} y1={cy} x2={cx+14} y2={cy} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      <line x1={cx-9} y1={cy-11} x2={cx+9} y2={cy} stroke={gc} strokeWidth={0.8} strokeLinecap="round" strokeOpacity={0.45} />
      <line x1={cx+9} y1={cy-11} x2={cx-9} y2={cy} stroke={gc} strokeWidth={0.8} strokeLinecap="round" strokeOpacity={0.45} />
      <path d={`M ${cx-11},${cy-11} Q ${cx-11},${cy-5} ${cx-14},${cy}`} fill="none" stroke={gc} strokeWidth={0.9} strokeOpacity={0.55} />
      <path d={`M ${cx+11},${cy-11} Q ${cx+11},${cy-5} ${cx+14},${cy}`} fill="none" stroke={gc} strokeWidth={0.9} strokeOpacity={0.55} />
      <line x1={cx} y1={cy+11} x2={cx-9} y2={cy+19} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      <line x1={cx} y1={cy+11} x2={cx+9} y2={cy+19} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      <line x1={cx-9} y1={cy+19} x2={cx+9} y2={cy+19} stroke={gc} strokeWidth={1.5} strokeLinecap="round" />

      {/* Arc text — live watts at bottom of ring */}
      <defs><path id={arcId} d={arcD} fill="none" /></defs>
      <text fontSize={11} fontWeight="700" fill="rgba(255,255,255,0.92)">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{arcLabel}</textPath>
      </text>

      <text x={cx} y={cy + r + 16} textAnchor="middle"
        fill={theme.colors.text.primary} fontSize={12} fontWeight="600">Grid</text>
    </g>
  )
}

function BatteryNode({ cx, cy, r, watts, soc, onClick }: { cx: number; cy: number; r: number; watts: number; soc: number; onClick?: () => void }) {
  const charging    = watts < -5
  const discharging = watts > 5
  const batColor  = theme.colors.battery.DEFAULT
  const socColor  = soc > 50 ? batColor : soc > 30 ? theme.colors.warning : theme.colors.danger

  // Donut ring — SOC-based progress
  const ringThick = 14
  const ringR     = r - ringThick / 2          // 52 - 7 = 45
  const circum    = 2 * Math.PI * ringR
  const filled    = circum * (soc / 100)
  const unfilled  = circum * (1 - soc / 100)

  // Bottom arc for charging/discharging arc text (CCW, sweep=0, +3px centering)
  const arcId  = `bat-w-${cx}`
  const textR  = ringR + 3
  const arcD   = `M ${cx - textR} ${cy} A ${textR} ${textR} 0 0 0 ${cx + textR} ${cy}`

  // Battery icon — centred in ring hole
  const barH = 44, barW = 28
  const battTop    = cy - barH / 2            // top of outline
  const battBottom = cy + barH / 2            // bottom of outline
  const fillH      = (soc / 100) * barH
  const fillY      = battBottom - fillH       // fill grows from bottom
  const fillCenterY = fillY + fillH / 2       // vertical centre of fill

  // SOC text: dark navy inside fill when big enough, socColor centred in body when tiny
  const socTextY    = soc >= 22 ? fillCenterY + 4 : cy + 4
  const socTextFill = soc >= 22 ? 'rgba(8,14,26,0.88)' : socColor

  // Arc label
  const arcLabel = charging    ? `↑ ${fmt(Math.abs(watts))}`
                 : discharging ? `↓ ${fmt(watts)}`
                 : null

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Dark centre fill */}
      <circle cx={cx} cy={cy} r={r - ringThick} fill="#0d1b2e" />

      {/* Track ring — always visible battery green */}
      <circle cx={cx} cy={cy} r={ringR} fill="none"
        stroke={batColor} strokeWidth={ringThick} strokeOpacity={0.45}
        style={{ filter: `drop-shadow(0 0 5px ${batColor}55)` }} />

      {/* SOC progress arc — colour shifts with SOC health */}
      {soc > 1 && (
        <circle cx={cx} cy={cy} r={ringR} fill="none"
          stroke={socColor} strokeWidth={ringThick}
          strokeDasharray={`${filled} ${unfilled}`}
          strokeDashoffset={circum / 4}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${socColor}bb)` }}
        />
      )}

      {/* Battery icon */}
      {/* Terminal nub */}
      <rect x={cx - 4} y={battTop - 4} width={8} height={4} rx={1} fill={batColor} />
      {/* Outline */}
      <rect x={cx - barW / 2} y={battTop} width={barW} height={barH} rx={3}
        fill="none" stroke={batColor} strokeWidth={1.5} />
      {/* Fill bar */}
      {fillH > 0 && (
        <rect x={cx - barW / 2 + 2} y={fillY} width={barW - 4} height={fillH}
          rx={2} fill={socColor} fillOpacity={0.85} />
      )}
      {/* SOC % inside fill (reverse colour against fill) */}
      <text x={cx} y={socTextY} textAnchor="middle"
        fill={socTextFill} fontSize={10} fontWeight="700">{soc}%</text>

      {/* Charging / discharging arc text at bottom of ring */}
      <defs><path id={arcId} d={arcD} fill="none" /></defs>
      {arcLabel && (
        <text fontSize={11} fontWeight="700" fill="rgba(255,255,255,0.95)">
          <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
            {arcLabel}
          </textPath>
        </text>
      )}

      <text x={cx} y={cy + r + 16} textAnchor="middle"
        fill={theme.colors.text.primary} fontSize={12} fontWeight="600">Battery</text>
    </g>
  )
}

function HomeNode({ cx, cy, r, watts, solarFrac, batFrac, gridFrac, onClick }:
  { cx: number; cy: number; r: number; watts: number
    solarFrac: number; batFrac: number; gridFrac: number; onClick?: () => void }) {
  const load      = Math.max(0, watts)
  const homeColor = '#f1f5f9'
  const ringThick = 12
  const ringR     = r - ringThick / 2  // 44
  const circum    = 2 * Math.PI * ringR

  // Build per-source segments: solar=amber, battery=teal, grid=violet
  const sources = [
    { frac: solarFrac, color: theme.colors.solar.DEFAULT },
    { frac: batFrac,   color: theme.colors.battery.DEFAULT },
    { frac: gridFrac,  color: theme.colors.grid.DEFAULT },
  ]
  // Compute arc offset for each segment (CW from 12 o'clock)
  let cumLen = 0
  const segments = sources
    .filter(s => s.frac >= 0.02)
    .map(s => {
      const len       = circum * s.frac
      const dashoffset = circum / 4 - cumLen
      cumLen += len
      return { color: s.color, len, dashoffset }
    })

  const arcId = `home-w-${cx}`
  const textR = ringR + 3
  const arcD  = `M ${cx - textR} ${cy} A ${textR} ${textR} 0 0 0 ${cx + textR} ${cy}`

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <circle cx={cx} cy={cy} r={r - ringThick} fill="#0d1b2e" />
      {/* Dim white track ring */}
      <circle cx={cx} cy={cy} r={ringR} fill="none"
        stroke={homeColor} strokeWidth={ringThick} strokeOpacity={0.14} />
      {/* Per-source coloured arcs (solar amber → battery teal → grid violet) */}
      {segments.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={ringR} fill="none"
          stroke={seg.color} strokeWidth={ringThick}
          strokeDasharray={`${seg.len} ${circum - seg.len}`}
          strokeDashoffset={seg.dashoffset}
          strokeLinecap="butt"
          style={{ filter: `drop-shadow(0 0 7px ${seg.color}99)` }}
        />
      ))}
      {/* Watts arc text at bottom */}
      <defs><path id={arcId} d={arcD} fill="none" /></defs>
      <text fontSize={11} fontWeight="700" fill="rgba(255,255,255,0.92)">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{fmt(load)}</textPath>
      </text>
      {/* White house icon */}
      <rect x={cx + 5} y={cy - 22} width={4} height={8} fill="rgba(241,245,249,0.20)" stroke={homeColor} strokeWidth={1} />
      <polygon points={`${cx},${cy - 17} ${cx - 16},${cy - 3} ${cx + 16},${cy - 3}`}
        fill="rgba(241,245,249,0.20)" stroke={homeColor} strokeWidth={1.5} strokeLinejoin="round" />
      <rect x={cx - 11} y={cy - 3} width={22} height={14} fill="rgba(241,245,249,0.12)" stroke={homeColor} strokeWidth={1.5} />
      <rect x={cx - 4} y={cy + 5} width={8} height={6} rx={1.5} fill="rgba(241,245,249,0.30)" />
      <text x={cx} y={cy + r + 16} textAnchor="middle"
        fill={theme.colors.text.primary} fontSize={12} fontWeight="600">Home</text>
    </g>
  )
}

function EvNode({ cx, cy, r, status, energy: _energy, cable, chargeMode: _chargeMode, watts, onClick }:
  { cx: number; cy: number; r: number; status: string; energy: number; cable: boolean; chargeMode: string; watts: number; onClick?: () => void }) {
  const charging  = status.toLowerCase().includes('charg')
  const connected = cable
  const evColor   = theme.colors.ev.DEFAULT
  const ringThick = 12
  const ringR     = r - ringThick / 2  // 38
  const holeR     = r - ringThick       // 32
  const circum    = 2 * Math.PI * ringR
  const pct       = Math.min(Math.max(watts, 0) / EV_MAX_AC_W, 1)
  const filled    = circum * pct
  const unfilled  = circum * (1 - pct)

  const arcId  = `ev-w-${cx}`
  const textR  = ringR + 3
  const arcD   = `M ${cx - textR} ${cy} A ${textR} ${textR} 0 0 0 ${cx + textR} ${cy}`
  const arcLabel = charging  ? `↑ ${fmt(watts)}`
                 : connected ? 'Connected'
                 : 'No cable'
  const iconColor = charging ? evColor : connected ? theme.colors.text.secondary : theme.colors.text.muted

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Dark centre fill */}
      <circle cx={cx} cy={cy} r={holeR} fill="#0d1b2e" />

      {/* Track ring */}
      <circle cx={cx} cy={cy} r={ringR} fill="none"
        stroke={evColor} strokeWidth={ringThick}
        strokeOpacity={charging ? 0.45 : 0.2}
        style={{ filter: `drop-shadow(0 0 ${charging ? 7 : 3}px ${evColor}${charging ? '88' : '44'})` }} />

      {/* Progress arc — only when charging */}
      {pct > 0.01 && (
        <circle cx={cx} cy={cy} r={ringR} fill="none"
          stroke={evColor} strokeWidth={ringThick}
          strokeDasharray={`${filled} ${unfilled}`}
          strokeDashoffset={circum / 4}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${evColor}dd)` }}
        />
      )}

      {/* Arc text at bottom of ring */}
      <defs><path id={arcId} d={arcD} fill="none" /></defs>
      <text fontSize={10} fontWeight="700" fill="rgba(255,255,255,0.92)">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{arcLabel}</textPath>
      </text>

      {/* Car icon centred in hole */}
      <path d={`M ${cx-10},${cy+3} Q ${cx-10},${cy-4} ${cx-5},${cy-10} L ${cx+5},${cy-10} Q ${cx+10},${cy-4} ${cx+10},${cy+3} Z`}
        fill="none" stroke={iconColor} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={cx-6} cy={cy+3} r={3} fill="none" stroke={iconColor} strokeWidth={1.5} />
      <circle cx={cx+6} cy={cy+3} r={3} fill="none" stroke={iconColor} strokeWidth={1.5} />
      {charging && (
        <text x={cx} y={cy-2} textAnchor="middle" dominantBaseline="middle"
          fill={evColor} fontSize={9} fontWeight="700">⚡</text>
      )}

      <text x={cx} y={cy + r + 16} textAnchor="middle"
        fill={theme.colors.text.primary} fontSize={12} fontWeight="600">EV</text>
    </g>
  )
}

function WaterNode({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const heatColor = theme.colors.heat.DEFAULT
  const ringThick = 12
  const ringR     = r - ringThick / 2  // 38
  const holeR     = r - ringThick       // 32

  return (
    <g>
      {/* Dark centre fill */}
      <circle cx={cx} cy={cy} r={holeR} fill="#0d1b2e" />

      {/* Decorative dashed ring — inactive */}
      <circle cx={cx} cy={cy} r={ringR} fill="none"
        stroke={theme.colors.text.muted} strokeWidth={ringThick} strokeOpacity={0.15}
        strokeDasharray="10 7"
        style={{ filter: 'drop-shadow(0 0 3px rgba(100,116,139,0.25))' }} />

      {/* Water drop centred in hole */}
      <path
        d={`M ${cx},${cy - 10} C ${cx - 7},${cy - 2} ${cx - 8},${cy + 4} ${cx - 5},${cy + 9} C ${cx - 2},${cy + 13} ${cx + 2},${cy + 13} ${cx + 5},${cy + 9} C ${cx + 8},${cy + 4} ${cx + 7},${cy - 2} ${cx},${cy - 10} Z`}
        fill={`${heatColor}20`} stroke={heatColor} strokeWidth={1.2} strokeOpacity={0.55} />

      {/* Heat waves above drop */}
      {[-5, 0, 5].map((ox, i) => (
        <path key={i}
          d={`M ${cx + ox},${cy - 13} Q ${cx + ox + 2},${cy - 17} ${cx + ox},${cy - 21}`}
          fill="none" stroke={heatColor} strokeWidth={1.2} strokeLinecap="round" strokeOpacity={0.45} />
      ))}

      <text x={cx} y={cy + r + 16} textAnchor="middle"
        fill={theme.colors.text.muted} fontSize={12} fontWeight="600">Hot Water</text>
    </g>
  )
}

function FlowLabel({ x, y, text, color, rotate = 0 }: { x: number; y: number; text: string; color: string; rotate?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={color}
      fontSize={9} fontWeight="500" fillOpacity={0.75} letterSpacing="0.04em"
      transform={rotate !== 0 ? `rotate(${rotate}, ${x}, ${y})` : undefined}>
      {text}
    </text>
  )
}

function InverterBox({ x, y, w, h, temp, status }: { x: number; y: number; w: number; h: number; temp: number; status: string }) {
  const online = !['off', 'unavailable', 'unknown'].includes(status.toLowerCase())
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={10}
        fill={`${theme.colors.accent.DEFAULT}12`} stroke={theme.colors.accent.DEFAULT} strokeWidth={1.5} />
      <rect x={x - w / 2 + 4} y={y - h / 2 + 4} width={w - 8} height={h - 8} rx={7}
        fill="none" stroke={theme.colors.accent.DEFAULT} strokeWidth={0.5} strokeOpacity={0.3} />
      <text x={x} y={y - 16} textAnchor="middle" fill={theme.colors.accent.DEFAULT} fontSize={11} fontWeight="800" letterSpacing="2">GROWATT</text>
      <text x={x} y={y} textAnchor="middle" fill={theme.colors.text.secondary} fontSize={10}>SPH6000</text>
      <text x={x} y={y + 14} textAnchor="middle" fill={online ? theme.colors.positive : theme.colors.danger} fontSize={10} fontWeight="600">
        {online ? '● Online' : '○ Offline'}
      </text>
      {temp > 0 && (
        <text x={x} y={y + 28} textAnchor="middle" fill={theme.colors.text.muted} fontSize={10}>{temp}°C</text>
      )}
    </g>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PowerFlow({ onNodeClick }: { onNodeClick?: (node: NodeKey) => void } = {}) {
  const isMobile = useIsMobile()
  const { getNum, getState, status } = useHAWebSocket()

  const solar    = getNum(E.solarTotal)
  const str1     = getNum(E.solarStr1)
  const str2     = getNum(E.solarStr2)
  const str1V    = getNum(E.solarStr1V)
  const str1A    = getNum(E.solarStr1A)
  const str2V    = getNum(E.solarStr2V)
  const str2A    = getNum(E.solarStr2A)
  const gridNet  = getNum(E.gridNet)     // + = import, - = export
  const batNet   = getNum(E.batteryNet)  // + = discharge, - = charge
  const batSoc   = getNum(E.batterySoc)
  const invTemp  = getNum(E.invTemp)
  const invStatus= getState(E.invStatus)
  const evStatus     = getState(E.evStatus)
  const evEnergy     = getNum(E.evEnergy)
  const evCable      = getState(E.evCable) === '1' || getState(E.evCable) === 'on'
  const evChargeMode = getState(E.evChargeMode)
  const todayGen        = getNum(E.str1EnergyToday) + getNum(E.str2EnergyToday)
  const gridExportToday = getNum(E.gridExportToday)
  const selfUseToday    = getNum(E.selfUseToday)
  const batChargedToday = getNum(E.batChargedToday)

  // Home consumption = solar + grid import + battery discharge
  const gridImport   = Math.max(0,  gridNet)
  const gridExport   = Math.max(0, -gridNet)
  const batCharge    = Math.max(0, -batNet)
  const batDischarge = Math.max(0,  batNet)
  const homeWatts    = Math.round(solar + gridImport + batDischarge - batCharge - gridExport)
  // Per-source fractions for Home ring (solar=amber, battery=teal, grid=violet)
  const homeSolarW    = Math.max(0, solar - gridExport - batCharge)
  const homeSolarFrac = homeWatts > 10 ? Math.min(1,                                          homeSolarW    / homeWatts) : 0
  const homeBatFrac   = homeWatts > 10 ? Math.min(1 - homeSolarFrac,                          batDischarge  / homeWatts) : 0
  const homeGridFrac  = homeWatts > 10 ? Math.min(1 - homeSolarFrac - homeBatFrac,            gridImport    / homeWatts) : 0

  const evCharging = evStatus.toLowerCase().includes('charg')
  const evWatts    = evCharging
    ? Math.min(EV_MAX_AC_W, Math.max(0, homeWatts - EV_STANDBY_W))
    : 0

  // ── Drive the background solar glow via CSS custom properties ────────────
  useEffect(() => {
    const now   = new Date()
    const hour  = now.getHours() + now.getMinutes() / 60
    // UK seasonal average arc: 6 am rise → 8:30 pm set
    const riseH = 6, setH = 20.5
    const t     = Math.max(0, Math.min(1, (hour - riseH) / (setH - riseH)))

    // Glow x: left (east/sunrise) → right (west/sunset)
    const sunX = 8 + t * 84
    // Glow y: near horizon (52%) at rise/set, near top (8%) at noon
    const sunY = 52 - Math.sin(t * Math.PI) * 44

    // Intensity from live solar watts (SPH6000 peak ~6 kW)
    const intensity = Math.min(1, solar / 5500)
    const opacity   = 0.08 + intensity * 0.22   // 0.08 night → 0.30 peak
    const spread    = 52 + intensity * 30        // 52% night → 82% full sun

    const root = document.documentElement
    root.style.setProperty('--solar-x',          `${sunX.toFixed(1)}%`)
    root.style.setProperty('--solar-y',          `${sunY.toFixed(1)}%`)
    root.style.setProperty('--solar-opacity',    opacity.toFixed(3))
    root.style.setProperty('--solar-spread',     `${spread.toFixed(1)}%`)
    root.style.setProperty('--solar-spread-mask', `${(spread + 22).toFixed(1)}%`)
  }, [solar])

  const _now      = new Date()
  const dayNum    = _now.getDate()
  const dayName   = _now.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
  const monthName = _now.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
  const connected = status === 'connected'

  // Mobile: viewport centred on INV x=450 (x_start = 450 - 591/2 = 155), another 3% tighter
  const viewBox = isMobile ? '155 -35 591 625' : `0 0 ${VW} ${VH}`

  return (
    <div className={`relative w-full ${isMobile ? '' : 'h-full flex items-center justify-center'}`}>
      <svg viewBox={viewBox}
        style={{ width: '100%', height: isMobile ? 'auto' : '100%', maxHeight: isMobile ? 'none' : '100%' }}
        xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow-accent">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── Animated connection paths (path written in arrow-travel direction) ── */}
        <AnimatedPath d={PATHS.solar}                                              color={theme.colors.solar.DEFAULT}   watts={solar} />
        <AnimatedPath d={gridNet < 0 ? PATHS.gridExport : PATHS.gridImport}       color={theme.colors.grid.DEFAULT}    watts={Math.abs(gridNet)} />
        <AnimatedPath d={batNet  > 0 ? PATHS.batDischarge : PATHS.batCharge}      color={theme.colors.battery.DEFAULT} watts={Math.abs(batNet)} />
        <AnimatedPath d={PATHS.home}                                               color={theme.colors.accent.DEFAULT}  watts={homeWatts} />
        <AnimatedPath d={PATHS.ev}                                                 color={theme.colors.ev.DEFAULT}      watts={evWatts} />
        <AnimatedPath d={PATHS.water}                                              color={theme.colors.heat.DEFAULT}    watts={0} />

        {/* ── Flow direction labels ── */}
        {solar > 5     && <FlowLabel x={470} y={186} text="Generating"  color={theme.colors.solar.DEFAULT}   rotate={-90} />}
        {gridNet > 5   && <FlowLabel x={324} y={274} text="Importing"   color={theme.colors.grid.DEFAULT} />}
        {gridNet < -5  && <FlowLabel x={324} y={274} text="Exporting"   color={theme.colors.grid.DEFAULT} />}
        {batNet < -5   && <FlowLabel x={577} y={274} text="Charging"    color={theme.colors.battery.DEFAULT} />}
        {batNet > 5    && <FlowLabel x={577} y={274} text="Discharging" color={theme.colors.battery.DEFAULT} />}
        {homeWatts > 5 && <FlowLabel x={470} y={385} text="Consuming"   color={theme.colors.accent.DEFAULT}  rotate={-90} />}

        {/* ── Nodes ── */}
        <SolarNode
          cx={SOL.x} cy={SOL.y} r={SOL.r}
          watts={solar} str1={str1} str2={str2}
          v1={str1V} i1={str1A} v2={str2V} i2={str2A}
          onClick={() => onNodeClick?.('solar')}
          showStrings
        />
        <GridNode    cx={GRID.x} cy={GRID.y} r={GRID.r} watts={gridNet}
          exportToday={gridExportToday} totalGenToday={todayGen}
          onClick={() => onNodeClick?.('grid')} />
        <InverterBox x={INV.x}  y={INV.y}  w={INV.w}  h={INV.h}  temp={invTemp} status={invStatus} />
        <BatteryNode cx={BAT.x} cy={BAT.y}  r={BAT.r}  watts={batNet}  soc={batSoc} onClick={() => onNodeClick?.('battery')} />
        <HomeNode    cx={HOME.x} cy={HOME.y} r={HOME.r} watts={homeWatts}
          solarFrac={homeSolarFrac} batFrac={homeBatFrac} gridFrac={homeGridFrac}
          onClick={() => onNodeClick?.('home')} />
        <EvNode      cx={EV.x}  cy={EV.y}   r={EV.r}   status={evStatus} energy={evEnergy} cable={evCable} chargeMode={evChargeMode} watts={evWatts} onClick={() => onNodeClick?.('ev')} />
        <WaterNode   cx={WATR.x} cy={WATR.y} r={WATR.r} />

        {/* ── Solar donut (today's breakdown) — embedded via foreignObject ── */}
        <foreignObject x={120} y={-25} width={200} height={200}>
          <div style={{ width: '100%', height: '100%' }}>
            <PowerFlowDonut
              generated={todayGen}
              selfUsed={selfUseToday}
              batCharged={batChargedToday}
              exported={gridExportToday}
            />
          </div>
        </foreignObject>

        {/* ── Date + Live ring — cx=BAT.x, cy=SOL.y
             Matches PowerFlowDonut ring: outer=55, inner=38, stroke=17, ringMid=46.5 ── */}
        <g>
          {/* Dark hole matching PowerFlowDonut innerRadius=38 */}
          <circle cx={BAT.x} cy={SOL.y} r={38} fill="#0d1b2e" fillOpacity={0.82} />
          {/* Track ring: ringMid=46.5→47, strokeWidth=17, outer≈55.5 */}
          <circle cx={BAT.x} cy={SOL.y} r={47} fill="none"
            stroke={connected ? theme.colors.accent.DEFAULT : theme.colors.text.muted}
            strokeWidth={17}
            strokeOpacity={connected ? 0.35 : 0.12}
            strokeDasharray={connected ? undefined : '10 6'}
            style={{ filter: connected ? `drop-shadow(0 0 10px ${theme.colors.accent.DEFAULT}66)` : 'none' }}
          />
          {/* Pulse overlay when live */}
          {connected && (
            <circle cx={BAT.x} cy={SOL.y} r={47} fill="none"
              stroke={theme.colors.accent.DEFAULT} strokeWidth={17} strokeOpacity={0}>
              <animate attributeName="stroke-opacity" values="0.18;0;0.18" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
          {/* LIVE / OFF — plain text above date */}
          <circle cx={BAT.x - 14} cy={SOL.y - 14} r={2.5}
            fill={connected ? theme.colors.accent.DEFAULT : theme.colors.danger}>
            {connected && <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />}
          </circle>
          <text x={BAT.x + 3} y={SOL.y - 10} textAnchor="middle"
            fill={connected ? theme.colors.accent.DEFAULT : theme.colors.danger}
            fontSize={10} fontWeight={700} letterSpacing="0.10em">
            {connected ? 'LIVE' : 'OFF'}
          </text>
          {/* Date — one line: "THU, 14 MAY" */}
          <text x={BAT.x} y={SOL.y + 8} textAnchor="middle"
            fill={theme.colors.text.primary} fontSize={11} fontWeight={600} letterSpacing="0.04em">
            {`${dayName}, ${dayNum} ${monthName}`}
          </text>
        </g>
      </svg>
    </div>
  )
}
