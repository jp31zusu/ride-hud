/**
 * Parsers for the standard Bluetooth SIG GATT characteristics used by smart
 * trainers and heart rate broadcasters. All multi-byte fields are little-endian.
 */

export const SERVICE = {
  heartRate: 0x180d,
  cyclingPower: 0x1818,
  fitnessMachine: 0x1826,
  deviceInformation: 0x180a
} as const

export const CHARACTERISTIC = {
  heartRateMeasurement: 0x2a37,
  cyclingPowerMeasurement: 0x2a63,
  indoorBikeData: 0x2ad2
} as const

export interface HeartRateReading {
  bpm: number
  contactDetected?: boolean
}

/** Heart Rate Measurement (0x2A37). */
export function parseHeartRate(view: DataView): HeartRateReading {
  const flags = view.getUint8(0)
  const is16Bit = (flags & 0x01) !== 0
  const contactSupported = (flags & 0x04) !== 0
  const bpm = is16Bit ? view.getUint16(1, true) : view.getUint8(1)
  return {
    bpm,
    contactDetected: contactSupported ? (flags & 0x02) !== 0 : undefined
  }
}

export interface CyclingPowerReading {
  watts: number
  crank?: { revolutions: number; lastEventTime: number }
}

/** Cycling Power Measurement (0x2A63). */
export function parseCyclingPower(view: DataView): CyclingPowerReading {
  const flags = view.getUint16(0, true)
  const watts = view.getInt16(2, true)
  let offset = 4

  if (flags & 0x0001) offset += 1 // pedal power balance
  if (flags & 0x0004) offset += 2 // accumulated torque
  if (flags & 0x0010) offset += 6 // wheel revolutions (uint32) + last wheel event (uint16)

  let crank: CyclingPowerReading['crank']
  if (flags & 0x0020 && view.byteLength >= offset + 4) {
    crank = {
      revolutions: view.getUint16(offset, true),
      lastEventTime: view.getUint16(offset + 2, true)
    }
  }
  return { watts, crank }
}

export interface IndoorBikeReading {
  speedKmh?: number
  cadenceRpm?: number
  watts?: number
  heartRate?: number
}

/** FTMS Indoor Bike Data (0x2AD2). */
export function parseIndoorBikeData(view: DataView): IndoorBikeReading {
  const flags = view.getUint16(0, true)
  let offset = 2
  const out: IndoorBikeReading = {}
  const has = (bit: number): boolean => (flags & (1 << bit)) !== 0

  // Bit 0 is "More Data": instantaneous speed is present when it is 0.
  if (!has(0)) {
    out.speedKmh = view.getUint16(offset, true) / 100
    offset += 2
  }
  if (has(1)) offset += 2 // average speed
  if (has(2)) {
    out.cadenceRpm = view.getUint16(offset, true) / 2
    offset += 2
  }
  if (has(3)) offset += 2 // average cadence
  if (has(4)) offset += 3 // total distance
  if (has(5)) offset += 2 // resistance level
  if (has(6)) {
    out.watts = view.getInt16(offset, true)
    offset += 2
  }
  if (has(7)) offset += 2 // average power
  if (has(8)) offset += 5 // total energy, energy/hour, energy/minute
  if (has(9)) out.heartRate = view.getUint8(offset)
  return out
}

/**
 * Derives cadence from cumulative crank revolutions and the crank event
 * timestamp (1/1024 s resolution), handling 16-bit rollover of both.
 */
export class CrankCadenceCalculator {
  private last?: { revolutions: number; lastEventTime: number }
  private lastChangeAt = 0
  private rpm = 0

  constructor(private readonly idleTimeoutMs = 3000) {}

  update(crank: { revolutions: number; lastEventTime: number }, now: number): number {
    const prev = this.last
    this.last = crank
    if (!prev) {
      this.lastChangeAt = now
      return this.rpm
    }

    const revs = (crank.revolutions - prev.revolutions + 0x10000) % 0x10000
    const ticks = (crank.lastEventTime - prev.lastEventTime + 0x10000) % 0x10000

    if (revs > 0 && ticks > 0) {
      const rpm = (revs * 1024 * 60) / ticks
      if (rpm < 250) this.rpm = rpm
      this.lastChangeAt = now
    } else if (now - this.lastChangeAt > this.idleTimeoutMs) {
      this.rpm = 0
    }
    return this.rpm
  }

  reset(): void {
    this.last = undefined
    this.rpm = 0
  }
}
