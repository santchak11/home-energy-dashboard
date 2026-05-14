import { type Period, getTimeRange } from '../../hooks/useInfluxDB'
import { theme } from '../../theme'

const PERIODS: Period[] = ['H', 'D', 'M', 'Y']
const PERIOD_LABEL: Record<Period, string> = { H: 'Hour', D: 'Day', M: 'Month', Y: 'Year' }

interface Props {
  period: Period
  offset: number
  onPeriod: (p: Period) => void
  onOffset: (o: number) => void
}

export function TimeNav({ period, offset, onPeriod, onOffset }: Props) {
  const { label } = getTimeRange(period, offset)
  const isNow = offset === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px 12px',
      maxWidth: 600, margin: '0 auto', width: '100%' }}>
      {/* Period pills */}
      <div style={{ display: 'flex', gap: 6 }}>
        {PERIODS.map(p => {
          const active = p === period
          return (
            <button key={p} onClick={() => { onPeriod(p); onOffset(0) }} style={{
              flex: 1, padding: '6px 0', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: active ? 700 : 400,
              background: active ? theme.colors.accent.DEFAULT : `${theme.colors.accent.DEFAULT}18`,
              color: active ? '#080e1a' : theme.colors.text.secondary,
              transition: 'all 0.15s',
            }}>
              {PERIOD_LABEL[p]}
            </button>
          )
        })}
      </div>

      {/* Left / label / right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => onOffset(offset - 1)} style={navBtn}>‹</button>

        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600,
          color: theme.colors.text.primary, letterSpacing: '0.02em' }}>
          {label}
        </div>

        <button
          onClick={() => onOffset(Math.min(offset + 1, 0))}
          disabled={isNow}
          style={{ ...navBtn, opacity: isNow ? 0.3 : 1, cursor: isNow ? 'default' : 'pointer' }}
        >›</button>

        {!isNow && (
          <button onClick={() => onOffset(0)} style={{
            ...navBtn, fontSize: 10, padding: '4px 8px', borderRadius: 12,
            background: `${theme.colors.accent.DEFAULT}25`,
            color: theme.colors.accent.DEFAULT,
          }}>Now</button>
        )}
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: `${theme.colors.accent.DEFAULT}20`,
  color: theme.colors.accent.DEFAULT,
  fontSize: 18, fontWeight: 700, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}
