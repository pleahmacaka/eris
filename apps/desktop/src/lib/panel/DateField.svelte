<script lang="ts">
  import "cally"
  import { parseLocal } from "@eris/data"
  import { currentLocale } from "@eris/i18n"
  import Icon from "@iconify/svelte"
  import { longDay } from "#lib/calendar/index.js"

  let {
    value,
    weekStart,
    label,
    onchange,
  }: {
    value: string
    weekStart: 0 | 1
    label: string
    onchange: (value: string) => void
  } = $props()

  const id = $props.id()

  let popover = $state<HTMLElement>()
  let calendar = $state<HTMLElementTagNameMap["calendar-date"]>()

  const pick = () => {
    if (calendar?.value) {
      onchange(calendar.value)
    }

    popover?.hidePopover()
  }
</script>

<button
  type="button"
  popovertarget="date-{id}"
  aria-label={label}
  class="input input-sm w-full cursor-pointer justify-start gap-2 tabular-nums"
  style:anchor-name="--date-{id}"
>
  <Icon icon="lucide:calendar-days" class="size-4 shrink-0 text-base-content/60" />

  <span class="truncate">{longDay(parseLocal(value))}</span>
</button>

<div
  bind:this={popover}
  id="date-{id}"
  popover
  class="dropdown rounded-box border border-base-content/10 bg-base-100 shadow-lg"
  style:position-anchor="--date-{id}"
  style:position-try-fallbacks="flip-block"
>
  <calendar-date
    bind:this={calendar}
    class="cally"
    {value}
    locale={currentLocale()}
    first-day-of-week={weekStart}
    onchange={pick}
  >
    <span slot="previous" class="flex" aria-hidden="true">
      <Icon icon="lucide:chevron-left" class="size-4" />
    </span>

    <span slot="next" class="flex" aria-hidden="true">
      <Icon icon="lucide:chevron-right" class="size-4" />
    </span>

    <calendar-month></calendar-month>
  </calendar-date>
</div>
