<script lang="ts">
import { asciiPipes } from "$lib/ascii/pipes"
import { scramble } from "$lib/motion/scramble"
import { SITE_NAME } from "$lib/site"

let title: HTMLElement

let gap = $state(0)

let cooling = true

$effect(() => {
  const timer = setTimeout(() => {
    cooling = false
  }, 1100)

  return () => clearTimeout(timer)
})

const rescramble = () => {
  if (cooling) {
    return
  }

  cooling = true
  title.textContent = SITE_NAME
  scramble(title, { duration: 600 })

  setTimeout(() => {
    cooling = false
  }, 800)
}
</script>

<div
  class={[
    "relative flex w-full items-center justify-center",
    "h-44 sm:h-72 lg:h-88",
  ]}
>
  {#if gap > 0}
    <canvas
      class="absolute inset-0 size-full"
      aria-hidden="true"
      {@attach asciiPipes(gap)}
    ></canvas>
  {/if}

  <h1
    class={[
      "relative cursor-default select-none px-3 font-extrabold leading-none",
      "text-6xl tracking-tight sm:px-5 sm:text-8xl lg:text-10xl",
    ]}
    bind:this={title}
    bind:clientWidth={gap}
    onpointerenter={rescramble}
    use:scramble={{ duration: 900 }}
  >
    {SITE_NAME}
  </h1>
</div>
