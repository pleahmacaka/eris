export const eventColors = [
  "primary",
  "info",
  "warning",
  "success",
  "error",
  "violet",
  "pink",
  "gray",
] as const

export type EventColor = (typeof eventColors)[number]

export const colorMeta: Record<
  EventColor,
  { chip: string; block: string; label: string }
> = {
  primary: {
    chip: "bg-primary",
    block: "bg-primary/15 hover:bg-primary/25",
    label: "panel.colors.default",
  },
  info: {
    chip: "bg-info",
    block: "bg-info/15 hover:bg-info/25",
    label: "panel.colors.info",
  },
  warning: {
    chip: "bg-warning",
    block: "bg-warning/20 hover:bg-warning/30",
    label: "panel.colors.warning",
  },
  success: {
    chip: "bg-success",
    block: "bg-success/15 hover:bg-success/25",
    label: "panel.colors.success",
  },
  error: {
    chip: "bg-error",
    block: "bg-error/15 hover:bg-error/25",
    label: "panel.colors.error",
  },
  violet: {
    chip: "bg-violet-400",
    block: "bg-violet-400/15 hover:bg-violet-400/25",
    label: "panel.colors.violet",
  },
  pink: {
    chip: "bg-pink-400",
    block: "bg-pink-400/15 hover:bg-pink-400/25",
    label: "panel.colors.pink",
  },
  gray: {
    chip: "bg-zinc-400",
    block: "bg-zinc-400/15 hover:bg-zinc-400/25",
    label: "panel.colors.gray",
  },
}

export const toColor = (value: string | null | undefined): EventColor =>
  eventColors.find(color => color === value) ?? "primary"
