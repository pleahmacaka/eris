<script lang="ts">
  import Icon from "@iconify/svelte"
  import { loadDevice, onDevice } from "@eris/settings"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { t } from "svelte-i18n"
  import EditOptions from "$lib/dock/EditOptions.svelte"
  import { DockLayout } from "$lib/dock/layout.svelte"
  import { stopEdit } from "$lib/edit"
  import * as native from "$lib/native"
  import { listMonitors, type MonitorInfo } from "$lib/native/windows"

  const GAP = 64

  document.documentElement.dataset.surface = "edit"

  const layout = new DockLayout()

  let monitors = $state<MonitorInfo[]>([])
  let origin = $state({ x: 0, y: 0 })
  let innerHeight = $state(0)

  const device = $derived(layout.device)

  const home = $derived.by(() => {
    const target =
      monitors.find(m => m.id === device.dockMonitor) ??
      monitors.find(m => m.primary) ??
      monitors[0]

    if (!target) {
      return null
    }

    const ratio = window.devicePixelRatio || 1

    return {
      left: (target.x - origin.x) / ratio,
      top: (target.y - origin.y) / ratio,
      width: target.width / ratio,
      height: target.height / ratio,
    }
  })

  const describe = (m: MonitorInfo) => `${m.name} (${m.width}×${m.height})`

  $effect(() => {
    native.editRaise().catch(() => undefined)

    loadDevice()
      .then(d => {
        layout.device = d
      })
      .catch(() => undefined)

    listMonitors()
      .then(list => {
        monitors = list
      })
      .catch(() => undefined)

    getCurrentWindow()
      .outerPosition()
      .then(p => {
        origin = { x: p.x, y: p.y }
      })
      .catch(() => undefined)

    const stop = onDevice(d => {
      if (!layout.scrubbing) {
        layout.device = d
      }
    })

    return () => {
      stop.then(off => off())
    }
  })
</script>

<svelte:window bind:innerHeight onkeydown={e => e.key === "Escape" && stopEdit()} />

<div
  role="presentation"
  class="relative h-full w-full bg-black/55"
  onclick={stopEdit}
>
  {#if home}
    <div
      role="dialog"
      aria-label={$t("edit.title")}
      tabindex="-1"
      class="eris-card absolute flex w-[44rem] max-w-[calc(100vw-2rem)] flex-col gap-3 p-4"
      style:left="{home.left + home.width / 2}px"
      style:top={device.dockEdge === "top" ? undefined : `${home.top + GAP}px`}
      style:bottom={device.dockEdge === "top"
        ? `${innerHeight - (home.top + home.height) + GAP}px`
        : undefined}
      style:translate="-50% 0"
      onclick={e => e.stopPropagation()}
      onkeydown={e => e.stopPropagation()}
    >
      <header class="flex items-start gap-3">
        <Icon icon="lucide:pencil-ruler" class="mt-0.5 size-5 shrink-0 text-primary" />

        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-semibold">{$t("edit.title")}</h2>

          <p class="text-xs text-base-content/60">{$t("edit.hint")}</p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <button type="button" class="btn btn-ghost btn-sm" onclick={layout.addSpacer}>
            <Icon icon="lucide:plus" class="size-3.5" />
            {$t("dock.addSpacer")}
          </button>

          <button type="button" class="btn btn-ghost btn-sm" onclick={layout.resetWidgets}>
            <Icon icon="lucide:rotate-ccw" class="size-3.5" />
            {$t("dock.resetLayout")}
          </button>

          <button type="button" class="btn btn-primary btn-sm" onclick={stopEdit}>
            {$t("edit.done")}
          </button>
        </div>
      </header>

      <section class="border-t border-base-content/10 pt-3">
        <h3 class="mb-1 text-xs font-semibold text-base-content/60">
          {$t("edit.panel")}
        </h3>

        {#if monitors.length > 1}
          <div class="flex items-center justify-between gap-3 py-1 text-xs">
            <span>{$t("settings.rows.display")}</span>

            <select
              class="select select-xs w-56"
              aria-label={$t("settings.rows.display")}
              value={device.dockMonitor ?? ""}
              onchange={e => layout.patch("dockMonitor", e.currentTarget.value || null)}
            >
              <option value="">{$t("settings.dock.automatic")}</option>

              {#each monitors as m (m.id)}
                <option value={m.id}>{describe(m)}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-x-6">
          <EditOptions {layout} kind="apps" />
        </div>
      </section>
    </div>
  {/if}
</div>
