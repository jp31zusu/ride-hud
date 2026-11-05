/** A reading older than this is shown as missing. */
export const STALE_MS = 5000

/** Text color classes for Coggan power zones, keyed by fraction of FTP. */
export function powerZoneColor(watts: number, ftp: number): string {
  const pct = watts / ftp
  if (pct < 0.55) return 'text-zinc-300'
  if (pct < 0.75) return 'text-sky-400'
  if (pct < 0.9) return 'text-emerald-400'
  if (pct < 1.05) return 'text-yellow-300'
  if (pct < 1.2) return 'text-orange-400'
  return 'text-rose-500'
}

/** Text color classes for 5-zone heart rate model, keyed by fraction of max HR. */
export function heartRateZoneColor(bpm: number, maxHr: number): string {
  const pct = bpm / maxHr
  if (pct < 0.6) return 'text-zinc-300'
  if (pct < 0.7) return 'text-sky-400'
  if (pct < 0.8) return 'text-emerald-400'
  if (pct < 0.9) return 'text-orange-400'
  return 'text-rose-500'
}

export function averagePower(
  samples: { value: number; at: number }[],
  windowSec: number,
  now: number
): number | undefined {
  const last = samples[samples.length - 1]
  if (!last || now - last.at > STALE_MS) return undefined
  const recent = samples.filter((s) => now - s.at <= windowSec * 1000)
  if (recent.length === 0) return last.value
  return recent.reduce((sum, s) => sum + s.value, 0) / recent.length
}
