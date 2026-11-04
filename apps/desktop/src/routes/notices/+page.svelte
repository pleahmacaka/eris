<script lang="ts">
  import Icon from "@iconify/svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { listen } from "@tauri-apps/api/event"
  import { flip } from "svelte/animate"
  import { cubicOut } from "svelte/easing"
  import { fly } from "svelte/transition"
  import { t } from "svelte-i18n"
  import { type DeviceSettings, defaultDevice, onDevice } from "@eris/settings"
  import { ensureDevice } from "#lib/device.js"
  import { relativeTime } from "#lib/launcher/providers.js"
  import * as native from "#lib/native/index.js"
  import type { Notice } from "#lib/native/notices.js"

  const appWindow = getCurrentWindow()
  const BLUR_GRACE = 400
  const REVEAL_MS = 260
  const STAGGER_MS = 35
  const STAGGER_LIMIT = 8
  const EASE = "cubic-bezier(0.2, 0.9, 0.1, 1)"

  type Group = { app: string; notices: Notice[] }

  let items = $state<Notice[]>([])
  let device = $state<DeviceSettings>(defaultDevice)
  let now = $state(Date.now())
  let list = $state<HTMLElement>()
  let focusLanded = false
  let shownAt = 0

  const groups = $derived(
    items.reduce<Group[]>((all, notice) => {
      const group = all.find(g => g.app === notice.app)

      if (group) {
        group.notices.push(notice)
      } else {
        all.push({ app: notice.app, notices: [notice] })
      }

      return all
    }, []),
  )

  const calm = () => document.documentElement.dataset.motion === "false"

  const hue = (name: string) =>
    [...name].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 360, 7)

  const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? "?"

  const origin = () => {
    const x = { left: "left", center: "center", right: "right" }[
      device.panelPosition
    ]
    const y = device.dockEdge === "top" ? "top" : "bottom"

    return `${x} ${y}`
  }

  const reveal = () => {
    const shell = document.querySelector<HTMLElement>(".siri-shell")

    if (!shell || calm()) {
      return
    }

    const rise = device.dockEdge === "top" ? "-0.75rem" : "0.75rem"

    shell.style.transformOrigin = origin()
    shell.animate(
      [
        { transform: `translateY(${rise}) scale(0.96)` },
        { transform: "none" },
      ],
      { duration: REVEAL_MS, easing: EASE },
    )

    const rows = list?.querySelectorAll<HTMLElement>("[data-reveal]") ?? []

    rows.forEach((row, at) => {
      row.animate(
        [
          { opacity: 0, transform: `translateY(${rise})` },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: REVEAL_MS,
          delay: 60 + Math.min(at, STAGGER_LIMIT) * STAGGER_MS,
          easing: EASE,
          fill: "backwards",
        },
      )
    })
  }

  const leave = (node: Element) =>
    calm()
      ? { duration: 0 }
      : fly(node, { x: "2rem", duration: 140, easing: cubicOut })

  const refresh = async () => {
    items = await native.noticesList().catch(() => items)
    now = Date.now()
  }

  const hide = () => {
    focusLanded = false
    native.hideWindow("notices").catch(() => undefined)
  }

  const dismiss = async (ids: number[]) => {
    items = items.filter(notice => !ids.includes(notice.id))
    await native.noticesDismiss(ids).catch(() => undefined)
  }

  const activate = async (id: number) => {
    try {
      await native.noticesActivate(id)
      items = items.filter(notice => notice.id !== id)
    } catch {
      refresh()
    }
  }

  const dismissAll = () => dismiss(items.map(notice => notice.id))

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      hide()
    }
  }

  $effect(() => {
    ensureDevice()
      .then(next => {
        device = next
      })
      .catch(() => undefined)
    refresh()
    native.noticesSeen().catch(() => undefined)

    const tick = setInterval(() => {
      now = Date.now()
    }, 30_000)

    const stops = [
      onDevice(next => {
        device = next
      }),
      listen("notices-changed", refresh),
      native.onWindowShown("notices", async () => {
        focusLanded = false
        shownAt = Date.now()
        requestAnimationFrame(reveal)
        await refresh()
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
      clearInterval(tick)

      for (const stop of stops) {
        stop.then(fn => fn()).catch(() => undefined)
      }
    }
  })
</script>

<svelte:window {onkeydown} />

<main class="flex h-full min-h-0 flex-col">
  <header class="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
    <div class="flex items-center gap-2">
      <h2 class="text-base font-semibold tracking-tight">
        {$t("tray.notifications.title")}
      </h2>

      {#if items.length > 0}
        <span class="badge badge-primary badge-sm tabular-nums">
          {items.length}
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-0.5">
      {#if items.length > 0}
        <button
          class="btn btn-ghost btn-xs rounded-full"
          onclick={dismissAll}
        >
          <Icon icon="lucide:check-check" class="size-3.5" />
          {$t("panel.notifications.clearAll")}
        </button>
      {/if}

      <button
        class="btn btn-ghost btn-square btn-xs rounded-full"
        aria-label={$t("common.close")}
        onclick={hide}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </div>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5" bind:this={list}>
    {#if items.length === 0}
      <div
        class={[
          "flex h-full flex-col items-center justify-center gap-3",
          "text-base-content/40",
        ]}
        data-reveal
      >
        <div
          class={[
            "grid size-14 place-items-center rounded-full",
            "bg-base-content/5 inset-ring inset-ring-base-content/10",
          ]}
        >
          <Icon icon="lucide:bell-off" class="size-6" />
        </div>

        <p class="text-sm">{$t("panel.notifications.empty")}</p>
      </div>
    {:else}
      <ul class="flex flex-col gap-3">
        {#each groups as group (group.app)}
          <li class="flex flex-col gap-1.5" animate:flip={{ duration: 200 }} data-reveal>
            <div class="group/app flex items-center gap-2 px-1">
              <span
                class={[
                  "grid size-5 shrink-0 place-items-center rounded-full",
                  "text-2xs font-semibold text-white",
                ]}
                style:background-color="oklch(62% 0.14 {hue(group.app)})"
                aria-hidden="true"
              >
                {initial(group.app)}
              </span>

              <span class="min-w-0 flex-1 truncate text-xs font-medium text-base-content/70" title={group.app}>
                {group.app}
              </span>

              <button
                class={[
                  "btn btn-ghost btn-square btn-xs rounded-full",
                  "opacity-0 transition-opacity duration-140",
                  "group-hover/app:opacity-100 focus-visible:opacity-100",
                ]}
                aria-label={$t("panel.notifications.dismissApp", {
                  values: { app: group.app },
                })}
                onclick={() => dismiss(group.notices.map(notice => notice.id))}
              >
                <Icon icon="lucide:trash-2" class="size-3.5" />
              </button>
            </div>

            <ul class="flex flex-col gap-1">
              {#each group.notices as notice (notice.id)}
                <li
                  class={[
                    "group eris-card relative flex items-start gap-2 rounded-box",
                    "px-3.5 py-3 transition duration-140",
                    "hover:-translate-y-0.25 hover:inset-ring-base-content/20",
                  ]}
                  animate:flip={{ duration: 200 }}
                  out:leave
                >
                  <button
                    type="button"
                    class="min-w-0 flex-1 cursor-pointer text-left"
                    onclick={() => activate(notice.id)}
                  >
                    <div class="flex items-baseline justify-between gap-2">
                      <p class="min-w-0 truncate text-sm font-semibold" title={notice.title}>
                        {notice.title}
                      </p>

                      <span class="shrink-0 whitespace-nowrap text-2xs tabular-nums text-base-content/45">
                        {relativeTime(notice.arrived, now)}
                      </span>
                    </div>

                    {#if notice.body}
                      <p class="mt-1 line-clamp-3 text-xs leading-relaxed text-base-content/65">
                        {notice.body}
                      </p>
                    {/if}
                  </button>

                  <button
                    class={[
                      "btn btn-ghost btn-square btn-xs -mt-1 -mr-1.5 shrink-0 rounded-full",
                      "opacity-0 transition-opacity duration-140",
                      "group-hover:opacity-100 focus-visible:opacity-100",
                    ]}
                    aria-label={$t("panel.notifications.dismiss")}
                    onclick={() => dismiss([notice.id])}
                  >
                    <Icon icon="lucide:x" class="size-3.5" />
                  </button>
                </li>
              {/each}
            </ul>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</main>
