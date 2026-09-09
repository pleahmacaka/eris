<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { claudeIcon } from "$lib/claude"
  import { http } from "$lib/http"
  import { type ClaudeUsage, claudeUsage } from "$lib/native/usage"

  type Props = {
    source?: string
    compact?: boolean
    stacked?: boolean
  }

  let { source = "", compact = false, stacked = false }: Props = $props()

  const POLL = 60_000

  let usage = $state<ClaudeUsage | null>(null)

  const remote = $derived(source.trim().startsWith("http"))

  const refresh = async () => {
    if (remote) {
      usage = await http
        .get<ClaudeUsage>(source.trim())
        .then(response => response.data)
        .catch(() => null)

      return
    }

    usage = await claudeUsage(source.trim() || null).catch(() => null)
  }

  $effect(() => {
    refresh()

    const timer = setInterval(refresh, POLL)

    return () => clearInterval(timer)
  })

  const percent = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

  const tone = (value: number) =>
    value >= 90 ? "bg-error" : value >= 70 ? "bg-warning" : "bg-primary"

  const countdown = (iso: string | null) => {
    if (!iso) {
      return ""
    }

    const left = new Date(iso).getTime() - Date.now()

    if (!Number.isFinite(left) || left <= 0) {
      return ""
    }

    const minutes = Math.floor(left / 60_000)
    const hours = Math.floor(minutes / 60)

    return hours > 0
      ? $t("tray.claude.leftHours", { values: { hours, minutes: minutes % 60 } })
      : $t("tray.claude.leftMinutes", { values: { minutes } })
  }

  const label = $derived.by(() => {
    if (!usage) {
      return $t("tray.claude.unmeasured")
    }

    const parts = [
      usage.fiveHour &&
        $t("tray.claude.fiveHour", { values: { percent: percent(usage.fiveHour.used) } }),
      usage.sevenDay &&
        $t("tray.claude.weekly", { values: { percent: percent(usage.sevenDay.used) } }),
      usage.fiveHour && countdown(usage.fiveHour.resetsAt),
    ].filter(Boolean)

    return parts.join(" · ")
  })
</script>

{#if usage?.fiveHour || usage?.sevenDay}
  <div
    class="flex items-center gap-1.5 rounded-field px-2 py-1 text-xs text-base-content/80"
    title={label}
    aria-label={label}
    role="status"
  >
    <Icon icon={claudeIcon} class="size-3.5 shrink-0 text-primary/80" />

    <div class={["flex", stacked ? "flex-col gap-0.5" : "items-center gap-1.5"]}>
      {#each [["5h", usage.fiveHour], ["7d", usage.sevenDay]] as const as [name, window] (name)}
        {#if window}
          <div class={["flex items-center gap-1", stacked && "leading-none"]}>
            {#if !compact || stacked}
              <span class="w-4 text-3xs text-base-content/50">{name}</span>
            {/if}

            <span class="h-1 w-8 overflow-hidden rounded-full bg-base-content/15">
              <span
                class={["block h-full rounded-full", tone(window.used)]}
                style:width="{percent(window.used)}%"
              ></span>
            </span>

            <span class={["tabular-nums", stacked ? "text-3xs" : "text-2xs"]}>{percent(window.used)}%</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}
