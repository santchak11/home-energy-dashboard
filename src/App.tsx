import { useState } from 'react'
import { PowerFlow } from './components/powerflow/PowerFlow'
import { AnalyticsView } from './components/analytics/AnalyticsView'
import { theme } from './theme'

type Tab = 'Power Flow' | 'Analytics'

export default function App() {
  const [tab, setTab] = useState<Tab>('Power Flow')

  return (
    <div
      className="bg-hero"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        className="glass-subtle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: `1px solid ${theme.colors.border.subtle}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="13" fill="none" stroke={theme.colors.accent.DEFAULT} strokeWidth="1.5" />
            <path d="M 14,5 L 14,10 M 14,18 L 14,23 M 5,14 L 10,14 M 18,14 L 23,14 M 7.8,7.8 L 11.2,11.2 M 16.8,16.8 L 20.2,20.2 M 20.2,7.8 L 16.8,11.2 M 11.2,16.8 L 7.8,20.2"
              stroke={theme.colors.solar.DEFAULT} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="14" cy="14" r="3.5" fill={theme.colors.accent.DEFAULT} />
          </svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.colors.text.primary, letterSpacing: '0.04em' }}>
              HOME ENERGY
            </div>
            <div style={{ fontSize: 10, color: theme.colors.accent.DEFAULT, letterSpacing: '0.12em', fontWeight: 600 }}>
              LIVE DASHBOARD
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {(['Power Flow', 'Analytics'] as Tab[]).map(t => (
            <NavItem key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
          ))}
          <NavItem label="History" />
          <NavItem label="Settings" />
        </div>

        <div />
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {tab === 'Power Flow' && (
          <div style={{ flex: 1, borderRadius: 16, padding: 16, position: 'relative', minHeight: 460 }}>
            <PowerFlow />
          </div>
        )}
        {tab === 'Analytics' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <AnalyticsView />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ padding: '8px 24px', display: 'flex', gap: 24, justifyContent: 'center', flexShrink: 0 }}>
        <StatusPill label="Growatt SPH6000" color={theme.colors.accent.DEFAULT} />
        <StatusPill label="Modbus Local"    color={theme.colors.solar.DEFAULT} />
        <StatusPill label="~1Hz refresh"    color={theme.colors.grid.DEFAULT} />
      </footer>
    </div>
  )
}

function NavItem({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default',
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? theme.colors.accent.DEFAULT : theme.colors.text.secondary,
        padding: '4px 0',
        borderBottom: active ? `2px solid ${theme.colors.accent.DEFAULT}` : '2px solid transparent',
        transition: 'color 0.2s',
        opacity: onClick ? 1 : 0.4,
      }}
    >{label}</button>
  )
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: theme.colors.text.muted }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </div>
  )
}
