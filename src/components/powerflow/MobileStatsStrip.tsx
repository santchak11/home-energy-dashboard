import { useHAWebSocket } from '../../hooks/useHAWebSocket'
import { theme } from '../../theme'

const E = {
  solarTotal:      'sensor.solar_power_total',
  gridNet:         'sensor.grid_net_power',
  batteryNet:      'sensor.battery_net_power',
  batterySoc:      'sensor.santanu_s_growatt_inverter_soc',
  str1EnergyToday: 'sensor.santanu_s_growatt_inverter_input_1_energy_today',
  str2EnergyToday: 'sensor.santanu_s_growatt_inverter_input_2_energy_today',
  selfUseToday:    'sensor.santanu_s_growatt_inverter_energy_to_user_today',
}

function fmt(w: number) {
  return Math.abs(w) >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  color: string
  icon: React.ReactNode
}

function StatCard({ label, value, sub, color, icon }: StatCardProps) {
  return (
    <div style={{
      flex: 1, borderRadius: 12, padding: '10px 12px',
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}30`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color, opacity: 0.85 }}>{icon}</span>
        <span style={{ fontSize: 10, color: theme.colors.text.muted, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: theme.colors.text.muted }}>{sub}</div>}
    </div>
  )
}

export function MobileStatsStrip() {
  const { getNum } = useHAWebSocket()

  const solar    = getNum(E.solarTotal)
  const gridNet  = getNum(E.gridNet)
  const batNet   = getNum(E.batteryNet)
  const batSoc   = getNum(E.batterySoc)
  const todayGen = getNum(E.str1EnergyToday) + getNum(E.str2EnergyToday)
  const selfUse  = getNum(E.selfUseToday)

  const gridImport   = Math.max(0,  gridNet)
  const gridExport   = Math.max(0, -gridNet)
  const batCharge    = Math.max(0, -batNet)
  const batDischarge = Math.max(0,  batNet)
  const homeWatts    = Math.max(0, Math.round(solar + gridImport + batDischarge - batCharge - gridExport))

  const socColor = batSoc > 50 ? theme.colors.battery.DEFAULT : batSoc > 30 ? theme.colors.warning : theme.colors.danger
  const gridColor = gridNet > 5 ? theme.colors.warning : gridNet < -5 ? theme.colors.accent.DEFAULT : theme.colors.text.muted
  const gridSub   = gridNet > 5 ? `↓ Importing` : gridNet < -5 ? '↑ Exporting' : 'No flow'
  const batSub    = batNet < -5 ? `↑ Charging ${fmt(Math.abs(batNet))}` : batNet > 5 ? `↓ Discharging ${fmt(batNet)}` : 'Idle'
  const selfPct   = todayGen > 0 ? Math.round((selfUse / todayGen) * 100) : 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 4px 4px' }}>
      {/* Today summary bar */}
      <div style={{
        borderRadius: 12, padding: '8px 14px',
        background: `${theme.colors.solar.DEFAULT}12`,
        border: `1px solid ${theme.colors.solar.DEFAULT}30`,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.colors.text.muted }}>Today</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.colors.solar.DEFAULT }}>{todayGen.toFixed(1)} kWh</div>
        </div>
        <div style={{ width: 1, height: 32, background: theme.colors.border.subtle }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.colors.text.muted }}>Self-use</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.colors.accent.DEFAULT }}>{selfPct}%</div>
        </div>
        <div style={{ width: 1, height: 32, background: theme.colors.border.subtle }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.colors.text.muted }}>Battery</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: socColor }}>{batSoc}%</div>
        </div>
      </div>

      {/* 2×2 live cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard
          label="Solar" value={fmt(solar)}
          color={theme.colors.solar.DEFAULT}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>}
        />
        <StatCard
          label="Home" value={fmt(homeWatts)}
          color={theme.colors.text.primary}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/></svg>}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard
          label="Grid" value={fmt(Math.abs(gridNet))}
          sub={gridSub} color={gridColor}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="5" y1="9" x2="19" y2="9"/><line x1="3" y1="14" x2="21" y2="14"/></svg>}
        />
        <StatCard
          label="Battery" value={`${batSoc}%`}
          sub={batSub} color={socColor}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="18" height="10" rx="2"/><line x1="20" y1="11" x2="22" y2="11"/><line x1="20" y1="13" x2="22" y2="13"/></svg>}
        />
      </div>
    </div>
  )
}
