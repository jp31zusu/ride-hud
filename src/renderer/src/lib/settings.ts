import { useCallback, useState } from 'react'

export interface Settings {
  opacity: number
  zoneColors: boolean
  ftp: number
  maxHr: number
}

const KEY = 'overlay.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  opacity: 0.55,
  zoneColors: true,
  ftp: 200,
  maxHr: 185
}

function load(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(load)
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])
  return [settings, update]
}
