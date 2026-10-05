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
    label: "기본",
  },
  info: { chip: "bg-info", block: "bg-info/15 text-info", label: "정보" },
  warning: {
    chip: "bg-warning",
    block: "bg-warning/15 text-warning",
    label: "주의",
  },
  success: {
    chip: "bg-success",
    block: "bg-success/15 text-success",
    label: "완료",
  },
  error: { chip: "bg-error", block: "bg-error/15 text-error", label: "중요" },
}

export const toColor = (value: string | null): EventColor =>
  (eventColors as readonly string[]).includes(value ?? "")
    ? (value as EventColor)
    : "primary"
