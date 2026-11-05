import type { OverlayApi } from '../shared/bluetooth'

declare global {
  interface Window {
    api: OverlayApi
  }
}
