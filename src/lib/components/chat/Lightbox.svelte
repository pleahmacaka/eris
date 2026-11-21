<script lang="ts">
import Icon from "@iconify/svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { saveBlob } from "#lib/media/download.js"
import { mediaStore } from "#lib/store/media.svelte.js"

type Props = {
  mxc: string
  name: string
  preview: string | null
  onclose: () => void
}

let { mxc, name, preview, onclose }: Props = $props()

let dialog = $state<HTMLDialogElement>()
let original = $state.raw<{ blob: Blob; url: string } | null>(null)
let failed = $state(false)

$effect(() => {
  dialog?.showModal()
})

$effect(() => {
  let cancelled = false
  let url: string | null = null

  mediaStore.download(mxc).then(
    blob => {
      if (!cancelled) {
        url = URL.createObjectURL(blob)
        original = { blob, url }
      }
    },
    () => {
      failed = true
    },
  )

  return () => {
    cancelled = true

    if (url) {
      URL.revokeObjectURL(url)
    }
  }
})
</script>

<dialog
  bind:this={dialog}
  class="modal bg-base-300/90 backdrop-blur-sm"
  aria-label={name}
  {onclose}
>
  <div class="flex size-full flex-col gap-3 p-4">
    <div class="flex shrink-0 items-center gap-2">
      <p class="min-w-0 flex-1 truncate font-semibold text-sm" title={name}>{name}</p>
      {#if failed}
        <p class="text-error text-sm" role="alert">
          {i18n.t("chat.lightbox.loadFailed")}
        </p>
      {/if}
      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm"
        aria-label={i18n.t("chat.attachment.download")}
        title={i18n.t("chat.attachment.download")}
        disabled={!original}
        onclick={() => original && saveBlob(original.blob, name)}
      >
        <Icon icon="lucide:download" class="size-5" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm"
        aria-label={i18n.t("ui.close")}
        title={i18n.t("ui.close")}
        onclick={onclose}
      >
        <Icon icon="lucide:x" class="size-5" />
      </button>
    </div>
    <button
      type="button"
      class="flex min-h-0 flex-1 cursor-zoom-out items-center justify-center"
      aria-label={i18n.t("ui.close")}
      onclick={onclose}
    >
      {#if original ?? preview}
        <img
          src={original?.url ?? preview}
          alt={name}
          class="max-h-full max-w-full rounded-field object-contain"
        />
      {:else}
        <span class="loading loading-spinner loading-lg"></span>
      {/if}
    </button>
  </div>
</dialog>
