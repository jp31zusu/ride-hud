import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray
} from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { setupBluetooth } from './bluetooth'

// Web Bluetooth is still behind this flag in Chromium on Linux.
app.commandLine.appendSwitch('enable-experimental-web-platform-features')

const SHORTCUT_CLICK_THROUGH = 'CommandOrControl+Alt+O'
const SHORTCUT_TOGGLE = 'CommandOrControl+Alt+H'
const MARGIN = 24

let win: BrowserWindow | null = null
let tray: Tray | null = null
let clickThrough = false

const prefsPath = (): string => join(app.getPath('userData'), 'window.json')

function loadPosition(): { x: number; y: number } | null {
  try {
    const pos = JSON.parse(readFileSync(prefsPath(), 'utf8'))
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return (
        pos.x >= a.x - 50 && pos.y >= a.y - 50 && pos.x < a.x + a.width && pos.y < a.y + a.height
      )
    })
    return visible ? pos : null
  } catch {
    return null
  }
}

function savePosition(): void {
  if (!win) return
  const [x, y] = win.getPosition()
  try {
    writeFileSync(prefsPath(), JSON.stringify({ x, y }))
  } catch {
    // non-fatal: position just won't persist
  }
}

function createWindow(): void {
  const width = 320
  const height = 96
  const area = screen.getPrimaryDisplay().workArea
  const pos = loadPosition() ?? { x: area.x + area.width - width - MARGIN, y: area.y + MARGIN }

  win = new BrowserWindow({
    width,
    height,
    ...pos,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // A macOS panel can float above other apps' fullscreen spaces.
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('ready-to-show', () => win?.showInactive())
  win.on('moved', savePosition)
  win.on('closed', () => (win = null))

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  setupBluetooth(win)

  // Fullscreen video players on Windows/Linux can push themselves above other
  // topmost windows; periodically reasserting z-order keeps the overlay visible.
  if (process.platform !== 'darwin') {
    const timer = setInterval(() => {
      if (win && !win.isDestroyed() && win.isVisible()) win.moveTop()
    }, 2000)
    win.on('closed', () => clearInterval(timer))
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setClickThrough(enabled: boolean): void {
  clickThrough = enabled
  win?.setIgnoreMouseEvents(enabled, { forward: true })
  win?.webContents.send('win:click-through', enabled)
  updateTrayMenu()
}

function toggleVisible(): void {
  if (!win) return
  if (win.isVisible()) win.hide()
  else win.showInactive()
  updateTrayMenu()
}

function openSettings(): void {
  if (!win) return
  if (clickThrough) setClickThrough(false)
  win.showInactive()
  win.webContents.send('win:open-settings')
}

function updateTrayMenu(): void {
  if (!tray) return
  const accel = (s: string): string =>
    s.replace('CommandOrControl', process.platform === 'darwin' ? 'Cmd' : 'Ctrl')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: win?.isVisible() ? 'Hide overlay' : 'Show overlay',
        sublabel: accel(SHORTCUT_TOGGLE),
        click: toggleVisible
      },
      {
        label: 'Click-through',
        sublabel: accel(SHORTCUT_CLICK_THROUGH),
        type: 'checkbox',
        checked: clickThrough,
        click: (item) => setClickThrough(item.checked)
      },
      { label: 'Sensors & settings…', click: openSettings },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' }
    ])
  )
}

function createTray(): void {
  const image = nativeImage.createFromPath(icon).resize({ width: 18, height: 18 })
  tray = new Tray(image)
  tray.setToolTip('Ride Overlay')
  updateTrayMenu()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => win?.showInactive())

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.rideoverlay.app')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    ipcMain.on('win:resize', (_e, width: number, height: number) => {
      if (!win) return
      const bounds = win.getBounds()
      const area = screen.getDisplayMatching(bounds).workArea
      const w = Math.ceil(width)
      const h = Math.ceil(height)
      const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - w)
      const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - h)
      win.setBounds({ x, y, width: w, height: h })
    })
    ipcMain.on('win:click-through', (_e, enabled: boolean) => setClickThrough(enabled))
    ipcMain.on('app:quit', () => app.quit())

    createWindow()
    createTray()

    globalShortcut.register(SHORTCUT_CLICK_THROUGH, () => setClickThrough(!clickThrough))
    globalShortcut.register(SHORTCUT_TOGGLE, toggleVisible)
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())
  app.on('window-all-closed', () => app.quit())
}
