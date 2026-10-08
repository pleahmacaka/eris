/// <reference types="vite-plugin-iconify-subset/client" />

declare global {
  namespace App {
    interface PageData {
      framed?: boolean
      denseMenu?: boolean
    }
  }

  interface Window {
    __TAURI_INTERNALS__?: {
      runCallback: (id: number, data: unknown) => void
      metadata?: { currentWindow?: { label?: string } }
    }
  }
}

export {}
