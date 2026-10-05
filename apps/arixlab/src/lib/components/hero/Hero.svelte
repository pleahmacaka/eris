<script lang="ts">
import Icon from "@iconify/svelte/dist/OfflineIcon.svelte"
import type { Attachment } from "svelte/attachments"
import { on } from "svelte/events"
import Clock from "$lib/components/hud/Clock.svelte"
import LocaleSwitch from "$lib/components/locale/LocaleSwitch.svelte"
import ProjectList from "$lib/components/projects/ProjectList.svelte"
import { OPERATOR } from "$lib/data/nodes"
import { scramble } from "$lib/motion/scramble"
import * as m from "$lib/paraglide/messages"
import { localizeHref } from "$lib/paraglide/runtime"
import PipeMark from "./PipeMark.svelte"

let pointer = $state<{ x: number; y: number } | null>(null)

const track: Attachment<HTMLElement> = node => {
  const stopMove = on(node, "pointermove", e => {
    if (e.pointerType !== "mouse") {
      return
    }

    const rect = node.getBoundingClientRect()

    pointer = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  })

  const stopLeave = on(node, "pointerleave", () => {
    pointer = null
  })

  return () => {
    stopMove()
    stopLeave()
  }
}

const readout = $derived(
  pointer
    ? `X ${pointer.x.toFixed(3)} Y ${pointer.y.toFixed(3)}`
    : "X ----- Y -----",
)
</script>

<section
  class="relative isolate flex min-h-dvh flex-col overflow-hidden"
  {@attach track}
>
  <div class="grid-lines absolute inset-0 -z-10"></div>
  <div class="vignette absolute inset-0 -z-10"></div>

  {#if pointer}
    <div
      class={[
        "pointer-events-none absolute inset-y-0 -z-10",
        "border-primary/25 border-l",
      ]}
      style="left: {pointer.x * 100}%"
    ></div>
    <div
      class={[
        "pointer-events-none absolute inset-x-0 -z-10",
        "border-primary/25 border-t",
      ]}
      style="top: {pointer.y * 100}%"
    ></div>
  {/if}

  <div
    class="hud pointer-events-none absolute inset-4 sm:inset-6"
    style="--hud-len: 2rem"
  ></div>

  <div
    class={[
      "absolute inset-x-7 top-7 flex items-center justify-between gap-4",
      "text-xs sm:inset-x-10 sm:top-9",
    ]}
  >
    <img class="h-4 w-auto" src="/logo.svg" width="132" height="160" alt="" />

    <LocaleSwitch />
  </div>

  <div
    class={[
      "absolute inset-x-7 bottom-7 flex items-center justify-between gap-4",
      "text-base-content/60 text-xs tabular-nums sm:inset-x-10 sm:bottom-9",
    ]}
  >
    <a
      class="flex items-center gap-2 transition hover:text-primary"
      href={localizeHref(OPERATOR.profile)}
    >
      <Icon class="size-3.5" icon="lucide:user-round" />
      {OPERATOR.handle}
    </a>

    <span class="hidden gap-6 sm:flex">
      <Clock />
      <span>{readout}</span>
    </span>
  </div>

  <div
    class="flex flex-1 flex-col items-center justify-center gap-6 py-16"
  >
    <PipeMark />

    <p
      class={[
        "px-8 text-center font-medium text-base-content/70 text-xl",
        "tracking-tight sm:text-2xl",
      ]}
      use:scramble={{ delay: 400 }}
    >
      {m.hero_personal()}
    </p>

    <div class="mt-2 flex w-full justify-center px-5">
      <ProjectList />
    </div>
  </div>
</section>
