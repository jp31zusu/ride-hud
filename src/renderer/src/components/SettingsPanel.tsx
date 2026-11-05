import { Bike, Bluetooth, BluetoothOff, Heart, Loader2, Power, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { hub, type HubState, type LinkState } from '@/ble/hub'
import type { Purpose } from '../../../shared/bluetooth'
import type { Settings } from '@/lib/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface Props {
  state: HubState
  settings: Settings
  onSettings: (patch: Partial<Settings>) => void
  onClose: () => void
}

export function SettingsPanel({ state, settings, onSettings, onClose }: Props): ReactNode {
  return (
    <div className="no-drag mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950/95 p-3 text-sm shadow-xl shadow-black/40">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-white/60 uppercase">Sensors</h2>
        <button
          type="button"
          aria-label="Close settings"
          onClick={onClose}
          className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {state.bluetooth === 'unavailable' ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-200">
          <BluetoothOff className="mt-0.5 size-4 shrink-0" />
          <p>
            Bluetooth isn&apos;t available. Turn it on in your system settings and restart the
            overlay.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <SensorRow
            purpose="trainer"
            title="Smart trainer"
            hint="Wahoo KICKR CORE 2"
            icon={<Bike className="size-4" />}
            link={state.links.trainer}
            state={state}
          />
          <SensorRow
            purpose="hr"
            title="Heart rate"
            hint="Garmin Fenix 7 Pro"
            icon={<Heart className="size-4" />}
            link={state.links.hr}
            state={state}
          />
        </div>
      )}

      <h2 className="mt-4 mb-2 text-xs font-semibold tracking-wider text-white/60 uppercase">
        Display
      </h2>
      <div className="space-y-3">
        <Row label="Background">
          <Slider
            className="w-36"
            min={0}
            max={100}
            step={5}
            value={[Math.round(settings.opacity * 100)]}
            onValueChange={([v]) => onSettings({ opacity: v / 100 })}
          />
        </Row>
        <Row label="Power average">
          <div className="flex rounded-md bg-white/5 p-0.5">
            {([1, 3, 5] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onSettings({ powerAverageSec: sec })}
                className={cn(
                  'rounded px-2.5 py-0.5 text-xs tabular-nums transition-colors',
                  settings.powerAverageSec === sec
                    ? 'bg-white text-zinc-900'
                    : 'text-white/70 hover:text-white'
                )}
              >
                {sec}s
              </button>
            ))}
          </div>
        </Row>
        <Row label="Zone colors">
          <Switch
            checked={settings.zoneColors}
            onCheckedChange={(zoneColors) => onSettings({ zoneColors })}
          />
        </Row>
        {settings.zoneColors && (
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="FTP (W)"
              value={settings.ftp}
              min={50}
              max={600}
              onChange={(ftp) => onSettings({ ftp })}
            />
            <NumberField
              label="Max HR"
              value={settings.maxHr}
              min={120}
              max={230}
              onChange={(maxHr) => onSettings({ maxHr })}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end border-t border-white/10 pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-white/60 hover:text-white"
          onClick={() => window.api.window.quit()}
        >
          <Power className="size-3.5" /> Quit
        </Button>
      </div>
    </div>
  )
}

function SensorRow({
  purpose,
  title,
  hint,
  icon,
  link,
  state
}: {
  purpose: Purpose
  title: string
  hint: string
  icon: ReactNode
  link: LinkState
  state: HubState
}): ReactNode {
  const choosing = state.chooser?.purpose === purpose
  const statusText: Record<LinkState['status'], string> = {
    connected: 'Connected',
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    searching: 'Waiting for device…',
    unpaired: hint
  }

  return (
    <div className="rounded-lg bg-white/5 p-2.5">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'rounded-md p-1.5',
            link.status === 'connected'
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-white/5 text-white/60'
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{link.saved?.name ?? title}</div>
          <div
            className={cn(
              'truncate text-xs',
              link.status === 'connected' ? 'text-emerald-300/80' : 'text-white/50'
            )}
          >
            {statusText[link.status]}
          </div>
        </div>
        {link.saved ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => hub.pair(purpose)}
            >
              Change
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-white/60"
              onClick={() => hub.forget(purpose)}
            >
              Forget
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={() => hub.pair(purpose)}
            disabled={choosing}
          >
            <Bluetooth className="size-3.5" /> Pair
          </Button>
        )}
      </div>
      {link.error && link.status !== 'connected' && (
        <p className="mt-1.5 truncate text-[11px] text-rose-300/80">{link.error}</p>
      )}
      {choosing && <Chooser devices={state.chooser!.devices} />}
    </div>
  )
}

function Chooser({ devices }: { devices: { deviceId: string; deviceName: string }[] }): ReactNode {
  return (
    <div className="mt-2 rounded-md border border-white/10 bg-black/30">
      <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-1.5 text-[11px] text-white/55">
        <span className="flex items-center gap-1.5">
          <Loader2 className="size-3 animate-spin" /> Scanning nearby sensors…
        </span>
        <button type="button" onClick={() => hub.closeChooser()} className="hover:text-white">
          Cancel
        </button>
      </div>
      {devices.length === 0 ? (
        <p className="px-2.5 py-3 text-xs text-white/45">
          Make sure the trainer is awake (pedal a few strokes) or that heart rate broadcasting is
          on.
        </p>
      ) : (
        <ul className="max-h-36 overflow-y-auto py-1">
          {devices.map((d) => (
            <li key={d.deviceId}>
              <button
                type="button"
                onClick={() => hub.pickCandidate(d.deviceId)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-white/10"
              >
                <Bluetooth className="size-3.5 text-sky-300" />
                <span className="truncate">{d.deviceName || 'Unnamed device'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/80">{label}</span>
      {children}
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}): ReactNode {
  return (
    <label className="flex flex-col gap-1 text-xs text-white/60">
      {label}
      <Input
        type="number"
        className="h-8 tabular-nums"
        defaultValue={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v >= min && v <= max) onChange(v)
        }}
        onBlur={(e) => {
          const v = Math.min(max, Math.max(min, Number(e.target.value) || value))
          e.target.value = String(v)
          onChange(v)
        }}
      />
    </label>
  )
}
