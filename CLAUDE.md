# Home Energy Dashboard — Project Context

**What:** Custom React PWA for real-time home solar/battery/grid monitoring on Growatt SPH6000 + Pod Point + Pi 5.  
**Why:** ShinePhone replaced with local control, ~1 Hz live updates via HA WebSocket, professional animated power flow diagram.  
**Where:** http://192.168.1.125:8080 (nginx, production build) · http://192.168.1.125:5173 (Vite dev server)  
**GitHub:** https://github.com/santchak11/home-energy-dashboard  
**Version:** v1.0.0 (tagged 14 May 2026) — production baseline. V2.0 planning in progress.  
**Status:** Live, fully functional. nginx serves `/dist` on port 8080 (PWA-capable). Android Chrome: clear site data if HTTPS redirect error.

---

## Quick Start

```bash
cd /home/santanu/home-energy-dashboard
npm run dev           # Start Vite dev server on port 5173
```

Access at `http://192.168.1.125:5173` from any device on local WiFi.

**.env required:**
```
VITE_HA_URL=http://192.168.1.125:8123
VITE_HA_TOKEN=<long-lived token from HA Developer Tools>
VITE_INFLUXDB_URL=http://192.168.1.125:8086
```

---

## Architecture

### Core Patterns

**Layout Constraint:** All scrollable views wrap content in `maxWidth: 1400, margin: 0 auto` to prevent ultra-wide stretching:
```tsx
<div style={{ overflowY: 'auto', height: '100%' }}>
  <div style={{ maxWidth: 1400, margin: '0 auto', padding: '4px 12px 20px' }}>
    {/* content */}
  </div>
</div>
```
Applied to: AnalyticsView, NodeDetailView (all 5 screens), StringsView.

**Responsive Grid:**
```tsx
gridTemplateColumns: 'repeat(auto-fill, minmax(max(280px, calc((100% - 20px) / 3)), 1fr))'
```
Auto-fits: 3 cols desktop → 2 tablet → 1 mobile.

**Custom Recharts Labels:** PieChart donut labels (% inside, names radially outside):
```tsx
const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  const RADIAN = Math.PI / 180
  const rIn = innerRadius + (outerRadius - innerRadius) * 0.55
  const rOut = outerRadius + 16
  return <g>
    <text x={cx + rIn * Math.cos(-midAngle * RADIAN)} y={...}>
      {`${(percent*100).toFixed(0)}%`}
    </text>
    <text x={cx + rOut * Math.cos(-midAngle * RADIAN)} y={...}>
      {name}
    </text>
  </g>
}
```

**SVG foreignObject for Embedded Recharts:**
PowerFlowDonut uses SVG `<foreignObject>` to embed HTML/Recharts inside the main PowerFlow SVG:
- Position: viewBox (80, 10), size 190×190
- Scales proportionally with SVG
- Avoids layout positioning complexity

### Tabs & Navigation

| Tab | Component | Purpose |
|---|---|---|
| Power Flow | PowerFlow.tsx | 7-node animated flow + mini donut breakdown |
| Analytics | AnalyticsView.tsx | Recharts charts (energy flow, donut, solar/grid/battery/EV) |
| Strings | StringsView.tsx | String 1/2 comparison + mismatch detection |
| Grafana | iframe | Home Assistant Grafana dashboard (home-energy-v1) |
| *Node details* | NodeDetailView.tsx | Click any node → 5 drill-down screens (Solar/Battery/Grid/EV/Home) |

### State Management

- **App.tsx:** Tab state (`Power Flow | Analytics | Strings | Grafana`) + `detailNode` (NodeKey | null)
- **AnalyticsView, NodeDetailView, StringsView:** Local `period` (H/D/M/Y) + `offset` (days back)
- **PowerFlow:** useEffect to update CSS custom properties (solar glow position/intensity)

### Data Sources

**Live (HA WebSocket, ~1 Hz):**
- `useHAWebSocket()` → `getNum(entityId)`, `getState(entityId)`
- Used by PowerFlow for real-time flow visualization

**Historical (InfluxDB):**
- `useInfluxSeries(unit, measurement, period, offset)` → single series over time range
- `useInfluxMulti(unit, measurements[], period, offset)` → multiple series, merged by timestamp
- Used by Analytics, Strings, NodeDetailView for time-range charts

### Key Gotchas

1. **Color tokens:** ALL color objects have `.DEFAULT` (and `.dim`). Never use `theme.colors.heat` bare — always `theme.colors.heat.DEFAULT`.

2. **InfluxDB entity name convention:** Entity ID `sensor.santanu_s_growatt_inverter_input_1_wattage` → InfluxDB measurement = unit (e.g., `W`), tag `entity_id` = `input_1_wattage` (without `sensor.` prefix).

3. **Pod Point power:** Pod Point Solo doesn't expose watts. PowerFlow estimates as `min(7360, max(0, homeWatts - 350))` when charging.

4. **SVG foreignObject scaling:** HTML content inside `<foreignObject>` doesn't inherit SVG transforms. The element's physical pixel size matches its viewBox dimensions × SVG scale factor. Use `ResponsiveContainer` width/height as % to auto-fit.

5. **Power sign convention:**
   - `gridNet`: + = import, − = export
   - `batNet`: + = discharge, − = charge

6. **MiniDonut legend position:** Previously at `cy + ri + 8`; fixed to `cy + ro + 8` to place below outer arc, not inside ring.

