<script lang="ts">
import Icon from "@iconify/svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { mediaStore } from "#lib/store/media.svelte.js"

type Props = {
  file: File | null
  name: string
  label: string
  mxc?: string | null
  disabled?: boolean
}

let {
  file = $bindable(),
  name,
  label,
  mxc = null,
  disabled = false,
}: Props = $props()

const IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp"

let input = $state<HTMLInputElement>()
let preview = $state<string | null>(null)
let error = $state<Message | null>(null)

const limit = $derived(mediaStore.uploadLimit)
const filled = $derived(preview !== null || mxc !== null)

$effect(() => {
  if (!file) {
    preview = null

    return
  }

  const url = URL.createObjectURL(file)

  preview = url

  return () => URL.revokeObjectURL(url)
})

const pick = (event: Event & { currentTarget: HTMLInputElement }) => {
  const picked = event.currentTarget.files?.[0]

  event.currentTarget.value = ""

  if (!picked) {
    return
  }

  if (limit !== null && picked.size > limit) {
    error = {
      key: "ui.image.tooLarge",
      values: { limit: i18n.format.fileSize(limit) },
    }

    return
  }

  error = null
  file = picked
}
</script>

<div class="flex flex-col items-center gap-2">
  <button
    type="button"
    class={[
      "relative flex size-20 cursor-pointer items-center justify-center rounded-full",
      "text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-50",
      !filled && "border-2 border-base-content/30 border-dashed hover:border-primary",
    ]}
    aria-label={label}
    title={label}
    {disabled}
    onclick={() => input?.click()}
  >
    {#if preview}
      <img src={preview} alt="" class="size-full rounded-full object-cover" draggable="false" />
    {:else if mxc}
      <Avatar {name} {mxc} size="fill" tone="primary" class="rounded-full text-3xl" />
    {:else}
      <span class="flex flex-col items-center gap-0.5">
        <Icon icon="lucide:camera" class="size-6" />
        <span class="font-bold text-2xs">{i18n.t("ui.image.upload")}</span>
      </span>
    {/if}
    <span
      class={[
        "absolute -top-0.5 -end-0.5 flex size-6 items-center justify-center rounded-full",
        "bg-primary text-primary-content",
      ]}
      aria-hidden="true"
    >
      <Icon icon="lucide:plus" class="size-4" />
    </span>
  </button>
  <input
    bind:this={input}
    type="file"
    accept={IMAGE_TYPES}
    class="hidden"
    aria-label={label}
    {disabled}
    onchange={pick}
  />
  {#if error}
    <p class="text-center text-error text-xs" role="alert">{i18n.text(error)}</p>
  {/if}
</div>
