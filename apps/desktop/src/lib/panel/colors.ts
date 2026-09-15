export const eventColors = [
  "primary",
  "info",
  "warning",
  "success",
  "error",
] as const

export type EventColor = (typeof eventColors)[number]

export const colorMeta: Record<
  EventColor,
  { chip: string; block: string; label: string }
> = {
  primary: {
    chip: "bg-primary",
    block: "bg-primary/15 text-primary",
    label: "panel.colors.default",
  },
  info: {
    chip: "bg-info",
    block: "bg-info/15 text-info",
    label: "panel.colors.info",
  },
  warning: {
    chip: "bg-warning",
    block: "bg-warning/15 text-warning",
    label: "panel.colors.warning",
  },
  success: {
    chip: "bg-success",
    block: "bg-success/15 text-success",
    label: "panel.colors.success",
  },
  error: {
    chip: "bg-error",
    block: "bg-error/15 text-error",
    label: "panel.colors.error",
  },
}

// older events stored raw css values like var(--color-success)
export const toColor = (value: string | null): EventColor => {
  const raw = value?.match(/^var\(--color-(.+)\)$/)?.[1] ?? value

  return (eventColors as readonly string[]).includes(raw ?? "")
    ? (raw as EventColor)
    : "primary"
}
