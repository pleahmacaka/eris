<script lang="ts">
  import Icon from "@iconify/svelte"
  import * as native from "$lib/native"
  import type { DockEdge } from "$lib/settings"

  type Props = {
    volume: native.Volume
    edge?: DockEdge
    onmenu?: (height: number) => void
    onchange: (volume: native.Volume) => void
  }

  let { volume, edge = "bottom", onmenu, onchange }: Props = $props()

  const STEP = 0.05
  const POPOVER_GAP = 16

  let open = $state(false)
  let popover = $state<HTMLElement>()
  let devices = $state<native.AudioDevice[]>([])
  let switching = $state<string | null>(null)

  const setOpen = (next: boolean) => {
    if (open === next) {
      return
    }

    open = next

    if (next) {
      loadDevices()
    } else {
      onmenu?.(0)
    }
  }

  $effect(() => {
    if (open && popover) {
      onmenu?.(popover.offsetHeight + POPOVER_GAP)
    }
  })

  const loadDevices = async () => {
    devices = await native.audioDevices().catch(() => [])
  }

  const level = $derived(Math.round(volume.level * 100))

  const icon = $derived.by(() => {
    if (volume.muted) {
      return "lucide:volume-x"
    }

    if (volume.level <= 0) {
      return "lucide:volume"
    }

    return volume.level < 0.5 ? "lucide:volume-1" : "lucide:volume-2"
  })

  const label = $derived(volume.muted ? "Muted" : `Volume ${level}%`)

  const apply = async (next: number) => {
    const clamped = Math.min(1, Math.max(0, Math.round(next * 100) / 100))

    onchange({ level: clamped, muted: false })
    await native.setVolume(clamped).catch(() => undefined)
  }

  const onslide = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement

    apply(Number(input.value) / 100)
  }

  const toggleMute = async () => {
    onchange({ ...volume, muted: !volume.muted })
    await native.toggleMute().catch(() => undefined)
  }

  const onwheel = (e: WheelEvent) => {
    e.preventDefault()
    apply(volume.level + (e.deltaY < 0 ? STEP : -STEP))
  }

  const pick = async (device: native.AudioDevice) => {
    if (device.default) {
      return
    }

    switching = device.id
    await native.setAudioDevice(device.id).catch(() => undefined)
    await loadDevices()
    switching = null
  }

  const onmousedown = (e: MouseEvent) => {
    if (open && !(e.target as Element).closest("[data-volume]")) {
      setOpen(false)
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (open && e.key === "Escape") {
      setOpen(false)
    }
  }
</script>

<svelte:window {onmousedown} {onkeydown} />

<div class="relative" data-volume>
  <button
    class={["btn btn-ghost btn-square btn-sm", volume.muted && "text-base-content/50"]}
    title={label}
    aria-label={label}
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={() => setOpen(!open)}
    oncontextmenu={e => {
      e.preventDefault()
      toggleMute()
    }}
    {onwheel}
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
      aria-label="Sound"
    >
      <div class="flex items-center gap-2">
        <button
          class="btn btn-ghost btn-square btn-sm"
          aria-label={volume.muted ? "Unmute" : "Mute"}
          onclick={toggleMute}
        >
          <Icon {icon} class="size-4" />
        </button>

        <input
          type="range"
          class="range range-primary range-xs grow"
          min="0"
          max="100"
          value={level}
          aria-label="Volume"
          oninput={onslide}
        />

        <span class="w-9 shrink-0 text-right text-xs tabular-nums text-base-content/70">
          {level}%
        </span>
      </div>

      <div class="mt-3 border-t border-base-content/10 pt-2">
        <p class="px-1 pb-1 text-xs text-base-content/50">Output device</p>

        {#if devices.length === 0}
          <p class="px-1 py-2 text-xs text-base-content/40">기기 없음</p>
        {:else}
          <ul class="max-h-40 space-y-0.5 overflow-y-auto">
            {#each devices as device (device.id)}
              <li>
                <button
                  type="button"
                  class={[
                    "flex w-full items-center gap-2 rounded-field px-2 py-1.5 text-left text-xs transition-colors duration-150",
                    device.default
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-base-content/10",
                  ]}
                  disabled={switching !== null}
                  onclick={() => pick(device)}
                >
                  <Icon
                    icon={device.default ? "lucide:check" : "lucide:speaker"}
                    class="size-3.5 shrink-0"
                  />

                  <span class="truncate">{device.name}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>
