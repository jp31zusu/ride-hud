import { Heart, RotateCw, Settings2, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import type { HubState, LinkStatus } from '@/ble/hub'
import type { Settings } from '@/lib/settings'
import { STALE_MS, averagePower, heartRateZoneColor, powerZoneColor } from '@/lib/zones'
import { cn } from '@/lib/utils'

const POWER_AVERAGE_SEC = 3

interface Props {
  state: HubState
  settings: Settings
  now: number
  settingsOpen: boolean
  onToggleSettings: () => void
}

export function MetricsBar({
  state,
  settings,
  now,
  settingsOpen,
  onToggleSettings
}: Props): ReactNode {
  const watts = averagePower(state.power, POWER_AVERAGE_SEC, now)
  const cadence = fresh(state.cadence, now)
  const hr = fresh(state.heartRate, now)
  const trainer = state.links.trainer.status
  const hrStatus = state.links.hr.status

  return (
    <div
      className="drag group relative flex items-stretch rounded-2xl border border-white/10 shadow-lg shadow-black/30"
      style={{ backgroundColor: `rgba(12, 12, 14, ${settings.opacity})` }}
    >
      <Metric
        icon={<Zap className="size-3.5" />}
        label="W"
        value={watts}
        status={trainer}
        color={
          settings.zoneColors && watts !== undefined
            ? powerZoneColor(watts, settings.ftp)
            : undefined
        }
      />
      <Divider />
      <Metric
        icon={<RotateCw className="size-3.5" />}
        label="RPM"
        value={cadence}
        status={trainer}
      />
      <Divider />
      <Metric
        icon={
          <Heart className={cn('size-3.5', hr !== undefined && 'fill-current animate-pulse')} />
        }
        label="BPM"
        value={hr}
        status={hrStatus}
        color={
          settings.zoneColors && hr !== undefined
            ? heartRateZoneColor(hr, settings.maxHr)
            : undefined
        }
      />

      <button
        type="button"
        aria-label="Open settings"
        onClick={onToggleSettings}
        className={cn(
          'no-drag absolute right-1 bottom-1 rounded-md p-1 text-white/60 transition-opacity hover:bg-white/10 hover:text-white',
          settingsOpen
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
        )}
      >
        <Settings2 className="size-3.5" />
      </button>
    </div>
  )
}

function fresh(sample: { value: number; at: number } | undefined, now: number): number | undefined {
  return sample && now - sample.at <= STALE_MS ? sample.value : undefined
}

function Divider(): ReactNode {
  return <div className="my-3 w-px bg-white/10" />
}

const STATUS_DOT: Record<LinkStatus, string> = {
  connected: 'bg-emerald-400',
  connecting: 'bg-amber-400 animate-pulse',
  reconnecting: 'bg-amber-400 animate-pulse',
  searching: 'bg-amber-400/70 animate-pulse',
  unpaired: 'bg-white/25'
}

const STATUS_LABEL: Record<LinkStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  searching: 'Searching…',
  unpaired: 'Not paired'
}

function Metric({
  icon,
  label,
  value,
  status,
  color
}: {
  icon: ReactNode
  label: string
  value: number | undefined
  status: LinkStatus
  color?: string
}): ReactNode {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3"
      title={STATUS_LABEL[status]}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-white/55">
        <span className={cn('size-1.5 rounded-full', STATUS_DOT[status])} />
        {icon}
        {label}
      </div>
      <div
        className={cn(
          'text-[34px] leading-none font-semibold tabular-nums transition-colors duration-500',
          value === undefined ? 'text-white/30' : (color ?? 'text-white')
        )}
        style={{ textShadow: '0 1px 6px rgba(0,0,0,0.55)' }}
      >
        {value === undefined ? '--' : Math.round(value)}
      </div>
    </div>
  )
}
