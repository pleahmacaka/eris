<script lang="ts">
  import Icon from "@iconify/svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { listen } from "@tauri-apps/api/event"
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import { ensureDevice } from "$lib/device"
  import * as native from "$lib/native"
  import type { Notice } from "$lib/native/notices"

  const appWindow = getCurrentWindow()
  const BLUR_GRACE = 400

  let items = $state<Notice[]>([])
  let focusLanded = false
  let shownAt = 0

  const refresh = async () => {
    items = await native.noticesList().catch(() => items)
  }

  const hide = () => {
    focusLanded = false
    native.hideWindow("notices").catch(() => undefined)
  }

  const dismiss = async (id: number) => {
    items = items.filter(notice => notice.id !== id)
    await native.noticesDismiss([id]).catch(() => undefined)
  }

  const dismissAll = async () => {
    const ids = items.map(notice => notice.id)

    items = []
    await native.noticesDismiss(ids).catch(() => undefined)
  }

  const when = (arrived: number) =>
    new Date(arrived).toLocaleString(currentLocale(), {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      hide()
    }
  }

  $effect(() => {
    ensureDevice().catch(() => undefined)
    refresh()
    native.noticesSeen().catch(() => undefined)

    const stops = [
      listen("notices-changed", refresh),
      native.onWindowShown("notices", () => {
        focusLanded = false
        shownAt = Date.now()
        refresh()
        native.noticesSeen().catch(() => undefined)
      }),
      appWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) {
          if (!focusLanded) {
            focusLanded = true
            shownAt = Date.now()
          }

          return
        }

        if (focusLanded && Date.now() - shownAt >= BLUR_GRACE) {
          hide()
        }
      }),
    ]

    return () => {
      for (const stop of stops) {
        stop.then(fn => fn()).catch(() => undefined)
      }
    }
  })
</script>

<svelte:window {onkeydown} />

<main class="flex h-full min-h-0 flex-col">
  <header
    class="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-2.5"
  >
    <h2 class="text-[0.9375rem] font-semibold tracking-tight">
      {$t("tray.notifications.title")}
    </h2>

    <div class="flex items-center gap-1">
      {#if items.length > 0}
        <button class="btn btn-xs btn-ghost" onclick={dismissAll}>
          {$t("tray.notifications.clearAll")}
        </button>
      {/if}

      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("common.close")}
        onclick={hide}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </div>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#if items.length === 0}
      <div
        class="flex h-full flex-col items-center justify-center gap-2 text-base-content/40"
      >
        <Icon icon="lucide:bell-off" class="size-7" />
        <p class="text-sm">{$t("tray.notifications.empty")}</p>
      </div>
    {:else}
      <ul class="flex flex-col gap-1">
        {#each items as notice (notice.id)}
          <li
            class="group flex items-start gap-2.5 rounded-field border border-base-content/10 bg-base-100/60 px-3 py-2.5"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <span class="truncate text-xs font-medium text-base-content/60">
                  {notice.app}
                </span>

                <span class="shrink-0 text-2xs tabular-nums text-base-content/40">
                  {when(notice.arrived)}
                </span>
              </div>

              <p class="mt-0.5 truncate text-sm font-medium">{notice.title}</p>

              {#if notice.body}
                <p class="mt-0.5 line-clamp-2 text-xs text-base-content/60">
                  {notice.body}
                </p>
              {/if}
            </div>

            <button
              class="btn btn-ghost btn-square btn-xs shrink-0 opacity-0 group-hover:opacity-100"
              aria-label={$t("tray.notifications.dismiss")}
              onclick={() => dismiss(notice.id)}
            >
              <Icon icon="lucide:x" class="size-3.5" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</main>
