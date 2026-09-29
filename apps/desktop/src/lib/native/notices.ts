import { invoke } from "@tauri-apps/api/core"

export type Notice = {
  id: number
  app: string
  title: string
  body: string
  arrived: number
}

export const noticesList = () => invoke<Notice[]>("notices_list")

export const noticesUnseen = () => invoke<number>("notices_unseen")

export const noticesSeen = () => invoke<void>("notices_seen")

export const noticesDismiss = (ids: number[]) =>
  invoke<void>("notices_dismiss", { ids })

export const noticesOpenPanel = (anchor: [number, number, number, number]) =>
  invoke<void>("notices_open_panel", { anchor })

export const noticesActivate = (id: number) =>
  invoke<void>("notices_activate", { id })
