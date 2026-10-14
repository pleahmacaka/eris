<script lang="ts">
  import { t } from "svelte-i18n"
  import WheelColumn from "./WheelColumn.svelte"

  const {
    value,
    label,
    onchange,
  }: {
    value: string
    label: string
    onchange: (value: string) => void
  } = $props()

  const id = $props.id()

  const pad = (n: number) => String(n).padStart(2, "0")

  const hour = $derived(Number(value.slice(0, 2)))
  const minute = $derived(Number(value.slice(3, 5)))

  let open = $state(false)
</script>

<button
  type="button"
  popovertarget="time-{id}"
  aria-label={label}
  class="min-w-0 grow cursor-pointer text-left tabular-nums outline-none"
  style:anchor-name="--time-{id}"
>
  {value}
</button>

<div
  id="time-{id}"
  popover
  class={[
    "dropdown flex gap-1 rounded-box border border-base-content/10",
    "bg-base-100 p-2 shadow-lg",
  ]}
  style:position-anchor="--time-{id}"
  style:position-try-fallbacks="flip-block"
  ontoggle={e => (open = e.newState === "open")}
>
  {#if open}
    <WheelColumn
      count={24}
      selected={hour}
      label={$t("panel.event.hour")}
      pick={next => onchange(`${pad(next)}:${pad(minute)}`)}
    />

    <WheelColumn
      count={60}
      selected={minute}
      label={$t("panel.event.minute")}
      pick={next => onchange(`${pad(hour)}:${pad(next)}`)}
    />
  {/if}
</div>
