<script lang="ts">
import Dialog from "#lib/components/ui/Dialog.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { errorCode, roomError } from "#lib/matrix/errors.js"
import { parseUserIds } from "#lib/matrix/session.js"
import { channelsPath } from "#lib/routes.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { goto } from "$app/navigation"

let { open, onclose }: { open: boolean; onclose: () => void } = $props()

let userId = $state("")
let busy = $state(false)
let error = $state<Message | null>(null)

const userIds = $derived(parseUserIds(userId))
const valid = $derived(userIds !== null)

const submit = async (event: SubmitEvent) => {
  event.preventDefault()

  if (!valid || busy) {
    return
  }

  busy = true
  error = null

  try {
    const roomId = userIds ? await chatStore.startDm(userIds) : null

    userId = ""
    onclose()

    if (roomId) {
      await goto(channelsPath({ spaceId: null, roomId }))
    }
  } catch (cause) {
    error = roomError(errorCode(cause))
  } finally {
    busy = false
  }
}
</script>

<Dialog {open} title={i18n.t("channels.dm.start")} {onclose}>
  <form id="start-dm" class="flex flex-col gap-3" onsubmit={submit}>
    <fieldset class="fieldset gap-2" disabled={busy}>
      <label class="fieldset-label" for="dm-user">{i18n.t("friends.add.userId")}</label>
      <p class="text-subtle text-xs">
        {i18n.t("rooms.dm.multipleHint")}
      </p>
      <input
        id="dm-user"
        class="input w-full"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        placeholder={i18n.t("rooms.userIds.placeholder")}
        required
        bind:value={userId}
      />
    </fieldset>

    <p class="min-h-5 text-error text-xs" role="alert">
      {error
        ? i18n.text(error)
        : userId.trim() === "" || valid
          ? ""
          : i18n.t("rooms.userIds.invalid")}
    </p>
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={onclose}>{i18n.t("ui.cancel")}</button>
    <button
      type="submit"
      form="start-dm"
      class="btn btn-primary"
      disabled={!valid || busy}
    >
      {i18n.t("rooms.dm.start")}
    </button>
  {/snippet}
</Dialog>
