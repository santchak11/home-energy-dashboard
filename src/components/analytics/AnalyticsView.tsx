import { theme } from '../../theme'

const GRAFANA = `http://${window.location.hostname}:3000`
const UID = 'home-energy-v1'

const PANELS = [
  { id: 1, title: 'Solar Generation',        color: theme.colors.solar.DEFAULT },
  { id: 2, title: 'Grid Flow',               color: theme.colors.grid.DEFAULT },
  { id: 3, title: 'Battery – SOC & Power',   color: theme.colors.battery.DEFAULT },
  { id: 4, title: "Today's Energy",          color: theme.colors.accent.DEFAULT },
]

function panelUrl(panelId: number, range = 'now-24h') {
  return `${GRAFANA}/d-solo/${UID}/home-energy?orgId=1&panelId=${panelId}&theme=dark&from=${range}&to=now&refresh=30s`
}

export function AnalyticsView({ range = 'now-24h' }: { range?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Time-range strip */}
      <RangeBar />

      {/* 2×2 panel grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: 12,
        minHeight: 0,
      }}>
        {PANELS.map(p => (
          <PanelCard key={p.id} title={p.title} color={p.color} src={panelUrl(p.id, range)} />
        ))}
      </div>
    </div>
  )
}

function PanelCard({ title, color, src }: { title: string; color: string; src: string }) {
  return (
    <div
      className="glass"
      style={{ borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 220 }}
    >
      {/* Thin colour accent bar */}
      <div style={{ height: 2, background: color, flexShrink: 0 }} />
      <iframe
        src={src}
        title={title}
        style={{ flex: 1, border: 'none', width: '100%', minHeight: 220 }}
        loading="lazy"
      />
    </div>
  )
}

const RANGES = [
  { label: '3 h',   value: 'now-3h' },
  { label: '24 h',  value: 'now-24h' },
  { label: '7 d',   value: 'now-7d' },
  { label: '30 d',  value: 'now-30d' },
]

function RangeBar() {
  // Controlled externally via the parent — for now just shows links to the full dashboard
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <span style={{ fontSize: 12, color: theme.colors.text.muted }}>
        Powered by Grafana · <a href={`${GRAFANA}/d/${UID}`} target="_blank" rel="noreferrer"
          style={{ color: theme.colors.accent.DEFAULT, textDecoration: 'none' }}>Open full dashboard ↗</a>
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        {RANGES.map(r => (
          <a key={r.value}
            href={`${GRAFANA}/d/${UID}/home-energy?from=${r.value}&to=now&theme=dark`}
            target="_blank" rel="noreferrer"
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20,
              background: `${theme.colors.accent.DEFAULT}15`,
              border: `1px solid ${theme.colors.accent.DEFAULT}30`,
              color: theme.colors.text.secondary, textDecoration: 'none',
            }}
          >{r.label}</a>
        ))}
      </div>
    </div>
  )
}
