<script lang="ts">
  import { locale, t } from "svelte-i18n"
  import type { ClockAlign } from "$lib/settings"

  type Props = {
    clock24h: boolean
    showSeconds: boolean
    align?: ClockAlign
    active?: boolean
    onclick: () => void
  }

  let {
    clock24h,
    showSeconds,
    align = "end",
    active = false,
    onclick,
  }: Props = $props()

  const ALIGN: Record<ClockAlign, string> = {
    start: "items-start text-left",
    center: "items-center text-center",
    end: "items-end text-right",
  }

  let now = $state(new Date())

  $effect(() => {
    const timer = setInterval(() => {
      now = new Date()
    }, 1000)

    return () => clearInterval(timer)
  })

  const tag = $derived($locale ?? "en")

  const time = $derived(
    now.toLocaleTimeString(tag, {
      hour: clock24h ? "2-digit" : "numeric",
      minute: "2-digit",
      second: showSeconds ? "2-digit" : undefined,
      hour12: !clock24h,
    }),
  )

  const date = $derived(
    now.toLocaleDateString(tag, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
  )
</script>

<button
  class={[
    "btn btn-ghost h-auto min-h-0 flex-col gap-0 rounded-field px-2.5 py-1 leading-tight",
    ALIGN[align],
    active && "bg-base-content/10",
  ]}
  title={$t("dock.calendar")}
  aria-label={$t("dock.openCalendar")}
  aria-pressed={active}
  {onclick}
>
  <span class="text-xs font-medium tabular-nums">{time}</span>

  <span class="text-2xs font-normal text-base-content/60">{date}</span>
</button>
