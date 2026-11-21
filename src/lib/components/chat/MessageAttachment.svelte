<script lang="ts">
import Icon from "@iconify/svelte"
import Lightbox from "#lib/components/chat/Lightbox.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { type AttachmentDigest, fitWithin } from "#lib/matrix/attachments.js"
import { MESSAGE_THUMBNAIL } from "#lib/matrix/media.js"
import { saveBlob } from "#lib/media/download.js"
import { mediaStore } from "#lib/store/media.svelte.js"

const IMAGE_BOUNDS = { width: 400, height: 300 }

const ICON = {
  video: "lucide:film",
  audio: "lucide:music",
  file: "lucide:file",
} as const

let { attachment }: { attachment: AttachmentDigest } = $props()

let viewing = $state(false)
let playing = $state<string | null>(null)
let loading = $state(false)
let failed = $state(false)

const thumbnail = $derived(
  attachment.kind === "image"
    ? mediaStore.thumbnail(attachment.url, MESSAGE_THUMBNAIL)
    : null,
)
const box = $derived(fitWithin(attachment.dimensions, IMAGE_BOUNDS))
const playable = $derived(
  attachment.kind === "video" || attachment.kind === "audio",
)

const fetchBlob = async () => {
  loading = true
  failed = false

  try {
    return await mediaStore.download(attachment.url)
  } catch {
    failed = true

    return null
  } finally {
    loading = false
  }
}

const download = async () => {
  const blob = await fetchBlob()

  if (blob) {
    saveBlob(blob, name)
  }
}

const play = async () => {
  const blob = await fetchBlob()

  if (blob) {
    playing = URL.createObjectURL(blob)
  }
}

$effect(() => {
  if (attachment.kind === "image") {
    void mediaStore.loadThumbnail(attachment.url, MESSAGE_THUMBNAIL)
  }
})

$effect(() => {
  const url = playing

  return () => {
    if (url) {
      URL.revokeObjectURL(url)
    }
  }
})

const name = $derived(attachment.name || i18n.t("chat.attachment.untitled"))
</script>

{#if attachment.kind === "image"}
  <button
    type="button"
    class={[
      "mt-1 block max-w-full cursor-zoom-in overflow-hidden rounded-field bg-base-content/5",
      !box && "h-48 w-64",
    ]}
    style:width={box ? `${box.width}px` : undefined}
    style:aspect-ratio={box ? `${box.width} / ${box.height}` : undefined}
    aria-label={i18n.t("chat.attachment.enlarge", { name })}
    title={name}
    onclick={() => {
      viewing = true
    }}
  >
    {#if thumbnail}
      <img src={thumbnail} alt={name} class="size-full object-cover" />
    {/if}
  </button>

  {#if viewing}
    <Lightbox
      mxc={attachment.url}
      name={name}
      preview={thumbnail}
      onclose={() => {
        viewing = false
      }}
    />
  {/if}
{:else if playing}
  <svelte:element
    this={attachment.kind}
    src={playing}
    class={[
      "mt-1 max-w-full",
      attachment.kind === "video" ? "max-h-80 rounded-field bg-base-300" : "w-80",
    ]}
    controls
    autoplay
  ></svelte:element>
{:else}
  <div
    class={[
      "mt-1 flex w-80 max-w-full items-center gap-3 rounded-field border p-3",
      "border-base-content/10 bg-base-200",
    ]}
  >
    <Icon icon={ICON[attachment.kind]} class="size-8 shrink-0 text-muted" />
    <div class="min-w-0 flex-1">
      <p class="truncate font-medium text-sm" title={name}>{name}</p>
      <p class="text-muted text-xs">
        {#if failed}
          <span class="text-error" role="alert">{i18n.t("chat.attachment.loadFailed")}</span>
        {:else if attachment.size !== null}
          {i18n.format.fileSize(attachment.size)}
        {/if}
      </p>
    </div>
    {#if loading}
      <span class="loading loading-spinner loading-sm shrink-0"></span>
    {:else}
      {#if playable}
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          aria-label={i18n.t("chat.attachment.playNamed", { name })}
          title={i18n.t("chat.attachment.play")}
          onclick={play}
        >
          <Icon icon="lucide:play" class="size-5" />
        </button>
      {/if}
      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm"
        aria-label={i18n.t("chat.attachment.downloadNamed", { name })}
        title={i18n.t("chat.attachment.download")}
        onclick={download}
      >
        <Icon icon="lucide:download" class="size-5" />
      </button>
    {/if}
  </div>
{/if}
