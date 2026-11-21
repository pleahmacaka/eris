<script lang="ts">
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { errorCode, inviteError } from "#lib/matrix/errors.js"
import { inviteUsers } from "#lib/matrix/roomActions.js"
import { parseUserIds } from "#lib/matrix/session.js"
import { sessionStore } from "#lib/store/session.svelte.js"

let { roomId }: { roomId: string } = $props()

let input = $state("")
let busy = $state(false)
let notice = $state<{ ok: boolean; message: Message } | null>(null)

const userIds = $derived(parseUserIds(input))
const invalid = $derived(input.trim() !== "" && userIds === null)

const submit = async (event: SubmitEvent) => {
  event.preventDefault()

  const client = sessionStore.client

  if (!client || !userIds || busy) {
    return
  }

  busy = true
  notice = null

  try {
    await inviteUsers(client, roomId, userIds)
    input = ""
    notice = { ok: true, message: { key: "rooms.invite.sent" } }
  } catch (cause) {
    notice = { ok: false, message: inviteError(errorCode(cause)) }
  } finally {
    busy = false
  }
}
</script>

<form class="flex flex-col gap-2" onsubmit={submit}>
  <label class="fieldset-label" for="invite-user">{i18n.t("friends.add.userId")}</label>
  <p class="text-subtle text-xs">
    {i18n.t("rooms.invite.multipleHint")}
  </p>
  <div class="flex gap-2">
    <input
      id="invite-user"
      class="input min-w-0 flex-1"
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      placeholder={i18n.t("rooms.userIds.placeholder")}
      disabled={busy}
      bind:value={input}
    />
    <button type="submit" class="btn btn-primary" disabled={userIds === null || busy}>
      {i18n.t("rooms.invite.submit")}
    </button>
  </div>
  <p
    class={["min-h-5 text-xs", notice?.ok ? "text-success" : "text-error"]}
    role={notice?.ok ? "status" : "alert"}
  >
    {invalid
      ? i18n.t("rooms.userIds.invalid")
      : notice
        ? i18n.text(notice.message)
        : ""}
  </p>
</form>
