<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { fromIcs, toIcs } from "$lib/data/ics"
  import { events } from "$lib/data/store"
  import type { CalendarEvent } from "$lib/data/types"
  import { toast } from "@eris/ui"

  type Props = { list: CalendarEvent[] }

  let { list }: Props = $props()

  let open = $state(false)
  let busy = $state(false)
  let picker = $state<HTMLInputElement>()

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

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
      toast($t("panel.ics.exported", { values: { count: list.length } }), "success")
    } catch (error) {
      toast(message(error), "error")
    }
  }

  const copy = async () => {
    open = false

    try {
      await navigator.clipboard.writeText(toIcs(list))
      toast($t("panel.ics.copied"), "success")
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
          ? $t("panel.ics.noEvents")
          : $t("panel.ics.imported", { values: { count: parsed.length } }),
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
    aria-label={$t("panel.ics.options")}
    title={$t("panel.ics.options")}
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

        {$t("panel.ics.import")}
      </button>
    </li>

    <li>
      <button type="button" onclick={download} {onkeydown}>
        <Icon icon="lucide:download" class="size-4" />

        {$t("panel.ics.export")}
      </button>
    </li>

    <li>
      <button type="button" onclick={copy} {onkeydown}>
        <Icon icon="lucide:clipboard-copy" class="size-4" />

        {$t("panel.ics.copy")}
      </button>
    </li>
  </ul>
</details>

<input
  bind:this={picker}
  type="file"
  accept="text/calendar,.ics"
  class="sr-only"
  aria-label={$t("panel.ics.importFile")}
  onchange={onpick}
  oncancel={() => picker?.blur()}
/>
