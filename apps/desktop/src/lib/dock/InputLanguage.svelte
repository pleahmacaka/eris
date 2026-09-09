<script lang="ts">
  import { t } from "svelte-i18n"
  import { openUrl } from "$lib/native/system"
  import { cycleInputLanguage, type InputLanguage, inputLanguage } from "$lib/native/quick"
  import { dockAwake } from "./dock.svelte"

  type Props = {
    compact?: boolean
    onvisible?: (visible: boolean) => void
  }

  let { compact = false, onvisible }: Props = $props()

  const POLL = 1_000
  const SETTLE = 150

  let info = $state<InputLanguage | null>(null)

  const refresh = async () => {
    info = await inputLanguage().catch(() => null)
  }

  $effect(() => {
    if (!dockAwake.visible) {
      return
    }

    refresh()

    const timer = setInterval(refresh, POLL)

    return () => clearInterval(timer)
  })

  const cycle = async () => {
    await cycleInputLanguage().catch(() => undefined)

    setTimeout(refresh, SETTLE)
  }

  const visible = $derived(Boolean(info && info.layouts >= 2))

  $effect(() => {
    onvisible?.(visible)
  })

  const title = $derived(
    info ? $t("tray.input.title", { values: { label: info.label } }) : "",
  )
</script>

{#if info && visible}
  <button
    type="button"
    class={[
      "btn btn-ghost min-w-8 px-1.5 font-medium tabular-nums",
      compact ? "btn-xs text-2xs" : "btn-sm text-xs",
    ]}
    {title}
    aria-label={title}
    onclick={cycle}
    oncontextmenu={e => {
      e.preventDefault()
      openUrl("ms-settings:regionlanguage").catch(() => undefined)
    }}
  >
    {info.label}
  </button>
{/if}
