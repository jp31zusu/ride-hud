import { ipcMain, type BrowserWindow } from 'electron'
import type {
  BluetoothCandidate,
  ChooseAction,
  ChosenDevice,
  Purpose,
  ScanTarget
} from '../shared/bluetooth'

const AUTO_SCAN_MS = 30_000

/**
 * Replaces Chromium's Bluetooth chooser. Each navigator.bluetooth.requestDevice()
 * call in the renderer runs either in auto mode (silently pick a previously
 * paired device as soon as it advertises) or manual mode (stream candidates to
 * the in-overlay picker).
 */
export function setupBluetooth(win: BrowserWindow): void {
  const wc = win.webContents
  let targets: ScanTarget[] = []
  let manual: Purpose | null = null
  let callback: ((deviceId: string) => void) | null = null
  let candidates: BluetoothCandidate[] = []
  let chosen: ChosenDevice | null = null
  let cancelWhenPossible = false
  let autoTimer: NodeJS.Timeout | undefined

  const settle = (deviceId: string): void => {
    const cb = callback
    callback = null
    cancelWhenPossible = false
    clearTimeout(autoTimer)
    cb?.(deviceId)
  }

  const tryAuto = (): void => {
    if (manual || !callback) return
    for (const c of candidates) {
      const target =
        targets.find((t) => t.deviceId === c.deviceId) ??
        targets.find((t) => t.name && t.name === c.deviceName)
      if (target) {
        chosen = { ...c, purpose: target.purpose }
        settle(c.deviceId)
        return
      }
    }
    if (cancelWhenPossible || targets.length === 0) settle('')
  }

  const armAutoTimeout = (): void => {
    clearTimeout(autoTimer)
    autoTimer = setTimeout(() => {
      cancelWhenPossible = true
      tryAuto()
    }, AUTO_SCAN_MS)
  }

  wc.on('select-bluetooth-device', (event, devices, cb) => {
    event.preventDefault()
    callback = cb
    candidates = devices.map((d) => ({ deviceId: d.deviceId, deviceName: d.deviceName }))
    if (manual) wc.send('bt:candidates', manual, candidates)
    else tryAuto()
  })

  ipcMain.handle('bt:start', async (_e, nextTargets: ScanTarget[], manualPurpose?: Purpose) => {
    targets = nextTargets
    manual = manualPurpose ?? null
    chosen = null
    candidates = []
    callback = null
    cancelWhenPossible = false
    if (manual) clearTimeout(autoTimer)
    else armAutoTimeout()
    // requestDevice() needs a user gesture; executeJavaScript can supply one,
    // which is what allows reconnecting on startup without a click.
    await wc.executeJavaScript('window.__overlayStartScan?.()', true)
  })

  ipcMain.handle('bt:end', () => {
    clearTimeout(autoTimer)
    callback = null
    manual = null
    candidates = []
  })

  ipcMain.handle('bt:set-targets', (_e, nextTargets: ScanTarget[]) => {
    targets = nextTargets
    tryAuto()
  })

  ipcMain.handle('bt:choose', (_e, action: ChooseAction) => {
    if ('purpose' in action) {
      manual = action.purpose
      cancelWhenPossible = false
      clearTimeout(autoTimer)
      wc.send('bt:candidates', manual, candidates)
    } else if ('deviceId' in action) {
      const candidate = candidates.find((c) => c.deviceId === action.deviceId)
      if (!candidate || !callback || !manual) return
      chosen = { ...candidate, purpose: manual }
      settle(candidate.deviceId)
    } else {
      manual = null
      if (targets.length > 0) armAutoTimeout()
      else cancelWhenPossible = true
      tryAuto()
    }
  })

  ipcMain.handle('bt:take-chosen', () => {
    const result = chosen
    chosen = null
    return result
  })
}
