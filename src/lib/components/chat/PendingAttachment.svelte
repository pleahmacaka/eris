<script lang="ts">
import Icon from "@iconify/svelte"

type Props = {
  name: string
  size: number
  preview: string | null
  progress: number | null
  locked: boolean
  onremove: () => void
}

let { name, size, preview, progress, locked, onremove }: Props = $props()

import { i18n } from "#lib/i18n/i18n.svelte.js"
</script>

<div
  class={[
    "relative flex h-16 shrink-0 items-center overflow-hidden rounded-field border",
    "border-base-content/25 bg-base-300 shadow-sm",
  ]}
>
  {#if preview}
    <img src={preview} alt={name} title={name} class="size-16 object-cover" />
  {:else}
    <div class="flex w-48 items-center gap-2 pe-8 ps-3">
      <Icon icon="lucide:file" class="size-6 shrink-0 text-muted" />
      <div class="min-w-0">
        <p class="truncate text-sm" title={name}>{name}</p>
        <p class="text-muted text-xs">{i18n.format.fileSize(size)}</p>
      </div>
    </div>
  {/if}

  {#if progress !== null}
    <progress
      class="progress progress-primary absolute inset-x-0 bottom-0 h-1 rounded-none"
      value={progress}
      max="1"
      aria-label={i18n.t("chat.attachment.uploading", { name })}
    ></progress>
  {:else if !locked}
    <button
      type="button"
      class="btn btn-circle btn-xs absolute top-1 end-1"
      aria-label={i18n.t("chat.attachment.removeNamed", { name })}
      title={i18n.t("chat.attachment.remove")}
      onclick={onremove}
    >
      <Icon icon="lucide:x" class="size-3" />
    </button>
  {/if}
</div>
