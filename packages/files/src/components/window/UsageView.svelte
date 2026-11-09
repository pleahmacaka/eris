<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { listen } from "@tauri-apps/api/event"
  import { t } from "svelte-i18n"
  import { formatBytes } from "../../format"
  import {
    randomToken,
    type Usage,
    usageForget,
    usageScan,
    usageTree,
  } from "../../native"

  type Segment = {
    key: string
    trail: string[]
    node: Usage
    path: string
    tone: number
    depth: number
  }

  let { path, expected = 0 }: { path: string; expected?: number } = $props()

  const RINGS = 4
  const INNER = 52
  const OUTER = 158
  const TONES = [250, 25, 150, 310, 80, 195, 350, 120].map(
    hue => `oklch(0.68 0.14 ${hue})`,
  )

  const token = randomToken()

  let phase = $state<"scanning" | "ready" | "failed">("scanning")
  let scanned = $state({ files: 0, bytes: 0 })
  let root = $state<Usage | null>(null)
  let current = $state<Usage | null>(null)
  let trail = $state<string[]>([])
  let hovered = $state<Segment | null>(null)

  const locale = $derived(currentLocale())
  const count = $derived(new Intl.NumberFormat(locale))
  const percent = $derived(new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }))

  const point = (radius: number, angle: number) =>
    `${(radius * Math.sin(angle)).toFixed(2)} ${(-radius * Math.cos(angle)).toFixed(2)}`

  const arc = (inner: number, outer: number, from: number, to: number) => {
    const span = Math.min(to - from, Math.PI * 2 - 0.0001)
    const end = from + span
    const large = span > Math.PI ? 1 : 0

    return [
      `M ${point(outer, from)}`,
      `A ${outer} ${outer} 0 ${large} 1 ${point(outer, end)}`,
      `L ${point(inner, end)}`,
      `A ${inner} ${inner} 0 ${large} 0 ${point(inner, from)}`,
      "Z",
    ].join(" ")
  }

  const ring = (depth: number) => {
    const width = (OUTER - INNER) / RINGS

    return [INNER + width * (depth - 1) + 1, INNER + width * depth]
  }

  const segments = $derived.by(() => {
    const found: Segment[] = []

    const place = (node: Usage, at: string[], from: number, to: number, depth: number, tone: number) => {
      if (depth > RINGS || node.size === 0) {
        return
      }

      let start = from

      node.children.forEach((child, index) => {
        const span = ((to - from) * child.size) / node.size
        const childTone = depth === 1 ? index : tone
        const childTrail = [...at, child.name]

        if (span > 0.01) {
          const [inner, outer] = ring(depth)

          found.push({
            key: childTrail.join("/"),
            trail: childTrail,
            node: child,
            path: arc(inner, outer, start, start + span),
            tone: childTone,
            depth,
          })
          place(child, childTrail, start, start + span, depth + 1, childTone)
        }

        start += span
      })
    }

    if (current) {
      place(current, trail, 0, Math.PI * 2, 1, 0)
    }

    return found
  })

  const focus = $derived(hovered?.node ?? current)

  const open = (next: string[]) => {
    hovered = null
    trail = next
  }

  $effect(() => {
    const stop = listen<{ token: number; files: number; bytes: number }>("usage-progress", e => {
      if (e.payload.token === token) {
        scanned = { files: e.payload.files, bytes: e.payload.bytes }
      }
    })

    usageScan(path, token)
      .then(found => {
        if (found) {
          root = found
          current = found
          phase = "ready"
        }
      })
      .catch(() => {
        phase = "failed"
      })

    return () => {
      stop.then(unlisten => unlisten())
      usageForget(token).catch(() => undefined)
    }
  })

  $effect(() => {
    const wanted = trail

    if (!root) {
      return
    }

    if (wanted.length === 0) {
      current = root

      return
    }

    usageTree(token, wanted)
      .then(found => {
        if (found && trail === wanted) {
          current = found
        }
      })
      .catch(() => undefined)
  })
</script>

