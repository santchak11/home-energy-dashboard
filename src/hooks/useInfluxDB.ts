import { useState, useEffect } from 'react'

export type Period = 'H' | 'D' | 'M' | 'Y'

export interface DataPoint {
  time: number   // ms epoch
  value: number
}

interface TimeRange {
  from: string   // InfluxDB time literal e.g. "1234567890000ms"
  to: string
  interval: string
  label: string  // human-readable period label
  labelShort: string
}

export function getTimeRange(period: Period, offset: number): TimeRange {
  const now = new Date()

  if (period === 'H') {
    // offset 0 = current hour, -1 = previous hour, etc.
    // current window is [now-1h, now]; previous is [now-2h, now-1h], etc.
    const toMs   = now.getTime() + offset * 3_600_000
    const fromMs = toMs - 3_600_000
    const from   = new Date(fromMs)
    const to     = new Date(Math.min(toMs, now.getTime()))
    return {
      from: `${fromMs}ms`, to: `${to.getTime()}ms`, interval: '10s',
      label: `${from.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–${to.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      labelShort: from.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }
  }

  if (period === 'D') {
    const d = new Date(now); d.setDate(d.getDate() + offset)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const end   = new Date(start.getTime() + 86_400_000)
    return {
      from: `${start.getTime()}ms`,
      to:   `${Math.min(end.getTime(), now.getTime())}ms`,
      interval: '5m',
      label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      labelShort: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }
  }

  if (period === 'M') {
    const d    = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const end  = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return {
      from: `${d.getTime()}ms`,
      to:   `${Math.min(end.getTime(), now.getTime())}ms`,
      interval: '1h',
      label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      labelShort: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
    }
  }

  // Y
  const d   = new Date(now.getFullYear() + offset, 0, 1)
  const end = new Date(d.getFullYear() + 1, 0, 1)
  return {
    from: `${d.getTime()}ms`,
    to:   `${Math.min(end.getTime(), now.getTime())}ms`,
    interval: '1d',
    label: `${d.getFullYear()}`,
    labelShort: `${d.getFullYear()}`,
  }
}

const INFLUX = import.meta.env.VITE_INFLUXDB_URL ?? `http://${window.location.hostname}:8086`

export async function influxQuery(
  measurement: string,
  entityId: string,
  from: string,
  to: string,
  interval: string,
  fn = 'mean',
): Promise<DataPoint[]> {
  const q = `SELECT ${fn}(value) as v FROM "${measurement}" WHERE "entity_id"='${entityId}' AND time >= ${from} AND time <= ${to} GROUP BY time(${interval}) fill(none)`
  const url = `${INFLUX}/query?db=homeassistant&q=${encodeURIComponent(q)}`
  const res  = await fetch(url)
  const json = await res.json()
  const vals = json?.results?.[0]?.series?.[0]?.values ?? []
  return vals
    .filter(([, v]: [string, number | null]) => v !== null)
    .map(([t, v]: [string, number]) => ({ time: new Date(t).getTime(), value: Math.round(v * 100) / 100 }))
}

/** Single-entity time-series query, re-fetches when period/offset changes */
export function useInfluxSeries(
  measurement: string,
  entityId: string,
  period: Period,
  offset: number,
  fn = 'mean',
) {
  const [data, setData]       = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    const { from, to, interval } = getTimeRange(period, offset)
    influxQuery(measurement, entityId, from, to, interval, fn)
      .then(d  => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [measurement, entityId, period, offset, fn])

  return { data, loading, error }
}

/** Multi-entity query for the same measurement + period (e.g. String 1 + String 2 together) */
export function useInfluxMulti(
  measurement: string,
  entities: string[],
  period: Period,
  offset: number,
) {
  const [series, setSeries]   = useState<Record<string, DataPoint[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const { from, to, interval } = getTimeRange(period, offset)
    Promise.all(
      entities.map(id =>
        influxQuery(measurement, id, from, to, interval)
          .then(d => [id, d] as [string, DataPoint[]])
          .catch(() => [id, []] as [string, DataPoint[]])
      )
    ).then(results => {
      if (!cancelled) { setSeries(Object.fromEntries(results)); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [measurement, entities.join(','), period, offset])   // eslint-disable-line

  return { series, loading }
}
