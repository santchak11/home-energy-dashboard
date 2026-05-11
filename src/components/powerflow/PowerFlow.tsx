import { useHAWebSocket } from '../../hooks/useHAWebSocket'
import { AnimatedPath } from './AnimatedPath'
import { theme } from '../../theme'

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
  str1EnergyToday: 'sensor.santanu_s_growatt_inverter_input_1_energy_today',
  str2EnergyToday: 'sensor.santanu_s_growatt_inverter_input_2_energy_today',
  gridExportToday: 'sensor.santanu_s_growatt_inverter_energy_to_grid_today',
  selfUseToday:    'sensor.santanu_s_growatt_inverter_energy_to_user_today',
}

// ── Layout constants ──────────────────────────────────────────────────────────
const VW = 900, VH = 580
const INV  = { x: 450, y: 285, w: 150, h: 90 }
const SOL  = { x: 450, y: 75,  r: 58 }
const GRID = { x: 220, y: 285, r: 52 }
const BAT  = { x: 680, y: 285, r: 52 }
const HOME = { x: 450, y: 490, r: 50 }
const EV   = { x: 220, y: 525, r: 36 }
const WATR = { x: 680, y: 525, r: 36 }

// Paths (edge-to-edge between nodes and inverter box)
// Each path is written in the intended arrow-travel direction so rotate="auto" is always correct.
const PATHS = {
  solar:      `M ${SOL.x},${SOL.y + SOL.r} L ${INV.x},${INV.y - INV.h / 2}`,
  gridImport: `M ${GRID.x + GRID.r},${GRID.y} L ${INV.x - INV.w / 2},${INV.y}`,
  gridExport: `M ${INV.x - INV.w / 2},${INV.y} L ${GRID.x + GRID.r},${GRID.y}`,
  batCharge:  `M ${INV.x + INV.w / 2},${INV.y} L ${BAT.x - BAT.r},${BAT.y}`,
  batDischarge:`M ${BAT.x - BAT.r},${BAT.y} L ${INV.x + INV.w / 2},${INV.y}`,
  home:       `M ${INV.x},${INV.y + INV.h / 2} L ${HOME.x},${HOME.y - HOME.r}`,
  ev:         `M ${HOME.x - 28},${HOME.y + HOME.r - 8} Q ${HOME.x - 80},${HOME.y + HOME.r + 20} ${EV.x + EV.r},${EV.y}`,
  water:      `M ${HOME.x + 28},${HOME.y + HOME.r - 8} Q ${HOME.x + 80},${HOME.y + HOME.r + 20} ${WATR.x - WATR.r},${WATR.y}`,
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
  const W = 88, H = 82
  const x0 = cx - W / 2, y0 = cy - H / 2
  const active = watts > 5
  const c = active ? theme.colors.solar.DEFAULT : theme.colors.text.muted

  return (
    <g>
      {/* Card */}
      <rect x={x0} y={y0} width={W} height={H} rx={10}
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

function SolarNode({ cx, cy, r, watts, str1, str2, v1, i1, v2, i2 }:
  { cx: number; cy: number; r: number; watts: number
    str1: number; str2: number; v1: number; i1: number; v2: number; i2: number }) {
  const s1cx = cx - 130, s2cx = cx + 130
  const halfW = 44   // half of StringNode rect width (88/2)
  return (
    <g>
      {/* Animated connector: string panel → main sun (both written panel→sun direction) */}
      <AnimatedPath
        d={`M ${s1cx + halfW},${cy} L ${cx - r},${cy}`}
        color={theme.colors.solar.DEFAULT} watts={str1} width={2} arrows={2} small
      />
      <AnimatedPath
        d={`M ${s2cx - halfW},${cy} L ${cx + r},${cy}`}
        color={theme.colors.solar.DEFAULT} watts={str2} width={2} arrows={2} small
      />

      {/* String sub-nodes */}
      <StringNode cx={s1cx} cy={cy} label="String 1" watts={str1} volts={v1} amps={i1} />
      <StringNode cx={s2cx} cy={cy} label="String 2" watts={str2} volts={v2} amps={i2} />

      {/* Main sun circle */}
      <circle cx={cx} cy={cy} r={r} fill={theme.colors.solar.dim} stroke={theme.colors.solar.DEFAULT} strokeWidth={1.5} />
      <circle cx={cx} cy={cy - 6} r={14} fill={theme.colors.solar.DEFAULT} fillOpacity={0.9} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
        const rad = (deg * Math.PI) / 180
        return (
          <line key={deg}
            x1={cx + Math.cos(rad) * 17} y1={cy - 6 + Math.sin(rad) * 17}
            x2={cx + Math.cos(rad) * 22} y2={cy - 6 + Math.sin(rad) * 22}
            stroke={theme.colors.solar.DEFAULT} strokeWidth={2} strokeLinecap="round" />
        )
      })}
      {/* Total watts — lowered below sun rays */}
      <text x={cx} y={cy + 28} textAnchor="middle" fill={theme.colors.solar.DEFAULT} fontSize={13} fontWeight="700">{fmt(watts)}</text>
      <text x={cx} y={cy + r + 16} textAnchor="middle" fill={theme.colors.text.primary} fontSize={12} fontWeight="600">Solar</text>
    </g>
  )
}

