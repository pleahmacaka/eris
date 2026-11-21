<script lang="ts">
import Dialog from "#lib/components/ui/Dialog.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { errorCode, roomError } from "#lib/matrix/errors.js"
import type { ChannelKind } from "#lib/matrix/spaces.js"
import { channelsPath } from "#lib/routes.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { goto } from "$app/navigation"

type Props = { open: boolean; kind: ChannelKind; onclose: () => void }

let { open, kind, onclose }: Props = $props()

let name = $state("")
let busy = $state(false)
let error = $state<Message | null>(null)

const valid = $derived(name.trim() !== "")
const title = $derived(
  i18n.t(kind === "voice" ? "channels.voice.create" : "channels.text.create"),
)

const submit = async (event: SubmitEvent) => {
  event.preventDefault()

  if (!valid || busy) {
    return
  }

  busy = true
  error = null

  try {
    const spaceId = chatStore.selectedSpaceId
    const roomId = await chatStore.createChannel(name.trim(), kind)

    name = ""
    onclose()

    if (roomId) {
      await goto(channelsPath({ spaceId, roomId }))
    }
  } catch (cause) {
    error = roomError(errorCode(cause))
  } finally {
    busy = false
  }
}
</script>

<Dialog {open} {title} {onclose}>
  <form id="create-channel" class="flex flex-col gap-3" onsubmit={submit}>
    <fieldset class="fieldset gap-2" disabled={busy}>
      <label class="fieldset-label" for="channel-name">{i18n.t("channels.create.name")}</label>
      <input
        id="channel-name"
        class="input w-full"
        autocomplete="off"
        required
        bind:value={name}
      />
    </fieldset>
    <p class="min-h-5 text-error text-xs" role="alert">{error ? i18n.text(error) : ""}</p>
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onclose}>{i18n.t("ui.cancel")}</button>
    <button
      type="submit"
      form="create-channel"
      class="btn btn-primary"
      disabled={!valid || busy}
    >
      {i18n.t("ui.create")}
    </button>
  {/snippet}
</Dialog>
