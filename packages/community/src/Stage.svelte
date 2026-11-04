<script module lang="ts">
  import type { Surface } from "./copy"

  export type Frame = {
    path: string
    width: number
    height: number
    top: number
    left: number
  }

  export const SCREEN = { width: 1280, height: 720 }

  const DOCK_HEIGHT = 48

  const centered = (path: string, width: number, height: number): Frame => ({
    path,
    width,
    height,
    top: (SCREEN.height - DOCK_HEIGHT - height) / 2,
    left: (SCREEN.width - width) / 2,
  })

  export const FRAMES: Record<Surface, Frame[]> = {
    desktop: [
      centered("./", 680, 420),
      {
        path: "taskbar",
        width: SCREEN.width,
        height: DOCK_HEIGHT,
        top: SCREEN.height - DOCK_HEIGHT,
        left: 0,
      },
    ],
    files: [centered("files", 1040, 600)],
    terminal: [centered("terminal", 960, 560)],
  }

  const MAC_DOCK_WIDTH = 720

  const MAC_DOCK: Frame = {
    path: "taskbar",
    width: MAC_DOCK_WIDTH,
    height: DOCK_HEIGHT,
    top: SCREEN.height - DOCK_HEIGHT - 12,
    left: (SCREEN.width - MAC_DOCK_WIDTH) / 2,
  }
</script>

<script lang="ts">
  import type { Appearance, DeviceSettings } from "@eris/settings"
  import { onMount } from "svelte"
  import { previewUrl } from "./support"

  let {
    studio,
    appearance,
    device,
    surface,
    title,
    unavailable,
    still = false,
  }: {
    studio?: string
    appearance: Partial<Appearance>
    device?: Partial<DeviceSettings>
    surface: Surface
    title: string
    unavailable: string
    still?: boolean
  } = $props()

  let width = $state(0)
  let rem = $state(16)
  let mounted = $state(false)

  onMount(() => {
    rem =
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
      16
    mounted = true
  })

  const percent = (part: number, whole: number) => `${(part / whole) * 100}%`

  const scale = $derived(width / SCREEN.width)

  const frames = $derived(
    device?.dockStyle === "mac"
      ? FRAMES[surface].map(frame =>
          frame.path === "taskbar" ? MAC_DOCK : frame,
        )
      : FRAMES[surface],
  )
</script>

<div
  class="relative aspect-video w-full overflow-hidden bg-base-300"
  bind:clientWidth={width}
>
  <div
    aria-hidden="true"
    class={[
      "absolute inset-0 bg-radial-[60%_50%_at_20%_10%]",
      "from-primary/22 to-transparent to-70%",
    ]}
  ></div>
  <div
    aria-hidden="true"
    class={[
      "absolute inset-0 bg-radial-[50%_60%_at_90%_90%]",
      "from-secondary/16 to-transparent to-70%",
    ]}
  ></div>

  {#if studio && mounted}
    <div
      class={["absolute top-0 left-0 origin-top-left", still && "pointer-events-none"]}
      inert={still}
      style:width="{SCREEN.width / rem}rem"
      style:height="{SCREEN.height / rem}rem"
      style:transform="scale({scale})"
    >
      {#each frames as frame (frame.path)}
        {@const src = previewUrl(studio, frame.path, appearance, device)}

        {#key src}
          <iframe
            {title}
            {src}
            class="absolute scheme-normal"
            style:top={percent(frame.top, SCREEN.height)}
            style:left={percent(frame.left, SCREEN.width)}
            style:width={percent(frame.width, SCREEN.width)}
            style:height={percent(frame.height, SCREEN.height)}
            loading="lazy"
          ></iframe>
        {/key}
      {/each}
    </div>
  {:else if !studio}
    <p
      class="absolute inset-0 m-auto flex items-center justify-center p-4 text-center text-sm text-base-content/60"
    >
      {unavailable}
    </p>
  {/if}
</div>
