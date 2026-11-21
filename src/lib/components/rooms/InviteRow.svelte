<script lang="ts">
import { contextMenu } from "#lib/attachments/contextMenu.js"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { errorCode, roomError } from "#lib/matrix/errors.js"
import { localpart, type RoomDigest } from "#lib/matrix/rooms.js"
import { inviteMenu } from "#lib/menu/menus.js"
import { channelsPath } from "#lib/routes.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { goto } from "$app/navigation"

let { room }: { room: RoomDigest } = $props()

let busy = $state(false)
let error = $state<Message | null>(null)

const accept = async () => {
  const joined = await chatStore.acceptInvite(room)

  if (joined) {
    await goto(
      channelsPath(
        joined.isSpace
          ? { spaceId: joined.id, roomId: null }
          : { spaceId: null, roomId: joined.id },
      ),
    )
  }
}

const run = async (action: () => Promise<void>) => {
  busy = true
  error = null

  try {
    await action()
  } catch (cause) {
    error = roomError(errorCode(cause))
  } finally {
    busy = false
  }
}

const decline = () => chatStore.declineInvite(room)

const menu = contextMenu(() =>
  inviteMenu(busy, {
    accept: () => void run(accept),
    decline: () => void run(decline),
  }),
)
</script>

<div
  class={[
    "flex flex-col gap-2 rounded-field border border-primary/30 bg-primary/5",
    "px-2 py-2",
  ]}
  {@attach menu}
>
  <div class="flex items-center gap-3">
    <Avatar name={room.name} mxc={room.avatarUrl} tone="primary" />
    <div class="min-w-0 flex-1">
      <p class="truncate font-medium text-sm" title={room.name}>{room.name}</p>
      <p class="truncate text-muted text-xs">
        {room.inviter
          ? i18n.t("rooms.invite.from", { name: localpart(room.inviter) })
          : i18n.t("channels.invites")}
      </p>
    </div>
    <div class="flex gap-1">
      <button
        type="button"
        class="btn btn-primary btn-xs"
        disabled={busy}
        onclick={() => run(accept)}
      >
        {i18n.t("menu.invite.accept")}
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        disabled={busy}
        onclick={() => run(decline)}
      >
        {i18n.t("menu.invite.decline")}
      </button>
    </div>
  </div>
  {#if error}
    <p class="text-error text-xs" role="alert">{i18n.text(error)}</p>
  {/if}
</div>
