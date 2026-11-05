import {
  CHARACTERISTIC,
  CrankCadenceCalculator,
  SERVICE,
  parseCyclingPower,
  parseHeartRate,
  parseIndoorBikeData
} from './parsers'
import type { BluetoothCandidate, Purpose, SavedDevice } from '../../../shared/bluetooth'

export type LinkStatus = 'unpaired' | 'searching' | 'connecting' | 'connected' | 'reconnecting'

export interface LinkState {
  status: LinkStatus
  saved?: SavedDevice
  error?: string
}

export interface Sample {
  value: number
  at: number
}

export interface HubState {
  bluetooth: 'unknown' | 'available' | 'unavailable'
  links: Record<Purpose, LinkState>
  power: Sample[]
  cadence?: Sample
  heartRate?: Sample
  chooser: { purpose: Purpose; devices: BluetoothCandidate[] } | null
}

const STORAGE_KEY = 'overlay.devices.v1'
const POWER_HISTORY_MS = 10_000
const SCAN_RETRY_MS = 8_000

const REQUEST_OPTIONS: RequestDeviceOptions = {
  filters: [
    { services: [SERVICE.fitnessMachine] },
    { services: [SERVICE.cyclingPower] },
    { services: [SERVICE.heartRate] },
    { namePrefix: 'KICKR' }
  ],
  optionalServices: [
    SERVICE.fitnessMachine,
    SERVICE.cyclingPower,
    SERVICE.heartRate,
    SERVICE.deviceInformation
  ]
}

declare global {
  interface Window {
    __overlayStartScan?: () => boolean
  }
}

function loadSaved(): Partial<Record<Purpose, SavedDevice>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

class SensorLink {
  device?: BluetoothDevice
  private generation = 0
  private cadenceCalc = new CrankCadenceCalculator()
  private lastFtmsAt = 0

  constructor(
    readonly purpose: Purpose,
    private readonly hub: SensorHub
  ) {}

  /** Takes ownership of a freshly selected device and keeps it connected. */
  async attach(device: BluetoothDevice): Promise<void> {
    this.detach()
    const gen = ++this.generation
    this.device = device
    device.addEventListener('gattserverdisconnected', () => {
      if (gen === this.generation) void this.reconnectLoop(gen)
    })
    this.hub.patchLink(this.purpose, { status: 'connecting', error: undefined })
    try {
      await this.connect(device)
      if (gen === this.generation) this.hub.patchLink(this.purpose, { status: 'connected' })
    } catch (err) {
      if (gen !== this.generation) return
      this.hub.patchLink(this.purpose, { error: describe(err) })
      void this.reconnectLoop(gen)
    }
  }

  detach(): void {
    this.generation++
    const device = this.device
    this.device = undefined
    this.cadenceCalc.reset()
    if (device?.gatt?.connected) device.gatt.disconnect()
  }

  private async reconnectLoop(gen: number): Promise<void> {
    const device = this.device
    if (!device) return
    this.hub.patchLink(this.purpose, { status: 'reconnecting' })
    for (let attempt = 0; gen === this.generation; attempt++) {
      await sleep(Math.min(1000 * 2 ** attempt, 15_000))
      if (gen !== this.generation) return
      try {
        await this.connect(device)
        if (gen !== this.generation) return
        this.hub.patchLink(this.purpose, { status: 'connected', error: undefined })
        return
      } catch (err) {
        this.hub.patchLink(this.purpose, { error: describe(err) })
        // Cached device handles can go stale (e.g. the sensor slept and came
        // back with a new connection); a fresh scan finds it again.
        if (attempt >= 3) this.hub.requestScan()
      }
    }
  }

  private async connect(device: BluetoothDevice): Promise<void> {
    const server = await device.gatt!.connect()
    if (this.purpose === 'hr') {
      await this.subscribe(server, SERVICE.heartRate, CHARACTERISTIC.heartRateMeasurement, (v) => {
        const { bpm, contactDetected } = parseHeartRate(v)
        if (contactDetected !== false && bpm > 0) this.hub.pushHeartRate(bpm)
      })
      return
    }

    // Subscribe to both FTMS and Cycling Power when available; FTMS reports
    // cadence directly, Cycling Power is the fallback for older firmware.
    const ftms = await this.subscribe(
      server,
      SERVICE.fitnessMachine,
      CHARACTERISTIC.indoorBikeData,
      (v) => {
        const data = parseIndoorBikeData(v)
        if (data.watts === undefined && data.cadenceRpm === undefined) return
        this.lastFtmsAt = Date.now()
        if (data.watts !== undefined) this.hub.pushPower(data.watts)
        if (data.cadenceRpm !== undefined) this.hub.pushCadence(data.cadenceRpm)
      }
    ).then(
      () => true,
      () => false
    )
    const cps = await this.subscribe(
      server,
      SERVICE.cyclingPower,
      CHARACTERISTIC.cyclingPowerMeasurement,
      (v) => {
        if (Date.now() - this.lastFtmsAt < 3000) return
        const data = parseCyclingPower(v)
        this.hub.pushPower(data.watts)
        if (data.crank) this.hub.pushCadence(this.cadenceCalc.update(data.crank, Date.now()))
      }
    ).then(
      () => true,
      () => false
    )
    if (!ftms && !cps) {
      device.gatt?.disconnect()
      throw new Error('Device has no power service')
    }
  }

