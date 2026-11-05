# Ride Overlay

A tiny, always-on-top, semi-transparent desktop overlay that shows live **power (W)**, **cadence (RPM)** and **heart rate (BPM)** while you ride indoors — so you can watch a movie and still keep an eye on your numbers, without running a full training app.

- Reads power and cadence from a smart trainer over Bluetooth LE (built and tuned for the **Wahoo KICKR CORE 2**; works with any trainer that exposes the standard FTMS or Cycling Power services).
- Reads heart rate from any standard BLE heart rate broadcaster — including a **Garmin Fenix 7 Pro** with *Broadcast Heart Rate* turned on.
- Floats above other windows, including fullscreen video players.
- Remembers paired sensors and reconnects automatically on launch and after dropouts.
- Optional power/HR zone colors, 1/3/5-second power averaging, adjustable background opacity, and a demo mode for trying it without hardware.

**New here? Follow the step-by-step [tutorial](docs/TUTORIAL.md) to connect everything and start a workout.**

## Recommended setup with a Garmin watch

Your watch can control ERG mode and record the workout itself; the overlay only *reads* data.

1. **Trainer → watch over ANT+.** On the Fenix, add the KICKR CORE 2 as a sensor using **ANT+** (Sensors & Accessories → Add New → Indoor Trainer). This keeps the trainer's Bluetooth connections free for the overlay. Bluetooth for both also works as long as the trainer accepts more than one Bluetooth connection (current Wahoo firmware does). The overlay never sends control commands, so it won't fight the watch over ERG.
2. **Watch → overlay heart rate.** Start an Indoor Bike activity, then hold **MENU** → *Broadcast Heart Rate* (or enable *Broadcast During Activity* under the wrist heart rate settings so it starts automatically). The watch then advertises as a standard Bluetooth heart rate sensor.
3. **Launch the overlay** and pair both sensors once from the settings panel. After that they reconnect automatically.

Alternative: if you use a chest strap (HRM-Pro, etc.), pair it directly as the heart rate sensor.

## Using the overlay

- **First launch** opens the settings panel. Click **Pair** next to *Smart trainer* or *Heart rate*, then pick the device from the list. Pedal a few strokes if the trainer doesn't show up — it sleeps when idle.
- **Move it** by dragging the metrics bar. Its position is remembered.
- **Settings** — hover the bar and click the small gear (bottom-right), or use the tray icon → *Sensors & settings…*.
- **Quit** — tray icon → *Quit*, or the *Quit* button in settings.

A dot next to each metric shows the connection state: green = connected, pulsing amber = searching or reconnecting, gray = not paired. Values older than five seconds are shown as `--`.

## Fullscreen video notes

- **macOS:** the overlay is a floating panel that is visible on all Spaces, including fullscreen ones (Safari, QuickTime, IINA, VLC, browser fullscreen).
- **Windows:** works over borderless/windowed fullscreen (browsers, Netflix app, VLC, mpv default). A few players that use *exclusive* fullscreen can't be overlaid by any normal window; switch them to borderless fullscreen.
- **Linux:** depends on the window manager; most honor always-on-top over fullscreen windows.

## Run it locally

Requirements: Node.js 20+ and a computer with Bluetooth LE.

```bash
npm install
npm run dev        # start the overlay with hot reload
```

Build an installer for your OS:

```bash
npm run build:mac     # .dmg   (dist/)
npm run build:win     # NSIS installer + portable .exe
npm run build:linux   # AppImage + .deb
```

macOS will ask for Bluetooth permission on first use. Builds are unsigned, so on macOS right-click → *Open* the first time; on Windows choose *More info → Run anyway*.

Other scripts: `npm test` (unit tests for the Bluetooth parsers), `npm run lint`, `npm run typecheck`.

## How it works

- **Electron + Web Bluetooth.** No native Bluetooth modules — the renderer uses `navigator.bluetooth`, and the main process replaces Chromium's device chooser (`select-bluetooth-device`) so the overlay can show its own picker and silently re-select saved devices on startup.
- **Trainer data.** Subscribes to FTMS *Indoor Bike Data* (power + cadence) and *Cycling Power Measurement* (power + crank revolutions → cadence). FTMS is preferred when present; Cycling Power is the fallback.
- **Heart rate.** Standard *Heart Rate Measurement* characteristic (0x2A37).
- **Reconnect.** On disconnect it retries the GATT connection with backoff, and falls back to a background scan for the saved device ID or name.

```
src/
  main/        window, tray, shortcuts, Bluetooth chooser (Electron main process)
  preload/     typed IPC bridge
  renderer/    React UI + BLE logic (src/ble/parsers.ts, src/ble/hub.ts)
  shared/      types shared by both sides
```

## Troubleshooting

- **Device not listed:** close other apps that may be holding the sensor's Bluetooth connection (Wahoo, Zwift, a phone), wake the trainer by pedaling, and make sure the watch's HR broadcast is on.
- **Linux:** BlueZ must be running and your user needs access to it. Web Bluetooth is enabled via Chromium's experimental platform features flag, which the app sets for you.
- **Reset pairings:** use *Forget* next to each sensor.
