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
  let mounted = $state(false)

  onMount(() => {
    mounted = true
  })

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
  class="stage relative aspect-video w-full overflow-hidden"
  bind:clientWidth={width}
>
  {#if studio && mounted}
    <div
      class={["absolute top-0 left-0 origin-top-left", still && "pointer-events-none"]}
      inert={still}
      style:width="{SCREEN.width}px"
      style:height="{SCREEN.height}px"
      style:transform="scale({scale})"
    >
      {#each frames as frame (frame.path)}
        {@const src = previewUrl(studio, frame.path, appearance, device)}

        {#key src}
          <iframe
            {title}
            {src}
            class="absolute"
            style:top="{frame.top}px"
            style:left="{frame.left}px"
            style:width="{frame.width}px"
            style:height="{frame.height}px"
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

<style>
  .stage {
    background-color: var(--color-base-300);
    background-image:
      radial-gradient(
        60% 50% at 20% 10%,
        color-mix(in oklch, var(--color-primary) 22%, transparent),
        transparent 70%
      ),
      radial-gradient(
        50% 60% at 90% 90%,
        color-mix(in oklch, var(--color-secondary) 16%, transparent),
        transparent 70%
      );
  }

  iframe {
    border: 0;
    background: transparent;
    color-scheme: normal;
  }
</style>
