<script lang="ts">
  import Icon from "@iconify/svelte"
  import { type Meters, systemMeters } from "$lib/native"

  type Props = {
    showMeters: boolean
    showNetwork: boolean
    compact?: boolean
  }

  let { showMeters, showNetwork, compact = false }: Props = $props()

  const POLL = 3_000
  const IDLE_POLL = 30_000

  let meters = $state<Meters | null>(null)

  const refresh = async () => {
    meters = await systemMeters().catch(() => null)
  }

  $effect(() => {
    refresh()

    const timer = setInterval(refresh, showMeters ? POLL : IDLE_POLL)

    return () => clearInterval(timer)
  })

  const percent = (ratio: number) => Math.round(ratio * 100)

  const gb = (mb: number) => `${(mb / 1024).toFixed(1)} GB`

  const cpu = $derived(percent(meters?.cpu ?? 0))

  const ram = $derived(percent(meters?.memory ?? 0))

  const usageLabel = $derived.by(() => {
    if (!meters) {
      return ""
    }

    const used = `${gb(meters.memoryUsedMb)} of ${gb(meters.memoryTotalMb)}`

    return `CPU ${cpu}% · RAM ${ram}% · ${used}`
  })

  const network = $derived(meters?.network ?? null)

  const networkIcon = $derived(
    !network || !network.connected || network.kind === "none"
      ? "lucide:wifi-off"
      : network.kind === "ethernet"
        ? "lucide:ethernet-port"
        : "lucide:wifi",
  )

  const networkLabel = $derived(
    !network || !network.connected ? "No network" : network.name || "Connected",
  )
</script>

{#if meters}
  <div class="flex items-center gap-0.5">
    {#if showMeters}
      <div
        class="flex items-center gap-1 rounded-field px-1.5 py-1 text-xs tabular-nums text-base-content/80"
        title={usageLabel}
      >
        <Icon icon="lucide:cpu" class="size-4" />

        {#if !compact}
          <span>CPU {cpu}% · RAM {ram}%</span>
        {/if}
      </div>
    {/if}

    {#if showNetwork}
      <div
        class="flex items-center rounded-field px-1.5 py-1 text-base-content/80"
        title={networkLabel}
        aria-label={networkLabel}
        role="status"
      >
        <Icon icon={networkIcon} class="size-4" />
      </div>
    {/if}
  </div>
{/if}
