<script lang="ts">
import Icon from "@iconify/svelte"
import { scale } from "svelte/transition"
import Avatar from "#lib/components/ui/Avatar.svelte"
import CopyButton from "#lib/components/ui/CopyButton.svelte"
import PresenceDot from "#lib/components/ui/PresenceDot.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { errorCode, roomError } from "#lib/matrix/errors.js"
import { PRESENCE_LABEL } from "#lib/matrix/friends.js"
import { ROLE_LABEL, roleFor } from "#lib/matrix/members.js"
import { describeUser } from "#lib/matrix/profile.js"
import { duration, QUICK_MS } from "#lib/motion/durations.js"
import { channelsPath, SETTINGS_PATH } from "#lib/routes.js"
import { placeBeside } from "#lib/shell/popover.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { profileCardStore } from "#lib/store/profileCard.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { afterNavigate, goto } from "$app/navigation"

const GAP_PX = 8

let card = $state<HTMLDivElement>()
let position = $state({ left: 0, top: 0 })
let busy = $state(false)
let error = $state<Message | null>(null)

const target = $derived(profileCardStore.target)
const client = $derived(sessionStore.client)
const user = $derived(
  target && client
    ? describeUser(client, chatStore.currentRoom(), target.userId)
    : null,
)
const self = $derived(target?.userId === sessionStore.session?.userId)
const friend = $derived(
  chatStore.friends.find(item => item.userId === target?.userId),
)

const close = () => profileCardStore.close()

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

const message = (userId: string) =>
  run(async () => {
    const roomId = await chatStore.startDm([userId])

    close()

    if (roomId) {
      await goto(channelsPath({ spaceId: null, roomId }))
    }
  })

const addFriend = (userId: string) =>
  run(async () => {
    await chatStore.startDm([userId])
  })

const acceptFriend = (roomId: string) =>
  run(async () => {
    const invite = chatStore.invites.find(room => room.id === roomId)

    if (invite) {
      await chatStore.acceptInvite(invite)
    }
  })

const editProfile = () => {
  close()
  void goto(SETTINGS_PATH)
}

const onPointerDown = (event: PointerEvent) => {
  if (card && !card.contains(event.target as Node)) {
    close()
  }
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    close()
  }
}

afterNavigate(close)

$effect(() => {
  if (card && target) {
    position = placeBeside(
      target.anchor,
      { width: card.offsetWidth, height: card.offsetHeight },
      { width: innerWidth, height: innerHeight },
      GAP_PX,
    )
    error = null
    card.focus()
  }
})
</script>

<svelte:window onpointerdown={onPointerDown} onkeydown={onKeyDown} onresize={close} />

{#if user}
  <div
    bind:this={card}
    role="dialog"
    aria-label={i18n.t("chat.message.authorProfile", { name: user.name })}
    tabindex="-1"
    class={[
      "fixed z-50 w-75 overflow-hidden rounded-box border outline-none",
      "border-base-content/10 bg-base-200 shadow-xl",
    ]}
    style:left="{position.left}px"
    style:top="{position.top}px"
    transition:scale={{ start: 0.96, duration: duration(QUICK_MS) }}
  >
    <div class="banner h-15" aria-hidden="true"></div>

    <div class="flex flex-col gap-3 px-4 pb-4">
      <span class="relative -mt-10 w-fit rounded-3xl bg-base-200 ring-4 ring-base-200">
        <Avatar name={user.name} mxc={user.avatarUrl} size="xl" tone="primary" />
        <PresenceDot presence={user.presence} size="lg" class="border-base-200" />
      </span>

      <div class="flex flex-col gap-0.5">
        <p class="truncate font-bold text-xl" title={user.name}>{user.name}</p>
        <p class="flex items-center gap-1 text-muted text-sm">
          <span class="min-w-0 truncate" title={user.userId}>{user.userId}</span>
          <CopyButton text={user.userId} label={i18n.t("menu.user.copyId")} />
        </p>
        {#if user.presence}
          <p class="text-base-content/80 text-sm">{i18n.t(PRESENCE_LABEL(user.presence))}</p>
        {/if}
      </div>

      {#if user.powerLevel !== null}
        <div class="flex flex-col gap-1.5 border-base-content/10 border-t pt-3">
          <p class="font-semibold text-subtle text-xs">{i18n.t("rooms.role.legend")}</p>
          <span class="badge badge-ghost badge-sm">
            {i18n.t(ROLE_LABEL[roleFor(user.powerLevel)])}
          </span>
        </div>
      {/if}

      {#if error}
        <p class="text-error text-xs" role="alert">{i18n.text(error)}</p>
      {/if}

      <div class="flex items-center gap-2">
        {#if self}
          <button type="button" class="btn btn-primary btn-sm flex-1" onclick={editProfile}>
            <Icon icon="lucide:pencil" class="size-4" />
            {i18n.t("profile.edit")}
          </button>
        {:else}
          <button
            type="button"
            class="btn btn-primary btn-sm flex-1"
            disabled={busy}
            onclick={() => message(user.userId)}
          >
            <Icon icon="lucide:message-circle" class="size-4" />
            {i18n.t("menu.user.message")}
          </button>
          {#if friend?.state === "friend"}
            <span class="badge badge-ghost gap-1 whitespace-nowrap">
              <Icon icon="lucide:user-check" class="size-3.5" />
              {i18n.t("profile.friend")}
            </span>
          {:else if friend?.state === "outgoing"}
            <span class="badge badge-ghost whitespace-nowrap">{i18n.t("profile.requestSent")}</span>
          {:else if friend?.state === "incoming"}
            <button
              type="button"
              class="btn btn-sm"
              disabled={busy}
              onclick={() => acceptFriend(friend.roomId)}
            >
              <Icon icon="lucide:user-check" class="size-4" />
              {i18n.t("profile.acceptRequest")}
            </button>
          {:else}
            <button
              type="button"
              class="btn btn-square btn-sm"
              aria-label={i18n.t("friends.add.title")}
              title={i18n.t("friends.add.title")}
              disabled={busy}
              onclick={() => addFriend(user.userId)}
            >
              <Icon icon="lucide:user-plus" class="size-4.5" />
            </button>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