  private async subscribe(
    server: BluetoothRemoteGATTServer,
    service: number,
    characteristic: number,
    onValue: (view: DataView) => void
  ): Promise<void> {
    const svc = await server.getPrimaryService(service)
    const chr = await svc.getCharacteristic(characteristic)
    chr.addEventListener('characteristicvaluechanged', () => {
      if (chr.value) onValue(chr.value)
    })
    await chr.startNotifications()
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export class SensorHub {
  private state: HubState
  private listeners = new Set<() => void>()
  private links: Record<Purpose, SensorLink>
  private scanning = false
  private scanQueued = false
  private retryTimer?: ReturnType<typeof setTimeout>
  private pendingRequest?: Promise<BluetoothDevice>

  constructor() {
    const saved = loadSaved()
    this.state = {
      bluetooth: 'unknown',
      links: {
        trainer: { status: saved.trainer ? 'searching' : 'unpaired', saved: saved.trainer },
        hr: { status: saved.hr ? 'searching' : 'unpaired', saved: saved.hr }
      },
      power: [],
      chooser: null
    }
    this.links = { trainer: new SensorLink('trainer', this), hr: new SensorLink('hr', this) }

    window.__overlayStartScan = () => {
      this.pendingRequest = navigator.bluetooth.requestDevice(REQUEST_OPTIONS)
      return true
    }
    window.api.bluetooth.onCandidates((purpose, devices) =>
      this.set({ chooser: { purpose, devices } })
    )
  }

  async start(): Promise<void> {
    const available =
      !!navigator.bluetooth && (await navigator.bluetooth.getAvailability().catch(() => false))
    this.set({ bluetooth: available ? 'available' : 'unavailable' })
    if (available) this.requestScan()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): HubState => this.state

  private set(patch: Partial<HubState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  patchLink(purpose: Purpose, patch: Partial<LinkState>): void {
    const links = { ...this.state.links, [purpose]: { ...this.state.links[purpose], ...patch } }
    this.set({ links })
  }

  pushCadence(rpm: number): void {
    this.set({ cadence: { value: rpm, at: Date.now() } })
  }

  pushHeartRate(bpm: number): void {
    this.set({ heartRate: { value: bpm, at: Date.now() } })
  }

  pushPower(watts: number): void {
    const now = Date.now()
    const power = this.state.power.filter((s) => now - s.at < POWER_HISTORY_MS)
    power.push({ value: Math.max(0, watts), at: now })
    this.set({ power })
  }

  private persist(): void {
    const saved: Partial<Record<Purpose, SavedDevice>> = {}
    for (const p of ['trainer', 'hr'] as Purpose[]) {
      const s = this.state.links[p].saved
      if (s) saved[p] = s
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  }

  /** Saved devices that still need to be found by a scan. */
  private targets(): Array<SavedDevice & { purpose: Purpose }> {
    return (['trainer', 'hr'] as Purpose[]).flatMap((purpose) => {
      const link = this.state.links[purpose]
      const needsScan =
        link.saved && (link.status === 'searching' || link.status === 'reconnecting')
      return needsScan ? [{ ...link.saved!, purpose }] : []
    })
  }

  requestScan(): void {
    if (this.state.bluetooth !== 'available') return
    clearTimeout(this.retryTimer)
    if (this.scanning) {
      this.scanQueued = true
      void window.api.bluetooth.setTargets(this.targets())
      return
    }
    if (this.targets().length === 0) return
    void this.runScan()
  }

  /**
   * Runs one navigator.bluetooth.requestDevice() call. Electron allows a single
   * request at a time, so automatic reconnects and manual pairing share it: the
   * main process either auto-selects a saved device or forwards the candidate
   * list to the picker, depending on the current mode.
   */
  private async runScan(manual?: Purpose): Promise<void> {
    this.scanning = true
    this.scanQueued = false
    let failed = false
    try {
      await window.api.bluetooth.start(this.targets(), manual)
      const device = await this.pendingRequest!
      const chosen = await window.api.bluetooth.takeChosen()
      if (chosen) await this.adopt(chosen.purpose, device, chosen)
    } catch {
      failed = true
    } finally {
      this.pendingRequest = undefined
      this.scanning = false
      this.set({ chooser: null })
      await window.api.bluetooth.end()
    }

    if (this.targets().length > 0) {
      if (failed && !this.scanQueued)
        this.retryTimer = setTimeout(() => this.requestScan(), SCAN_RETRY_MS)
      else this.requestScan()
    }
  }

  private async adopt(
    purpose: Purpose,
    device: BluetoothDevice,
    chosen: BluetoothCandidate
  ): Promise<void> {
    const other: Purpose = purpose === 'trainer' ? 'hr' : 'trainer'
    if (this.state.links[other].saved?.deviceId === chosen.deviceId) this.forget(other)
    this.patchLink(purpose, {
      saved: { deviceId: chosen.deviceId, name: chosen.deviceName || device.name || 'Sensor' }
    })
    this.persist()
    await this.links[purpose].attach(device)
  }

  /** Opens the device picker for a sensor slot. */
  pair(purpose: Purpose): void {
    if (this.state.bluetooth !== 'available') return
    clearTimeout(this.retryTimer)
    this.set({ chooser: { purpose, devices: [] } })
    if (this.scanning) void window.api.bluetooth.choose({ purpose })
    else void this.runScan(purpose)
  }

  pickCandidate(deviceId: string): void {
    void window.api.bluetooth.choose({ deviceId })
  }

  closeChooser(): void {
    this.set({ chooser: null })
    void window.api.bluetooth.choose({ dismiss: true })
  }

  forget(purpose: Purpose): void {
    this.links[purpose].detach()
    this.patchLink(purpose, { status: 'unpaired', saved: undefined, error: undefined })
    if (purpose === 'hr') this.set({ heartRate: undefined })
    else this.set({ power: [], cadence: undefined })
    this.persist()
    void window.api.bluetooth.setTargets(this.targets())
  }
}

export const hub = new SensorHub()
