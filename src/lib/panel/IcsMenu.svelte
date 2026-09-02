<script lang="ts">
  import Icon from "@iconify/svelte"
  import { fromIcs, toIcs } from "$lib/data/ics"
  import { events } from "$lib/data/store"
  import type { CalendarEvent } from "$lib/data/types"
  import { toast } from "$lib/settings-ui/toast.svelte"

  type Props = { list: CalendarEvent[] }

  let { list }: Props = $props()

  let open = $state(false)
  let busy = $state(false)
  let picker = $state<HTMLInputElement>()

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const count = (n: number) => `${n} ${n === 1 ? "event" : "events"}`

  const download = () => {
    open = false

    try {
      const blob = new Blob([toIcs(list)], { type: "text/calendar" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")

      link.href = url
      link.download = "eris.ics"
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast(`Exported ${count(list.length)}`, "success")
    } catch (error) {
      toast(message(error), "error")
    }
  }

  const copy = async () => {
    open = false

    try {
      await navigator.clipboard.writeText(toIcs(list))
      toast("Calendar copied to the clipboard", "success")
    } catch (error) {
      toast(message(error), "error")
    }
  }

  const pick = () => {
    open = false
    picker?.focus()
    picker?.click()
  }

  const onpick = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]

    input.value = ""
    input.blur()

    if (!file) {
      return
    }

    busy = true

    try {
      const parsed = fromIcs(await file.text())

      await events.putMany(parsed)

      toast(
        parsed.length === 0
          ? "No events found"
          : `Imported ${count(parsed.length)}`,
        parsed.length === 0 ? "info" : "success",
      )
    } catch (error) {
      toast(message(error), "error")
    } finally {
      busy = false
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation()
      open = false
    }
  }
</script>

<details class="dropdown dropdown-end" bind:open>
  <summary
    class="btn btn-ghost btn-square btn-sm"
    {onkeydown}
    aria-label="Calendar options"
    title="Calendar options"
  >
    {#if busy}
      <span class="loading loading-spinner loading-xs"></span>
    {:else}
      <Icon icon="lucide:more-horizontal" class="size-4" />
    {/if}
  </summary>

  <ul
    class="menu dropdown-content z-30 w-48 gap-0.5 rounded-box border border-base-content/10 bg-base-100 p-1.5 shadow-lg"
  >
    <li>
      <button type="button" onclick={pick} {onkeydown}>
        <Icon icon="lucide:upload" class="size-4" />

        Import .ics
      </button>
    </li>

    <li>
      <button type="button" onclick={download} {onkeydown}>
        <Icon icon="lucide:download" class="size-4" />

        Export .ics
      </button>
    </li>

    <li>
      <button type="button" onclick={copy} {onkeydown}>
        <Icon icon="lucide:clipboard-copy" class="size-4" />

        Copy .ics
      </button>
    </li>
  </ul>
</details>

<input
  bind:this={picker}
  type="file"
  accept="text/calendar,.ics"
  class="sr-only"
  aria-label="Import calendar file"
  onchange={onpick}
  oncancel={() => picker?.blur()}
/>
