<script lang="ts">
  import type { DeviceSettings, DockStyle } from "@eris/settings"

  type Props = {
    device: DeviceSettings
    style?: DockStyle
  }

  let { device, style }: Props = $props()

  const SCALE = 1.6
  const SCREEN_WIDTH = 1920
  const SCREEN_HEIGHT = 1080
  const APPS = [0, 1, 2, 3, 4, 5]

  const dockStyle = $derived(style ?? device.dockStyle)
  const mac = $derived(dockStyle === "mac")
  const uchiwa = $derived(dockStyle === "uchiwa")

  const top = $derived(device.dockEdge === "top")

  const start = $derived(!uchiwa && device.dockAlign === "start")

  const heightPct = $derived(
    device.dockAutoHide ? 1.5 : (device.dockHeight / SCREEN_HEIGHT) * 100 * SCALE,
  )

  const iconPct = $derived(
    Math.min(85, Math.max(30, (device.dockIconSize / device.dockHeight) * 100)),
  )

  const widthPct = $derived(
    mac || uchiwa
      ? Math.min(92, (device.dockWidth / SCREEN_WIDTH) * 100 * SCALE)
      : 100,
  )

  const FAN_STEP = 18
  const FAN_MID = (APPS.length - 1) / 2

  const blade = (index: number) => {
    const deg = (index - FAN_MID) * FAN_STEP
    const angle = (deg * Math.PI) / 180

    return {
      deg,
      x: Math.sin(angle) * 42,
      y: (1 - Math.cos(angle)) * 55,
      fade: 1 - Math.abs(deg) / 130,
    }
  }
</script>

{#snippet apps(list: number[])}
  {#each list as app (app)}
    <span
      class={["aspect-square shrink-0 bg-primary/70", mac ? "rounded-full" : "rounded-xs"]}
      style:height="{iconPct}%"
    ></span>
  {/each}
{/snippet}

{#snippet launcher()}
  <span
    class="aspect-square shrink-0 rounded-full bg-secondary"
    style:height="{iconPct}%"
  ></span>
{/snippet}

<div
  class="relative aspect-video w-full overflow-hidden rounded-field bg-linear-to-br from-primary/20 to-secondary/20 ring-1 ring-base-content/10"
  aria-hidden="true"
>
  <div
    class={[
      "absolute flex items-center border border-base-content/10 bg-base-100/85 transition-all duration-100",
      mac || uchiwa ? "left-1/2 -translate-x-1/2 rounded-full px-1" : "inset-x-0 px-1",
      top ? (mac || uchiwa ? "top-1" : "top-0") : mac || uchiwa ? "bottom-1" : "bottom-0",
      start ? "justify-start" : "justify-center",
    ]}
    style:height="{heightPct}%"
    style:width="{widthPct}%"
  >
    {#if !device.dockAutoHide}
      {#if uchiwa}
        <span class="flex h-full items-center">
          {@render launcher()}
        </span>

        <span class="relative mx-3 h-full w-2/5">
          {#each APPS as app (app)}
            {@const pose = blade(app)}

            <span
              class="absolute bottom-0 left-1/2 aspect-square rounded-full bg-primary/70"
              style:height="{iconPct}%"
              style:transform="translate(-50%, 0) translate({pose.x}px, {-pose.y}px) rotate({pose.deg}deg)"
              style:opacity={pose.fade}
            ></span>
          {/each}
        </span>
      {:else}
        <span class="flex h-full items-center gap-0.5">
          {@render launcher()}

          <span class="mx-0.5 h-3/5 w-px bg-base-content/15"></span>

          {@render apps(APPS)}
        </span>
      {/if}

      <span
        class="absolute right-1 h-2/5 rounded-full bg-base-content/25"
        style:width="{mac || uchiwa ? 10 : 7}%"
      ></span>
    {/if}
  </div>
</div>
