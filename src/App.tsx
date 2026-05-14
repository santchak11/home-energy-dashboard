import React, { useState, useRef } from 'react'
import { useIsMobile } from './hooks/useIsMobile'
import { PowerFlow } from './components/powerflow/PowerFlow'
import { MobileStatsStrip } from './components/powerflow/MobileStatsStrip'
import { AnalyticsView } from './components/analytics/AnalyticsView'
import { StringsView } from './components/strings/StringsView'
import { NodeDetailView, nodeLabel } from './components/detail/NodeDetailView'
import { theme } from './theme'
import type { NodeKey } from './types'

type Tab = 'Power Flow' | 'Analytics' | 'Strings' | 'Grafana'

const GRAFANA_BASE = import.meta.env.VITE_GRAFANA_URL ?? `http://${window.location.hostname}:3000`

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'Power Flow', label: 'Flow', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3.5"/>
      <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
      <line x1="4.9" y1="4.9" x2="7.1" y2="7.1"/><line x1="16.9" y1="16.9" x2="19.1" y2="19.1"/>
      <line x1="19.1" y1="4.9" x2="16.9" y2="7.1"/><line x1="7.1" y1="16.9" x2="4.9" y2="19.1"/>
    </svg>
  )},
  { id: 'Analytics', label: 'Analytics', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="18" y1="20" x2="18" y2="9"/><line x1="12" y1="20" x2="12" y2="3"/>
      <line x1="6" y1="20" x2="6" y2="13"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  )},
  { id: 'Strings', label: 'Strings', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M2 8 Q6 4 10 8 Q14 12 18 8 Q20 6 22 8"/>
      <path d="M2 16 Q6 12 10 16 Q14 20 18 16 Q20 14 22 16"/>
    </svg>
  )},
  { id: 'Grafana', label: 'Grafana', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polyline points="2,17 7,12 11,14 16,7 22,10"/>
    </svg>
  )},
]

export default function App() {
  const [tab, setTab]           = useState<Tab>('Power Flow')
  const [detailNode, setDetail] = useState<NodeKey | null>(null)
  const isMobile = useIsMobile()
  const lastTapRef = useRef(0)

  function handleLogoTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 400) window.location.reload()
    lastTapRef.current = now
  }

  const logoArea = (
    <div
      onClick={handleLogoTap}
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'default', userSelect: 'none' }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="13" fill="none" stroke={theme.colors.accent.DEFAULT} strokeWidth="1.5" />
        <path d="M 14,5 L 14,10 M 14,18 L 14,23 M 5,14 L 10,14 M 18,14 L 23,14 M 7.8,7.8 L 11.2,11.2 M 16.8,16.8 L 20.2,20.2 M 20.2,7.8 L 16.8,11.2 M 11.2,16.8 L 7.8,20.2"
          stroke={theme.colors.solar.DEFAULT} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="14" cy="14" r="3.5" fill={theme.colors.accent.DEFAULT} />
      </svg>
      <div>
        <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: theme.colors.text.primary, letterSpacing: '0.04em' }}>
          HOME ENERGY
        </div>
        <div style={{ fontSize: 9, color: theme.colors.accent.DEFAULT, letterSpacing: '0.12em', fontWeight: 600 }}>
          LIVE DASHBOARD
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-hero" style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header className="glass-subtle" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '8px 16px' : '12px 24px',
        borderBottom: `1px solid ${theme.colors.border.subtle}`,
        flexShrink: 0,
      }}>
        {logoArea}

        {/* Desktop tabs — hidden on mobile */}
        {!isMobile && !detailNode && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {TABS.map(t => (
              <NavItem key={t.id} label={t.id} active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
          </div>
        )}

        {/* Right side: back button in detail, mobile icon tabs otherwise, desktop spacer */}
        {detailNode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setDetail(null)} style={{
              background: `${theme.colors.accent.DEFAULT}20`, border: `1px solid ${theme.colors.accent.DEFAULT}40`,
              borderRadius: 20, padding: '5px 14px', color: theme.colors.accent.DEFAULT,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>← Back</button>
            {!isMobile && (
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.colors.text.primary }}>
                {nodeLabel(detailNode)}
              </span>
            )}
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? `${theme.colors.accent.DEFAULT}20` : 'none',
                  border: `1px solid ${active ? theme.colors.accent.DEFAULT + '50' : 'transparent'}`,
                  borderRadius: 8, padding: '5px 6px', cursor: 'pointer',
                  color: active ? theme.colors.accent.DEFAULT : theme.colors.text.muted,
                  transition: 'color 0.18s',
                }}>
                  {t.icon}
                </button>
              )
            })}
          </div>
        ) : (
          <div />
        )}
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: isMobile ? '4px 4px 0' : '16px 24px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {detailNode && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <NodeDetailView node={detailNode} />
          </div>
        )}
        {!detailNode && tab === 'Power Flow' && (
          isMobile ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, justifyContent: 'space-between' }}>
              <PowerFlow onNodeClick={node => setDetail(node)} />
              <MobileStatsStrip />
            </div>
          ) : (
            <div style={{ flex: 1, borderRadius: 16, position: 'relative', padding: 16, minHeight: 460 }}>
              <PowerFlow onNodeClick={node => setDetail(node)} />
            </div>
          )
        )}
        {!detailNode && tab === 'Analytics' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <AnalyticsView />
          </div>
        )}
        {!detailNode && tab === 'Strings' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <StringsView />
          </div>
        )}
        {!detailNode && tab === 'Grafana' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <iframe
              src={`${GRAFANA_BASE}/d/home-energy-v1/home-energy?orgId=1&kiosk=tv`}
              style={{ flex: 1, width: '100%', border: 'none', borderRadius: 12, minHeight: 400 }}
              title="Grafana"
            />
          </div>
        )}
      </main>


      {/* Desktop footer */}
      {!isMobile && (
        <footer style={{ padding: '8px 24px', display: 'flex', gap: 24, justifyContent: 'center', flexShrink: 0 }}>
          <StatusPill label="Growatt SPH6000" color={theme.colors.accent.DEFAULT} />
          <StatusPill label="Modbus Local"    color={theme.colors.solar.DEFAULT} />
          <StatusPill label="~1Hz refresh"    color={theme.colors.grid.DEFAULT} />
        </footer>
      )}
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