7. **Recharts PieChart labels:** Custom label function receives `{ cx, cy, midAngle, innerRadius, outerRadius, percent, name, index, ... }`. Return `null` to skip tiny segments (< 6%).

---

## File Structure

```
src/
├── App.tsx                              # Root: tabs, node detail nav, layout
├── main.tsx                             # React entry
├── index.css                            # Tailwind + glass/glow utilities
├── theme.ts                             # Color palette (const)
├── types.ts                             # type NodeKey = 'solar' | 'battery' | ...
├── tariff.ts                            # E.On Next Drive rates, cost helpers
├── hooks/
│   ├── useHAWebSocket.ts                # Live HA data (~1 Hz)
│   └── useInfluxDB.ts                   # Historical InfluxDB queries
├── components/
│   ├── powerflow/
│   │   ├── PowerFlow.tsx                # Main 7-node SVG + PowerFlowDonut
│   │   └── AnimatedPath.tsx             # animateMotion + arrowhead
│   ├── analytics/
│   │   └── AnalyticsView.tsx            # KPI + EnergyFlowChart + EnergyDonut + charts
│   ├── strings/
│   │   └── StringsView.tsx              # String 1/2 comparison
│   ├── detail/
│   │   └── NodeDetailView.tsx           # 5 drill-down screens
│   └── shared/
│       └── TimeNav.tsx                  # H/D/M/Y period selector
├── .env                                 # VITE_HA_URL, VITE_HA_TOKEN, VITE_INFLUXDB_URL
├── index.html
└── vite.config.ts
```

---

## Known Issues

**Android Chrome — ERR_SSL_PROTOCOL_ERROR:** Desktop works fine at `http://192.168.1.125:5173`. Android Chrome auto-redirects to HTTPS, causing error. Workaround: clear site data from Chrome settings or use incognito mode.

**todayGen discrepancy:** Currently using AC output (~4 kWh) instead of raw PV input (~7.5 kWh). Fix: switch to `input_1_energy_today` + `input_2_energy_today`.

**EV power:** Pod Point doesn't expose real-time watts — estimated only.

**Mobile layout:** String sub-nodes in PowerFlow become unreadable at 0.5× zoom. Needs dedicated mobile mode (smaller viewBox, hide strings).

---

## Common Tasks

### Adding a new chart
1. Create component in `src/components/[view]/Chart.tsx`
2. Use `useInfluxSeries()` or `useInfluxMulti()` for data
3. Wrap with ResponsiveContainer + Recharts chart (AreaChart, LineChart, etc.)
4. Add to grid in parent view
5. Test time range selector (H/D/M/Y period/offset)

### Adding a new node detail screen
1. Add case in NodeDetailView.tsx
2. Create component with own charts (follow SolarDetail/BatteryDetail pattern)
3. Each screen gets independent TimeNav (period/offset state)
4. Use responsive grid for card layout
5. Wrap all in maxWidth: 1400 (already done in NodeDetailView)

### Debugging HA WebSocket issues
- Check browser DevTools Network tab for WebSocket connection
- Verify `VITE_HA_URL` and `VITE_HA_TOKEN` in `.env`
- useHAWebSocket returns `status: 'connecting' | 'connected' | 'disconnected' | 'error'`
- Live entity ID list: check HA Developer Tools → States

### Debugging InfluxDB queries
- Verify DB running: `curl http://192.168.1.125:8086/query?q=SHOW+DATABASES`
- Check entity mapping: `curl 'http://192.168.1.125:8086/query?db=homeassistant&q=SHOW+MEASUREMENTS'`
- Verify data flow: `curl 'http://192.168.1.125:8086/query?db=homeassistant&q=SELECT+*+FROM+W+WHERE+entity_id=%27input_1_wattage%27+LIMIT+10'`

---

## Deployment

- **Production:** `npm run build` → nginx serves `dist/` on port 8080 (`/etc/nginx/sites-available/solar-dashboard`)
- **Dev:** `npm run dev` → Vite HMR on port 5173
- **After any code change:** run `npm run build` so nginx picks it up. Vite HMR only reaches port 5173.
- **HTTPS:** Not configured; would need Let's Encrypt + DuckDNS for remote access
- **Mobile PWA:** Installed via Chrome "Add to Home Screen". Clear site data to force service worker refresh after a build.

## V2.0 — Planned Improvements

- **PowerFlow rendering:** Migrate from hand-coded SVG to React Flow (HTML nodes + SVG edges). Fixes SVG text rendering quality — all labels become native HTML/CSS, pixel-perfect on high-DPI screens.
- **Settings tab:** Configurable inverter/charger/diverter bindings (entity IDs, thresholds) stored in localStorage — makes the app usable by others without code changes.
- **Access control:** Read-only vs admin view.
- **Hardware abstraction:** Support inverters beyond Growatt (SolarEdge, SMA, Sungrow) via a sensor registry layer.
- **Versioning:** Git tags per release. v1.0.0 is the baseline; v1.x = incremental sensor/stat additions; v2.0 = React Flow rewrite + settings architecture.

---

## Session Continuity

See `/home/santanu/.claude/projects/-home-santanu-docker/memory/` for persistent context:
- `dashboard_status.md` — detailed feature status & architectural patterns
- `project_solar_ha.md` — Growatt/Pod Point/Pi hardware & network setup
- `user_profile.md` — user preferences & workflow

See also `/home/santanu/docker/react_energy_dashboard.md` for detailed component documentation.
