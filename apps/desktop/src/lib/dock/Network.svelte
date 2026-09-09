<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import {
    type NetworkInfo,
    openUrl,
    type RadioState,
    radios,
    setRadio,
  } from "$lib/native"
  import type { DockEdge } from "@eris/settings"

  type Props = {
    network: NetworkInfo | null
    edge?: DockEdge
    onmenu?: (height: number) => void
    onrefresh?: () => void
  }

  let { network, edge = "bottom", onmenu, onrefresh }: Props = $props()

  const POPOVER_GAP = 16
  const SETTLE = 1_500

  let open = $state(false)
  let popover = $state<HTMLElement>()
  let radio = $state<RadioState | null>(null)
  let busy = $state(false)
  let error = $state("")

  const readRadio = async () => {
    const list = await radios().catch(() => [])

    radio = list.find(r => r.kind === "wifi")?.state ?? null
  }

  const setOpen = (next: boolean) => {
    if (open === next) {
      return
    }

    open = next
    error = ""

    if (next) {
      readRadio()
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

    await setRadio("wifi", on).catch((reason: unknown) => {
      error = String(reason)
    })

    await readRadio()
    busy = false

    setTimeout(() => onrefresh?.(), SETTLE)
  }

  const go = (url: string) => {
    setOpen(false)
    openUrl(url).catch(() => undefined)
  }

  const onmousedown = (e: MouseEvent) => {
    if (open && !(e.target as Element).closest("[data-network]")) {
      setOpen(false)
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (open && e.key === "Escape") {
      setOpen(false)
    }
  }

  const online = $derived(Boolean(network?.connected) && network?.kind !== "none")

  const icon = $derived.by(() => {
    if (!network || !online) {
      return "lucide:wifi-off"
    }

    if (network.kind === "ethernet") {
      return "lucide:ethernet-port"
    }

    if (network.signal >= 4) {
      return "lucide:wifi"
    }

    if (network.signal === 3) {
      return "lucide:wifi-high"
    }

    return network.signal >= 1 ? "lucide:wifi-low" : "lucide:wifi-zero"
  })

  const title = $derived.by(() => {
    if (!network || !online) {
      return $t("tray.network.none")
    }

    const name = network.ssid || network.name || $t("tray.network.connected")

    return network.kind === "wifi"
      ? `${name} · ${$t("tray.network.signal", { values: { bars: network.signal } })}`
      : name
  })

  const errorText = $derived.by(() => {
    if (!error) {
      return ""
    }

    if (error === "denied-user" || error === "denied-system") {
      return $t(`tray.network.${error === "denied-user" ? "deniedUser" : "deniedSystem"}`)
    }

    if (error === "missing") {
      return $t("tray.network.noRadio")
    }

    return $t("tray.network.radioFailed")
  })
</script>

<svelte:window {onmousedown} {onkeydown} />

<div class="relative" data-network>
  <button
    type="button"
    class={["btn btn-ghost btn-square btn-sm", !online && "text-base-content/50"]}
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
      aria-label={$t("tray.network.title")}
    >
      <div class="flex items-center gap-3">
        <Icon {icon} class="size-5 shrink-0 text-base-content/70" />

        <div class="min-w-0 grow">
          <p class="flex items-center gap-2 truncate text-sm font-medium">
            {online ? network?.ssid || network?.name || $t("tray.network.connected") : $t("tray.network.none")}

            <span class="badge badge-soft badge-info badge-xs">{$t("common.partial")}</span>
          </p>

          {#if online && network?.kind === "wifi"}
            <div class="mt-1 flex items-end gap-0.5" aria-hidden="true">
              {#each [1, 2, 3, 4, 5] as bar (bar)}
                <span
                  class={[
                    "w-1 rounded-full",
                    bar <= network.signal ? "bg-primary" : "bg-base-content/15",
                  ]}
                  style:height="{bar * 0.15 + 0.15}rem"
                ></span>
              {/each}

              <span class="ml-1 text-2xs text-base-content/55">
                {$t("tray.network.signal", { values: { bars: network.signal } })}
              </span>
            </div>
          {:else if online}
            <p class="text-xs text-base-content/55">{$t("tray.network.ethernet")}</p>
          {/if}
        </div>
      </div>

      {#if radio !== null}
        <label class="mt-3 flex items-center justify-between border-t border-base-content/10 pt-3 text-xs">
          <span>{$t("tray.network.wifi")}</span>

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
      {/if}

      <div class="mt-3 grid gap-1 border-t border-base-content/10 pt-3">
        <button
          type="button"
          class="btn btn-sm btn-block justify-start"
          onclick={() => go("ms-availablenetworks:")}
        >
          <Icon icon="lucide:wifi" class="size-4" />

          {$t("tray.network.available")}
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-sm btn-block justify-start"
          onclick={() => go("ms-settings:network")}
        >
          <Icon icon="lucide:settings-2" class="size-4" />

          {$t("tray.network.settings")}
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-sm btn-block justify-start"
          onclick={() => go("ms-settings:network-airplanemode")}
        >
          <Icon icon="lucide:plane" class="size-4" />

          {$t("tray.network.airplane")}
        </button>
      </div>
    </div>
  {/if}
</div>
