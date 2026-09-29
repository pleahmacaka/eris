declare global {
  namespace App {}

  interface Window {
    __TAURI_INTERNALS__?: {
      runCallback: (id: number, data: unknown) => void
    }
  }
}

export {}
