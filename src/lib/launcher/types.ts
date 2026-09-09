import { tr } from "$lib/i18n/locale"

export type ResultKind =
  | "app"
  | "window"
  | "command"
  | "calc"
  | "unit"
  | "todo"
  | "timer"
  | "emoji"
  | "web"
  | "run"
  | "setting"
  | "clip"

export type ActionId = "admin" | "location" | "cancel"

export type SecondaryAction = {
  id?: ActionId
  label: string
  run: () => void | Promise<void>
  stay?: boolean
}

export type Result = {
  id: string
  kind: ResultKind
  title: string
  subtitle: string
  icon: string
  iconPath?: string
  chips?: string[]
  keywords?: string[]
  action: () => void | Promise<void>
  secondaryActions: SecondaryAction[]
  stay?: boolean
  score: number
}

export type ResultGroup = {
  kind: ResultKind
  label: string
  start: number
  items: Result[]
}

export const groupLabel = (kind: ResultKind) => tr(`launcher.groups.${kind}`)

export const kindLabel = (kind: ResultKind) => tr(`launcher.kinds.${kind}`)