{#if phase === "scanning"}
  <div class="flex flex-col items-center gap-3 py-16 text-sm">
    <span class="font-medium">{$t("explorer.usage.scanning")}</span>

    {#if expected > 0}
      <progress class="progress progress-primary w-64" value={scanned.bytes} max={expected}></progress>
    {:else}
      <progress class="progress progress-primary w-64"></progress>
    {/if}

    <span class="text-base-content/60 tabular-nums">
      {$t("explorer.usage.counted", {
        values: { files: count.format(scanned.files), size: formatBytes(scanned.bytes, locale) },
      })}
    </span>
  </div>
{:else if phase === "failed" || !current}
  <div class="flex flex-col items-center gap-2 py-16 text-sm text-base-content/60">
    <Icon icon="lucide:circle-alert" class="size-6" />
    {$t("explorer.usage.failed")}
  </div>
{:else}
  <nav class="flex flex-wrap items-center gap-0.5 text-sm" aria-label={$t("explorer.usage.location")}>
    <button type="button" class="btn btn-ghost btn-xs" disabled={trail.length === 0} onclick={() => open([])}>
      {root?.name}
    </button>

    {#each trail as name, index (index)}
      <Icon icon="lucide:chevron-right" class="size-3.5 text-base-content/40" />
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        disabled={index === trail.length - 1}
        onclick={() => open(trail.slice(0, index + 1))}
      >
        {name}
      </button>
    {/each}
  </nav>

  <div class="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
    <svg
      viewBox="-160 -160 320 320"
      class="size-80 shrink-0"
      role="img"
      aria-label={$t("explorer.usage.chart")}
    >
      {#each segments as segment (segment.key)}
        <path
          d={segment.path}
          fill={TONES[segment.tone % TONES.length]}
          fill-opacity={hovered?.key === segment.key ? 1 : 0.95 - segment.depth * 0.17}
          stroke="var(--color-base-100)"
          stroke-width="1"
          class={segment.node.folder ? "cursor-pointer" : ""}
          role="presentation"
          onmouseenter={() => (hovered = segment)}
          onmouseleave={() => (hovered = null)}
          onclick={() => segment.node.folder && open(segment.trail)}
        />
      {/each}

      <circle
        r={INNER - 2}
        fill="var(--color-base-200)"
        class={trail.length > 0 ? "cursor-pointer" : ""}
        role="presentation"
        onclick={() => trail.length > 0 && open(trail.slice(0, -1))}
      />

      <text text-anchor="middle" y="-4" class="fill-base-content text-xs font-semibold">
        {(focus?.name ?? "").slice(0, 18)}
      </text>
      <text text-anchor="middle" y="14" class="fill-base-content/60 text-xs tabular-nums">
        {formatBytes(focus?.size ?? 0, locale)}
      </text>
    </svg>

    <ul class="flex max-h-80 min-w-0 flex-1 flex-col gap-0.5 self-stretch overflow-y-auto">
      {#each current.children as child, index (child.name)}
        <li>
          <button
            type="button"
            class="flex w-full flex-col gap-1 rounded-field px-2 py-1.5 text-left hover:bg-base-content/5"
            disabled={!child.folder}
            onclick={() => open([...trail, child.name])}
          >
            <span class="flex items-center gap-2 text-sm">
              <span
                class="size-2.5 shrink-0 rounded-full"
                style:background-color={TONES[index % TONES.length]}
              ></span>
              <span class="min-w-0 flex-1 truncate">{child.name}</span>
              <span class="text-base-content/60 tabular-nums">{formatBytes(child.size, locale)}</span>
            </span>

            <progress class="progress h-1 w-full" value={child.size} max={current.size}></progress>

            <span class="flex gap-3 text-xs text-base-content/50 tabular-nums">
              <span>{percent.format(current.size ? child.size / current.size : 0)}</span>
              <span>{$t("explorer.usage.files", { values: { count: count.format(child.files) } })}</span>
            </span>
          </button>
        </li>
      {/each}

      {#if current.rest > 0}
        <li class="flex items-center gap-2 px-2 py-1.5 text-sm text-base-content/60">
          <span class="size-2.5 shrink-0 rounded-full bg-base-content/20"></span>
          <span class="min-w-0 flex-1 truncate">{$t("explorer.usage.rest")}</span>
          <span class="tabular-nums">{formatBytes(current.rest, locale)}</span>
        </li>
      {/if}
    </ul>
  </div>
{/if}
