<script lang="ts">
  import Icon from "@iconify/svelte"
  import { http } from "$lib/http"
  import { type ClaudeUsage, claudeUsage } from "$lib/native"

  type Props = {
    source?: string
    compact?: boolean
  }

  let { source = "", compact = false }: Props = $props()

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

    return hours > 0 ? `${hours}시간 ${minutes % 60}분 남음` : `${minutes}분 남음`
  }

  const label = $derived.by(() => {
    if (!usage) {
      return "Claude 사용량 미측정"
    }

    const parts = [
      usage.fiveHour && `5시간 ${percent(usage.fiveHour.used)}%`,
      usage.sevenDay && `주간 ${percent(usage.sevenDay.used)}%`,
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
    <Icon icon="lucide:sparkles" class="size-3.5 shrink-0 text-primary/80" />

    <div class="flex items-center gap-1.5">
      {#each [["5h", usage.fiveHour], ["7d", usage.sevenDay]] as const as [name, window] (name)}
        {#if window}
          <div class="flex items-center gap-1">
            {#if !compact}
              <span class="text-[10px] text-base-content/50">{name}</span>
            {/if}

            <span class="h-1 w-8 overflow-hidden rounded-full bg-base-content/15">
              <span
                class={["block h-full rounded-full", tone(window.used)]}
                style:width="{percent(window.used)}%"
              ></span>
            </span>

            <span class="tabular-nums text-[11px]">{percent(window.used)}%</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}
