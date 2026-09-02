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

export type SecondaryAction = {
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

export const groupLabels: Record<ResultKind, string> = {
  app: "Apps",
  window: "Windows",
  command: "Commands",
  calc: "Calculator",
  unit: "Conversion",
  todo: "Todo",
  timer: "Timers",
  emoji: "Emoji",
  web: "Web",
  run: "Run",
  setting: "Settings",
  clip: "Clipboard",
}

export const kindLabels: Record<ResultKind, string> = {
  app: "App",
  window: "Window",
  command: "Command",
  calc: "Calc",
  unit: "Conversion",
  todo: "Todo",
  timer: "Timer",
  emoji: "Emoji",
  web: "Web",
  run: "Run",
  setting: "Setting",
  clip: "Clip",
}
