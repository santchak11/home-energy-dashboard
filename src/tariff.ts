// E.On Next Drive Fixed V11 — expires 22/10/2026
export const TARIFF = {
  dayRate:   26.53,  // p/kWh  06:00–24:00
  nightRate:  3.99,  // p/kWh  00:00–06:00
  standing:  60.00,  // p/day
  exportRate: 0,     // no MCS certificate
} as const

export function rateAtHour(hour: number): number {
  return hour >= 6 ? TARIFF.dayRate : TARIFF.nightRate
}

/** Cost in pence for kWh at a given hour */
export function penceForKwh(kwh: number, hour: number): number {
  return kwh * rateAtHour(hour)
}

/** Pence saved by self-consuming solar (avoids day-rate import) */
export function savedPence(selfUsedKwh: number): number {
  return selfUsedKwh * TARIFF.dayRate
}

export function formatPounds(pence: number): string {
  if (Math.abs(pence) < 100) return `${pence.toFixed(0)}p`
  return `£${(pence / 100).toFixed(2)}`
}
