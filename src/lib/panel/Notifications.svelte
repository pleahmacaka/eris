<script lang="ts">
  import Icon from "@iconify/svelte"
  import { emit } from "@tauri-apps/api/event"
  import { locale, t } from "svelte-i18n"
  import * as native from "$lib/native"

  const POLL = 5_000
  const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ]

  let notices = $state<native.Notice[]>([])
  let now = $state(Date.now())

  const refresh = async () => {
    notices = await native.noticesList().catch(() => notices)
    now = Date.now()
  }

  $effect(() => {
    native.noticesSeen().catch(() => undefined)
    refresh().then(() => emit("notices-changed"))

    const timer = setInterval(refresh, POLL)

    return () => clearInterval(timer)
  })

  const appName = (id: string) => {
    const head = id.split("!")[0] ?? id
    const leaf = head.split("\\").pop() ?? head
    const stem = leaf.endsWith(".exe") ? leaf.slice(0, -4) : leaf
    const family = stem.split("_")[0] ?? stem

    return family.split(".").pop() || family
  }

  const groups = $derived.by(() => {
    const map = new Map<string, native.Notice[]>()

    for (const notice of notices) {
      const list = map.get(notice.app) ?? []

      list.push(notice)
      map.set(notice.app, list)
    }

    return [...map.entries()]
  })

  const ago = (at: number) => {
    const gap = now - at
    const unit = UNITS.find(([, ms]) => gap >= ms)
    const format = new Intl.RelativeTimeFormat($locale ?? "en", { numeric: "auto" })

    return unit ? format.format(-Math.floor(gap / unit[1]), unit[0]) : format.format(0, "minute")
  }

  const dismiss = async (ids: number[]) => {
    await native.noticesDismiss(ids).catch(() => undefined)
    notices = notices.filter(notice => !ids.includes(notice.id))
    emit("notices-changed").catch(() => undefined)
  }
</script>

<div class="flex items-center justify-between gap-2">
  <h2 class="text-sm font-semibold">{$t("panel.notifications.title")}</h2>

  <div class="flex items-center gap-1">
    <button
      type="button"
      class="btn btn-ghost btn-xs"
      title={$t("panel.notifications.focusAssist")}
      onclick={() => native.openUrl("ms-settings:quiethours")}
    >
      <Icon icon="lucide:moon-star" class="size-3.5" />
    </button>

    <button
      type="button"
      class="btn btn-ghost btn-xs"
      title={$t("panel.notifications.settings")}
      onclick={() => native.openUrl("ms-settings:notifications")}
    >
      <Icon icon="lucide:settings-2" class="size-3.5" />
    </button>

    {#if notices.length > 0}
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        onclick={() => dismiss(notices.map(notice => notice.id))}
      >
        {$t("panel.notifications.clearAll")}
      </button>
    {/if}
  </div>
</div>

{#if notices.length === 0}
  <p class="px-2 py-3 text-sm text-base-content/45">{$t("panel.notifications.empty")}</p>
{:else}
  <ul class="mt-2 flex flex-col gap-2">
    {#each groups as [app, items] (app)}
      <li class="rounded-field bg-base-content/5 p-2">
        <div class="flex items-center justify-between gap-2 px-1">
          <span class="truncate text-xs font-medium text-base-content/70">{appName(app)}</span>

          <button
            type="button"
            class="btn btn-ghost btn-circle btn-xs"
            aria-label={$t("panel.notifications.dismissApp", { values: { app: appName(app) } })}
            onclick={() => dismiss(items.map(notice => notice.id))}
          >
            <Icon icon="lucide:x" class="size-3" />
          </button>
        </div>

        <ul class="mt-1 flex flex-col gap-1">
          {#each items as notice (notice.id)}
            <li class="group flex items-start gap-2 rounded-field px-1 py-1 hover:bg-base-content/5">
              <div class="min-w-0 grow">
                {#if notice.title}
                  <p class="truncate text-sm font-medium">{notice.title}</p>
                {/if}

                {#if notice.body}
                  <p class="line-clamp-3 text-sm whitespace-pre-line text-base-content/70">{notice.body}</p>
                {/if}

                <p class="text-xs text-base-content/45">{ago(notice.arrived)}</p>
              </div>

              <button
                type="button"
                class="btn btn-ghost btn-circle btn-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={$t("panel.notifications.dismiss")}
                onclick={() => dismiss([notice.id])}
              >
                <Icon icon="lucide:x" class="size-3" />
              </button>
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ul>
{/if}
