<script lang="ts">
import type { ClassValue } from "svelte/elements"
import { AVATAR_LARGE, AVATAR_THUMBNAIL } from "#lib/matrix/media.js"
import { roomInitial } from "#lib/matrix/rooms.js"
import { mediaStore } from "#lib/store/media.svelte.js"

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "fill"

type Tone = "primary" | "neutral" | "none"

type Props = {
  name: string
  mxc?: string | null
  size?: Size
  tone?: Tone
  class?: ClassValue
}

const SIZE_CLASS: Record<Size, string> = {
  xs: "size-6 rounded-lg text-2xs",
  sm: "size-8 rounded-field text-xs",
  md: "size-10 rounded-selector text-sm",
  lg: "size-12 rounded-2xl text-base",
  xl: "size-20 rounded-3xl text-3xl",
  fill: "size-full",
}

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary/20 text-primary",
  neutral: "bg-base-content/10 text-base-content/80",
  none: "",
}

let {
  name,
  mxc = null,
  size = "md",
  tone = "neutral",
  class: className = "",
}: Props = $props()

const spec = $derived(size === "xl" ? AVATAR_LARGE : AVATAR_THUMBNAIL)
const src = $derived(mediaStore.thumbnail(mxc, spec))

$effect(() => {
  if (mxc) {
    void mediaStore.loadThumbnail(mxc, spec)
  }
})
</script>

<span
  class={[
    "flex shrink-0 select-none items-center justify-center overflow-hidden font-semibold",
    SIZE_CLASS[size],
    TONE_CLASS[tone],
    className,
  ]}
  aria-hidden="true"
>
  {#if src}
    <img {src} alt="" class="size-full object-cover" decoding="sync" draggable="false" />
  {:else}
    {roomInitial(name)}
  {/if}
</span>
