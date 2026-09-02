<script lang="ts">
  type Props = {
    clock24h: boolean
    showSeconds: boolean
    active?: boolean
    onclick: () => void
  }

  let { clock24h, showSeconds, active = false, onclick }: Props = $props()

  let now = $state(new Date())

  $effect(() => {
    const timer = setInterval(() => {
      now = new Date()
    }, 1000)

    return () => clearInterval(timer)
  })

  const time = $derived(
    now.toLocaleTimeString("en-US", {
      hour: clock24h ? "2-digit" : "numeric",
      minute: "2-digit",
      second: showSeconds ? "2-digit" : undefined,
      hour12: !clock24h,
    }),
  )

  const date = $derived(
    now.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
  )
</script>

<button
  class={[
    "btn btn-ghost h-auto min-h-0 flex-col items-end gap-0 rounded-field px-2.5 py-1 leading-tight",
    active && "bg-base-content/10",
  ]}
  title="Calendar"
  aria-label="Open calendar"
  aria-pressed={active}
  {onclick}
>
  <span class="text-xs font-medium tabular-nums">{time}</span>

  <span class="text-[11px] font-normal text-base-content/60">{date}</span>
</button>
