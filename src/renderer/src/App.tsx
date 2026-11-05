import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import { hub } from '@/ble/hub'
import { MetricsBar } from '@/components/MetricsBar'
import { SettingsPanel } from '@/components/SettingsPanel'
import { useSettings } from '@/lib/settings'

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export default function App(): ReactNode {
  const state = useSyncExternalStore(hub.subscribe, hub.getState)
  const [settings, updateSettings] = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clickThrough, setClickThrough] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const now = useNow(500)

  useEffect(() => {
    void hub.start().then(() => {
      const { links, demo } = hub.getState()
      if (!demo && links.trainer.status === 'unpaired' && links.hr.status === 'unpaired')
        setSettingsOpen(true)
    })
    const shortcut = navigator.userAgent.includes('Mac') ? '⌘⌥O' : 'Ctrl+Alt+O'
    let hintTimer: ReturnType<typeof setTimeout> | undefined
    const offClick = window.api.window.onClickThrough((enabled) => {
      setClickThrough(enabled)
      if (enabled) setSettingsOpen(false)
      setHint(enabled ? `Click-through on · ${shortcut} to undo` : 'Overlay is clickable again')
      clearTimeout(hintTimer)
      hintTimer = setTimeout(() => setHint(null), 3500)
    })
    const offSettings = window.api.window.onOpenSettings(() => setSettingsOpen(true))
    return () => {
      clearTimeout(hintTimer)
      offClick()
      offSettings()
    }
  }, [])

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      window.api.window.resize(el.offsetWidth, el.offsetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="flex w-[320px] flex-col">
      <MetricsBar
        state={state}
        settings={settings}
        now={now}
        clickThrough={clickThrough}
        hint={hint}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((o) => !o)}
      />
      {settingsOpen && (
        <SettingsPanel
          state={state}
          settings={settings}
          onSettings={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