function GridNode({ cx, cy, r, watts }: { cx: number; cy: number; r: number; watts: number }) {
  const importing = watts > 5
  const exporting = watts < -5
  const color = importing ? theme.colors.warning : exporting ? theme.colors.accent.DEFAULT : theme.colors.text.muted
  const gc = theme.colors.grid.DEFAULT
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`${gc}18`} stroke={gc} strokeWidth={1.5} />

      {/* ── Transmission tower ── */}
      {/* Vertical spine */}
      <line x1={cx} y1={cy-22} x2={cx} y2={cy+12} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      {/* Top peak (inverted V) */}
      <line x1={cx} y1={cy-22} x2={cx-5} y2={cy-16} stroke={gc} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={cx} y1={cy-22} x2={cx+5} y2={cy-16} stroke={gc} strokeWidth={1.5} strokeLinecap="round" />
      {/* Upper cross-arm */}
      <line x1={cx-13} y1={cy-13} x2={cx+13} y2={cy-13} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      {/* Lower cross-arm (wider) */}
      <line x1={cx-17} y1={cy-1} x2={cx+17} y2={cy-1} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      {/* X-bracing between arms */}
      <line x1={cx-11} y1={cy-13} x2={cx+11} y2={cy-1} stroke={gc} strokeWidth={0.8} strokeLinecap="round" strokeOpacity={0.45} />
      <line x1={cx+11} y1={cy-13} x2={cx-11} y2={cy-1} stroke={gc} strokeWidth={0.8} strokeLinecap="round" strokeOpacity={0.45} />
      {/* Catenary suspension wires: upper arm → lower arm */}
      <path d={`M ${cx-13},${cy-13} Q ${cx-13},${cy-7} ${cx-17},${cy-1}`} fill="none" stroke={gc} strokeWidth={0.9} strokeOpacity={0.55} />
      <path d={`M ${cx+13},${cy-13} Q ${cx+13},${cy-7} ${cx+17},${cy-1}`} fill="none" stroke={gc} strokeWidth={0.9} strokeOpacity={0.55} />
      {/* A-frame base */}
      <line x1={cx} y1={cy+12} x2={cx-10} y2={cy+21} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      <line x1={cx} y1={cy+12} x2={cx+10} y2={cy+21} stroke={gc} strokeWidth={2} strokeLinecap="round" />
      <line x1={cx-10} y1={cy+21} x2={cx+10} y2={cy+21} stroke={gc} strokeWidth={1.5} strokeLinecap="round" />

      {/* Watt value */}
      <text x={cx} y={cy + 36} textAnchor="middle" fill={color} fontSize={11} fontWeight="700">
        {importing ? `↓ ${fmt(watts)}` : exporting ? `↑ ${fmt(Math.abs(watts))}` : '— 0 W'}
      </text>
      <text x={cx} y={cy + r + 16} textAnchor="middle" fill={theme.colors.text.primary} fontSize={12} fontWeight="600">Grid</text>
    </g>
  )
}

function BatteryNode({ cx, cy, r, watts, soc }: { cx: number; cy: number; r: number; watts: number; soc: number }) {
  const charging    = watts < -5
  const discharging = watts > 5
  const socColor = soc > 50 ? theme.colors.battery.DEFAULT : soc > 30 ? theme.colors.warning : theme.colors.danger
  const barH = 28, barW = 18
  const fillH = (soc / 100) * barH
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`${theme.colors.battery.DEFAULT}15`} stroke={theme.colors.battery.DEFAULT} strokeWidth={1.5} />
      {/* Battery body — centred (spans cy-16 to cy+12) */}
      <rect x={cx - barW / 2} y={cy - barH / 2 - 2} width={barW} height={barH} rx={3}
        fill="none" stroke={theme.colors.battery.DEFAULT} strokeWidth={1.5} />
      <rect x={cx - 4} y={cy - barH / 2 - 6} width={8} height={4} rx={1}
        fill={theme.colors.battery.DEFAULT} />
      <rect x={cx - barW / 2 + 2} y={cy - barH / 2 - 2 + (barH - fillH)} width={barW - 4} height={fillH}
        rx={2} fill={socColor} fillOpacity={0.8} />
      {/* SOC % — lowered */}
      <text x={cx} y={cy + 30} textAnchor="middle" fill={socColor} fontSize={13} fontWeight="700">{soc}%</text>
      {(charging || discharging) && (
        <text x={cx} y={cy + 43} textAnchor="middle" fill={theme.colors.battery.DEFAULT} fontSize={10}>
          {charging ? `⬆ ${fmt(Math.abs(watts))}` : `⬇ ${fmt(watts)}`}
        </text>
      )}
      <text x={cx} y={cy + r + 16} textAnchor="middle" fill={theme.colors.text.primary} fontSize={12} fontWeight="600">Battery</text>
    </g>
  )
}

