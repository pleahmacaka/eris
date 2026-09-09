<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { type Meters, runCommand, systemMeters } from "$lib/native"
  import type { DockEdge } from "$lib/settings"
  import Network from "./Network.svelte"

  type Props = {
    showMeters: boolean
    showNetwork: boolean
    compact?: boolean
    edge?: DockEdge
    onmenu?: (height: number) => void
  }

  let {
    showMeters,
    showNetwork,
    compact = false,
    edge = "bottom",
    onmenu,
  }: Props = $props()

  const POLL = 3_000
  const IDLE_POLL = 10_000

  let meters = $state<Meters | null>(null)

  const refresh = async () => {
    meters = await systemMeters().catch(() => null)
  }

  $effect(() => {
    refresh()

    const timer = setInterval(refresh, showMeters ? POLL : IDLE_POLL)

    return () => clearInterval(timer)
  })

  const DOUBLE_CLICK = 250
  const POPOVER_GAP = 16

  let detail = $state(false)
  let popover = $state<HTMLElement>()
  let clickTimer: ReturnType<typeof setTimeout> | undefined

  const setDetail = (next: boolean) => {
    if (detail === next) {
      return
    }

    detail = next

    if (!next) {
      onmenu?.(0)
    }
  }

  $effect(() => {
    if (detail && popover) {
      onmenu?.(popover.offsetHeight + POPOVER_GAP)
    }
  })

  const onclick = () => {
    clearTimeout(clickTimer)
    clickTimer = setTimeout(() => setDetail(!detail), DOUBLE_CLICK)
  }

  const ondblclick = () => {
    clearTimeout(clickTimer)
    setDetail(false)
    runCommand("taskmgr").catch(() => undefined)
  }

  const onmousedown = (e: MouseEvent) => {
    if (detail && !(e.target as Element).closest("[data-meters]")) {
      setDetail(false)
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (detail && e.key === "Escape") {
      setDetail(false)
    }
  }

  $effect(() => () => clearTimeout(clickTimer))

  const percent = (ratio: number) => Math.round(ratio * 100)

  const gb = (mb: number) => `${(mb / 1024).toFixed(1)} GB`

  const cpu = $derived(percent(meters?.cpu ?? 0))

  const ram = $derived(percent(meters?.memory ?? 0))

  const memoryLabel = $derived(
    meters
      ? $t("tray.meters.of", {
          values: { used: gb(meters.memoryUsedMb), total: gb(meters.memoryTotalMb) },
        })
      : "",
  )

  const usageLabel = $derived(
    meters ? `CPU ${cpu}% · RAM ${ram}% · ${memoryLabel}` : "",
  )

  const network = $derived(meters?.network ?? null)

  const networkLabel = $derived(
    !network || !network.connected
      ? $t("tray.network.none")
      : network.ssid || network.name || $t("tray.network.connected"),
  )
</script>

<svelte:window {onmousedown} {onkeydown} />

{#if meters}
  <div class="flex items-center gap-0.5" data-meters>
    {#if showMeters}
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-1 rounded-field px-1.5 py-1 text-xs tabular-nums text-base-content/80 transition-colors duration-150 hover:bg-base-content/10"
          title={detail ? undefined : usageLabel}
          aria-haspopup="dialog"
          aria-expanded={detail}
          {onclick}
          {ondblclick}
        >
          <Icon icon="lucide:cpu" class="size-4" />

          {#if !compact}
            <span>CPU {cpu}% · RAM {ram}%</span>
          {/if}
        </button>

        {#if detail}
          <div
            bind:this={popover}
            class={[
              "absolute right-0 z-50 w-64 rounded-box border border-base-content/10 bg-base-100/90 p-3 shadow-xl backdrop-blur-xl",
              edge === "top" ? "top-full mt-2" : "bottom-full mb-2",
            ]}
            role="dialog"
            aria-label={$t("tray.meters.title")}
          >
            <div class="space-y-3 text-xs">
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-base-content/70">CPU</span>

                  <span class="tabular-nums">{cpu}%</span>
                </div>

                <progress class="progress progress-primary mt-1 w-full" value={cpu} max="100"
                ></progress>
              </div>

              <div>
                <div class="flex items-center justify-between">
                  <span class="text-base-content/70">{$t("tray.meters.memory")}</span>

                  <span class="tabular-nums">{ram}%</span>
                </div>

                <progress class="progress progress-secondary mt-1 w-full" value={ram} max="100"
                ></progress>

                <p class="mt-1 text-base-content/55 tabular-nums">{memoryLabel}</p>
              </div>

              <div class="flex items-center justify-between border-t border-base-content/10 pt-2">
                <span class="text-base-content/70">{$t("tray.network.title")}</span>

                <span class="truncate pl-2 text-right">{networkLabel}</span>
              </div>

              <button
                type="button"
                class="btn btn-sm btn-block"
                onclick={() => {
                  setDetail(false)
                  runCommand("taskmgr").catch(() => undefined)
                }}
              >
                <Icon icon="lucide:activity" class="size-4" />

                {$t("tray.meters.taskManager")}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if showNetwork}
      <Network {network} {edge} {onmenu} onrefresh={refresh} />
    {/if}
  </div>
{/if}
