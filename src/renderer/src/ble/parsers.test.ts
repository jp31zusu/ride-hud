import { describe, expect, it } from 'vitest'
import {
  CrankCadenceCalculator,
  parseCyclingPower,
  parseHeartRate,
  parseIndoorBikeData
} from './parsers'

const view = (...bytes: number[]): DataView => new DataView(new Uint8Array(bytes).buffer)

describe('parseHeartRate', () => {
  it('reads 8-bit values', () => {
    expect(parseHeartRate(view(0x00, 142)).bpm).toBe(142)
  })

  it('reads 16-bit values', () => {
    expect(parseHeartRate(view(0x01, 0x2c, 0x01)).bpm).toBe(300)
  })

  it('reports sensor contact when supported', () => {
    expect(parseHeartRate(view(0x06, 120)).contactDetected).toBe(true)
    expect(parseHeartRate(view(0x04, 120)).contactDetected).toBe(false)
    expect(parseHeartRate(view(0x00, 120)).contactDetected).toBeUndefined()
  })
})

describe('parseCyclingPower', () => {
  it('reads power without optional fields', () => {
    expect(parseCyclingPower(view(0x00, 0x00, 0xfa, 0x00))).toEqual({
      watts: 250,
      crank: undefined
    })
  })

  it('skips wheel data to reach crank data', () => {
    // flags: wheel (0x10) + crank (0x20); power 180 W
    const data = view(
      0x30,
      0x00,
      0xb4,
      0x00,
      0x01,
      0x02,
      0x03,
      0x04,
      0x05,
      0x06,
      0x0a,
      0x00,
      0x00,
      0x04
    )
    expect(parseCyclingPower(data)).toEqual({
      watts: 180,
      crank: { revolutions: 10, lastEventTime: 1024 }
    })
  })

  it('skips balance and torque fields', () => {
    const data = view(0x25, 0x00, 0x64, 0x00, 0x32, 0x10, 0x00, 0x05, 0x00, 0x00, 0x08)
    expect(parseCyclingPower(data)).toEqual({
      watts: 100,
      crank: { revolutions: 5, lastEventTime: 2048 }
    })
  })
})

describe('parseIndoorBikeData', () => {
  it('reads speed, cadence and power', () => {
    // flags 0x0044: cadence (bit 2) + power (bit 6); speed present since bit 0 is clear
    const data = view(0x44, 0x00, 0xc4, 0x09, 0xb4, 0x00, 0xd2, 0x00)
    expect(parseIndoorBikeData(data)).toEqual({ speedKmh: 25, cadenceRpm: 90, watts: 210 })
  })

  it('handles "more data" packets without speed', () => {
    const data = view(0x45, 0x00, 0xa0, 0x00, 0x2c, 0x01)
    expect(parseIndoorBikeData(data)).toEqual({ cadenceRpm: 80, watts: 300 })
  })

  it('skips intermediate fields to reach power and heart rate', () => {
    // bits: cadence(2) avgCadence(3) distance(4) resistance(5) power(6) energy(8) hr(9)
    const flags = (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6) | (1 << 8) | (1 << 9)
    const data = view(
      flags & 0xff,
      flags >> 8,
      0x10,
      0x27, // speed 100.00
      0xb4,
      0x00, // cadence 90
      0xa0,
      0x00, // avg cadence
      0x01,
      0x02,
      0x03, // distance
      0x05,
      0x00, // resistance
      0x96,
      0x00, // power 150
      0x01,
      0x00,
      0x02,
      0x00,
      0x03, // energy
      0x8c // hr 140
    )
    expect(parseIndoorBikeData(data)).toEqual({
      speedKmh: 100,
      cadenceRpm: 90,
      watts: 150,
      heartRate: 140
    })
  })
})

describe('CrankCadenceCalculator', () => {
  it('computes rpm from crank deltas', () => {
    const calc = new CrankCadenceCalculator()
    calc.update({ revolutions: 10, lastEventTime: 0 }, 0)
    // 1.5 revolutions/second = 90 rpm: 3 revs in 2 s (2048 ticks)
    expect(calc.update({ revolutions: 13, lastEventTime: 2048 }, 2000)).toBeCloseTo(90)
  })

  it('handles 16-bit rollover', () => {
    const calc = new CrankCadenceCalculator()
    calc.update({ revolutions: 0xffff, lastEventTime: 0xfc00 }, 0)
    expect(calc.update({ revolutions: 1, lastEventTime: 0x0400 }, 1000)).toBeCloseTo(60)
  })

  it('drops to zero after the idle timeout', () => {
    const calc = new CrankCadenceCalculator(3000)
    calc.update({ revolutions: 1, lastEventTime: 0 }, 0)
    calc.update({ revolutions: 2, lastEventTime: 1024 }, 1000)
    expect(calc.update({ revolutions: 2, lastEventTime: 1024 }, 2000)).toBeCloseTo(60)
    expect(calc.update({ revolutions: 2, lastEventTime: 1024 }, 4500)).toBe(0)
  })
})