function HomeNode({ cx, cy, r, watts }: { cx: number; cy: number; r: number; watts: number }) {
  const load = Math.max(0, watts)
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="rgba(241,245,249,0.08)" stroke="#f1f5f9" strokeWidth={1.8} />
      {/* House — centred (chimney top cy-28, door bottom cy+14) */}
      <rect x={cx + 7} y={cy - 28} width={5} height={10} fill="rgba(241,245,249,0.20)" stroke="#f1f5f9" strokeWidth={1} />
      <polygon points={`${cx},${cy - 22} ${cx - 20},${cy - 4} ${cx + 20},${cy - 4}`}
        fill="rgba(241,245,249,0.20)" stroke="#f1f5f9" strokeWidth={1.5} strokeLinejoin="round" />
      <rect x={cx - 14} y={cy - 4} width={28} height={18} fill="rgba(241,245,249,0.12)" stroke="#f1f5f9" strokeWidth={1.5} />
      <rect x={cx - 5} y={cy + 6} width={10} height={8} rx={1.5} fill="rgba(241,245,249,0.30)" />
      {/* Load — lowered */}
      <text x={cx} y={cy + 43} textAnchor="middle" fill="#f1f5f9" fontSize={13} fontWeight="700">{fmt(load)}</text>
      <text x={cx} y={cy + r + 16} textAnchor="middle" fill={theme.colors.text.primary} fontSize={12} fontWeight="600">Home</text>
    </g>
  )
}

function EvNode({ cx, cy, r, status, energy, cable }: { cx: number; cy: number; r: number; status: string; energy: number; cable: boolean }) {
  const charging = status.toLowerCase().includes('charg')
  const connected = cable
  const color = charging ? theme.colors.ev.DEFAULT : connected ? theme.colors.text.secondary : theme.colors.text.muted
  const evLabel = charging
    ? `Charging · ${energy.toFixed(1)} kWh`
    : connected ? 'Connected · Idle' : 'Not Connected'
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`${theme.colors.ev.DEFAULT}15`} stroke={color} strokeWidth={1.5} strokeDasharray={charging || connected ? 'none' : '4 3'} />
      {/* Car body — centred */}
      <path d={`M ${cx - 14},${cy + 4} Q ${cx - 14},${cy - 4} ${cx - 8},${cy - 8} L ${cx + 8},${cy - 8} Q ${cx + 14},${cy - 4} ${cx + 14},${cy + 4} Z`}
        fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={cx - 8} cy={cy + 4} r={4} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={cx + 8} cy={cy + 4} r={4} fill="none" stroke={color} strokeWidth={1.5} />
      <text x={cx + 2} y={cy - 1} textAnchor="middle" dominantBaseline="middle" fill={theme.colors.ev.DEFAULT} fontSize={9} fontWeight="700">⚡</text>
      <text x={cx} y={cy + r + 14} textAnchor="middle" fill={theme.colors.text.primary} fontSize={10} fontWeight="600">EV</text>
      <text x={cx} y={cy + r + 26} textAnchor="middle" fill={color} fontSize={9}>{evLabel}</text>
    </g>
  )
}

