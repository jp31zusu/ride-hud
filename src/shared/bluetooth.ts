export type Purpose = 'trainer' | 'hr'

export interface SavedDevice {
  /** Platform device id reported by Electron's chooser (MAC on Windows/Linux, UUID on macOS). */
  deviceId: string
  name: string
}

export interface BluetoothCandidate {
  deviceId: string
  deviceName: string
}

export interface ScanTarget extends SavedDevice {
  purpose: Purpose
}

export interface ChosenDevice extends BluetoothCandidate {
  purpose: Purpose
}

export type ChooseAction = { purpose: Purpose } | { deviceId: string } | { dismiss: true }

export interface OverlayApi {
  bluetooth: {
    start(targets: ScanTarget[], manual?: Purpose): Promise<void>
    end(): Promise<void>
    setTargets(targets: ScanTarget[]): Promise<void>
    choose(action: ChooseAction): Promise<void>
    takeChosen(): Promise<ChosenDevice | null>
    onCandidates(cb: (purpose: Purpose, devices: BluetoothCandidate[]) => void): () => void
  }
  window: {
    resize(width: number, height: number): void
    setClickThrough(enabled: boolean): void
    onClickThrough(cb: (enabled: boolean) => void): () => void
    onOpenSettings(cb: () => void): () => void
    quit(): void
  }
}
