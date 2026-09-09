export type ToastKind = "success" | "error" | "info"

export type ToastItem = { id: number; kind: ToastKind; text: string }

export const toasts = $state<ToastItem[]>([])

let seq = 0

export const toast = (text: string, kind: ToastKind = "info") => {
  const id = ++seq

  toasts.push({ id, kind, text })

  setTimeout(() => {
    const at = toasts.findIndex(t => t.id === id)

    if (at >= 0) {
      toasts.splice(at, 1)
    }
  }, 3500)
}
