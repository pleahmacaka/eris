<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { openUrl } from "$lib/native/system"
  import { bluetoothDevices, type RadioState, radios, setRadio } from "$lib/native/quick"
  import type { DockEdge } from "@eris/settings"
  import { dockAwake } from "./dock.svelte"

  type Props = {
    edge?: DockEdge
    onmenu?: (height: number) => void
    onvisible?: (visible: boolean) => void
  }

  let { edge = "bottom", onmenu, onvisible }: Props = $props()

  const POLL = 15_000
  const POPOVER_GAP = 16

  let radio = $state<RadioState | null>(null)
  let devices = $state<string[]>([])
  let busy = $state(false)
  let error = $state("")

  const refresh = async () => {
    const list = await radios().catch(() => [])

    radio = list.find(r => r.kind === "bluetooth")?.state ?? null
    devices = radio === "on" ? await bluetoothDevices().catch(() => []) : []
  }

  $effect(() => {
    if (!dockAwake.visible) {
      return
    }

    refresh()

    const timer = setInterval(refresh, POLL)

    return () => clearInterval(timer)
  })

  $effect(() => {
    onvisible?.(radio !== null)
  })

  let open = $state(false)
  let popover = $state<HTMLElement>()

  const setOpen = (next: boolean) => {
    if (open === next) {
      return
    }

    open = next
    error = ""

    if (next) {
      refresh()
    } else {
      onmenu?.(0)
    }
  }

  $effect(() => {
    if (open && popover) {
      onmenu?.(popover.offsetHeight + POPOVER_GAP)
    }
  })

  const toggleRadio = async (on: boolean) => {
    busy = true
    error = ""

    await setRadio("bluetooth", on).catch((reason: unknown) => {
      error = String(reason)
    })

    await refresh()
    busy = false
  }

  const go = (url: string) => {
    setOpen(false)
    openUrl(url).catch(() => undefined)
  }

  const onmousedown = (e: MouseEvent) => {
    if (open && !(e.target as Element).closest("[data-bluetooth]")) {
      setOpen(false)
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (open && e.key === "Escape") {
      setOpen(false)
    }
  }

  const icon = $derived(
    radio !== "on"
      ? "lucide:bluetooth-off"
      : devices.length > 0
        ? "lucide:bluetooth-connected"
        : "lucide:bluetooth",
  )

  const title = $derived.by(() => {
    if (radio !== "on") {
      return $t("tray.bluetooth.off")
    }

    return devices.length > 0
      ? devices.join(", ")
      : $t("tray.bluetooth.noDevices")
  })

  const errorText = $derived.by(() => {
    if (!error) {
      return ""
    }

    if (error === "denied-user" || error === "denied-system") {
      return $t(`tray.network.${error === "denied-user" ? "deniedUser" : "deniedSystem"}`)
    }

    return $t("tray.network.radioFailed")
  })
</script>

<svelte:window {onmousedown} {onkeydown} />

{#if radio !== null}
  <div class="relative" data-bluetooth>
    <button
      type="button"
      class={["btn btn-ghost btn-square btn-sm", radio !== "on" && "text-base-content/50"]}
      {title}
      aria-label={title}
      aria-haspopup="dialog"
      aria-expanded={open}
      onclick={() => setOpen(!open)}
    >
      <Icon {icon} class="size-4" />
    </button>

    {#if open}
      <div
        bind:this={popover}
        class={[
          "absolute right-0 z-50 w-72 rounded-box border border-base-content/10 bg-base-100/90 p-3 shadow-xl backdrop-blur-xl",
          edge === "top" ? "top-full mt-2" : "bottom-full mb-2",
        ]}
        role="dialog"
        aria-label={$t("tray.bluetooth.title")}
      >
        <label class="flex items-center justify-between text-sm">
          <span class="flex items-center gap-2 font-medium">
            <Icon {icon} class="size-4 text-base-content/70" />

            {$t("tray.bluetooth.title")}

            <span class="badge badge-soft badge-info badge-xs">{$t("common.partial")}</span>
          </span>

          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            checked={radio === "on"}
            disabled={busy || radio === "disabled"}
            onchange={e => toggleRadio(e.currentTarget.checked)}
          />
        </label>

        {#if errorText}
          <p class="mt-1 text-xs text-error" role="alert">{errorText}</p>
        {/if}

        <div class="mt-3 border-t border-base-content/10 pt-2">
          <p class="px-1 pb-1 text-xs text-base-content/50">{$t("tray.bluetooth.connected")}</p>

          {#if radio !== "on"}
            <p class="px-1 py-2 text-xs text-base-content/40">{$t("tray.bluetooth.off")}</p>
          {:else if devices.length === 0}
            <p class="px-1 py-2 text-xs text-base-content/40">{$t("tray.bluetooth.noDevices")}</p>
          {:else}
            <ul class="max-h-40 space-y-0.5 overflow-y-auto">
              {#each devices as name (name)}
                <li class="flex items-center gap-2 rounded-field px-2 py-1.5 text-xs">
                  <Icon icon="lucide:bluetooth-connected" class="size-3.5 shrink-0 text-primary" />

                  <span class="truncate">{name}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div class="mt-3 grid gap-1 border-t border-base-content/10 pt-3">
          <button
            type="button"
            class="btn btn-sm btn-block justify-start"
            onclick={() => go("ms-settings:connecteddevices")}
          >
            <Icon icon="lucide:plus" class="size-4" />

            {$t("tray.bluetooth.addDevice")}
          </button>

          <button
            type="button"
            class="btn btn-ghost btn-sm btn-block justify-start"
            onclick={() => go("ms-settings:bluetooth")}
          >
            <Icon icon="lucide:settings-2" class="size-4" />

            {$t("tray.bluetooth.settings")}
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}