function WaterNode({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={theme.colors.heat.dim} stroke={theme.colors.text.muted} strokeWidth={1.2} strokeDasharray="4 3" />
      {/* Water drop — centred */}
      <path
        d={`M ${cx},${cy - 14} C ${cx - 10},${cy - 4} ${cx - 12},${cy + 4} ${cx - 8},${cy + 10} C ${cx - 4},${cy + 16} ${cx + 4},${cy + 16} ${cx + 8},${cy + 10} C ${cx + 12},${cy + 4} ${cx + 10},${cy - 4} ${cx},${cy - 14} Z`}
        fill={`${theme.colors.ev.DEFAULT}25`} stroke={theme.colors.ev.DEFAULT} strokeWidth={1.2} />
      {/* Heat waves */}
      {[-6, 0, 6].map((ox, i) => (
        <path key={i}
          d={`M ${cx + ox},${cy - 18} Q ${cx + ox + 3},${cy - 22} ${cx + ox},${cy - 26}`}
          fill="none" stroke={theme.colors.heat.DEFAULT} strokeWidth={1.2} strokeLinecap="round" strokeOpacity={0.8} />
      ))}
      <text x={cx} y={cy + r + 14} textAnchor="middle" fill={theme.colors.text.muted} fontSize={10} fontWeight="600">Diverter</text>
      <text x={cx} y={cy + r + 26} textAnchor="middle" fill={theme.colors.text.muted} fontSize={9}>Coming soon</text>
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

export function PowerFlow() {
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
  const evStatus       = getState(E.evStatus)
  const evEnergy       = getNum(E.evEnergy)
  const evCable        = getState(E.evCable) === '1' || getState(E.evCable) === 'on'
  const todayGen       = getNum(E.str1EnergyToday) + getNum(E.str2EnergyToday)
  const gridExportToday = getNum(E.gridExportToday)
  const selfUseToday   = getNum(E.selfUseToday)

  // Home consumption = solar + grid import + battery discharge
  const gridImport   = Math.max(0,  gridNet)
  const gridExport   = Math.max(0, -gridNet)
  const batCharge    = Math.max(0, -batNet)
  const batDischarge = Math.max(0,  batNet)
  const homeWatts    = Math.round(solar + gridImport + batDischarge - batCharge - gridExport)

  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const connected = status === 'connected'

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-full" style={{ maxHeight: '100%' }} xmlns="http://www.w3.org/2000/svg">
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
        <AnimatedPath d={PATHS.ev}                                                 color={theme.colors.ev.DEFAULT}      watts={evCable ? 100 : 0} />
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
        />
        <GridNode    cx={GRID.x} cy={GRID.y} r={GRID.r} watts={gridNet} />
        <InverterBox x={INV.x}  y={INV.y}  w={INV.w}  h={INV.h}  temp={invTemp} status={invStatus} />
        <BatteryNode cx={BAT.x} cy={BAT.y}  r={BAT.r}  watts={batNet}  soc={batSoc} />
        <HomeNode    cx={HOME.x} cy={HOME.y} r={HOME.r} watts={homeWatts} />
        <EvNode      cx={EV.x}  cy={EV.y}   r={EV.r}   status={evStatus} energy={evEnergy} cable={evCable} />
        <WaterNode   cx={WATR.x} cy={WATR.y} r={WATR.r} />

        {/* ── Today's stats — left of String 1 ── */}
        <g>
          <text x={14} y={36} fill={theme.colors.text.muted} fontSize={8} letterSpacing="0.08em">GENERATED</text>
          <text x={14} y={50} fill={theme.colors.solar.DEFAULT} fontSize={13} fontWeight="700">
            {todayGen > 0 ? `${todayGen.toFixed(1)} kWh` : '—'}
          </text>
          <text x={14} y={70} fill={theme.colors.text.muted} fontSize={8} letterSpacing="0.08em">EXPORTED</text>
          <text x={14} y={84} fill={theme.colors.grid.DEFAULT} fontSize={13} fontWeight="700">
            {gridExportToday > 0 ? `${gridExportToday.toFixed(1)} kWh` : '—'}
          </text>
          <text x={14} y={104} fill={theme.colors.text.muted} fontSize={8} letterSpacing="0.08em">SELF-USED</text>
          <text x={14} y={118} fill={theme.colors.accent.DEFAULT} fontSize={13} fontWeight="700">
            {selfUseToday > 0 ? `${selfUseToday.toFixed(1)} kWh` : '—'}
          </text>
        </g>

        {/* ── Date + live — right of String 2 ── */}
        <g textAnchor="end">
          <text x={886} y={50} fill={theme.colors.text.muted} fontSize={10} letterSpacing="0.04em">{dateStr}</text>
          <circle cx={868} cy={72} r={3.5} fill={connected ? theme.colors.accent.DEFAULT : theme.colors.danger}>
            {connected && <animate attributeName="opacity" values="1;0.35;1" dur="1.5s" repeatCount="indefinite" />}
          </circle>
          <text x={886} y={76} fill={connected ? theme.colors.accent.DEFAULT : theme.colors.danger} fontSize={10} fontWeight="600">
            {connected ? 'Live' : status}
          </text>
        </g>
      </svg>
    </div>
  )
}
