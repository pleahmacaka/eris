<script lang="ts">
import Icon from "@iconify/svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { errorCode, roomError } from "#lib/matrix/errors.js"
import {
  FRIEND_TAB_LABEL,
  type FriendDigest,
  type FriendTab,
  friendsForTab,
  PRESENCE_LABEL,
} from "#lib/matrix/friends.js"
import { isOnline } from "#lib/matrix/members.js"
import { isUserId } from "#lib/matrix/session.js"
import { channelsPath, HOME_PATH } from "#lib/routes.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { keymapStore } from "#lib/store/keymap.svelte.js"
import { goto } from "$app/navigation"

const TABS: FriendTab[] = ["online", "all", "pending"]

let tab = $state<FriendTab | "add">("online")
let query = $state("")
let search = $state<HTMLInputElement>()
let candidate = $state("")
let sending = $state(false)
let notice = $state<{ ok: boolean; message: Message } | null>(null)

const pendingCount = $derived(
  chatStore.friends.filter(friend => friend.state === "incoming").length,
)
const listed = $derived(
  tab === "add" ? [] : friendsForTab(chatStore.friends, tab, query),
)
const EMPTY: Record<FriendTab, MessageKey> = {
  online: "friends.empty.online",
  all: "friends.empty.all",
  pending: "friends.empty.pending",
}

const openDm = (friend: FriendDigest) =>
  goto(channelsPath({ spaceId: null, roomId: friend.roomId }))

$effect(() => {
  const field = search

  if (field) {
    return keymapStore.handle({ focusSearch: () => field.focus() })
  }
})

const respond = async (friend: FriendDigest, accept: boolean) => {
  const invite = chatStore.invites.find(room => room.id === friend.roomId)

  if (!invite) {
    return
  }

  if (accept) {
    await chatStore.acceptInvite(invite)
  } else {
    await chatStore.declineInvite(invite)
  }
}

const request = async (event: SubmitEvent) => {
  event.preventDefault()

  const userId = candidate.trim()

  if (!isUserId(userId) || sending) {
    return
  }

  sending = true
  notice = null

  try {
    await chatStore.startDm([userId])
    candidate = ""
    notice = {
      ok: true,
      message: { key: "friends.add.sent", values: { userId } },
    }
  } catch (cause) {
    notice = { ok: false, message: roomError(errorCode(cause)) }
  } finally {
    sending = false
  }
}
</script>

<section class="flex min-h-0 flex-1 flex-col">
  <header
    class="flex h-12 shrink-0 items-center gap-2 border-base-content/10 border-b px-3 md:gap-4 md:px-4"
  >
    <a
      href={HOME_PATH}
      class="btn btn-ghost btn-square btn-sm md:hidden"
      aria-label={i18n.t("ui.back")}
      title={i18n.t("ui.back")}
    >
      <Icon icon="lucide:arrow-left" class="size-5 rtl:-scale-x-100" />
    </a>
    <span class="hidden items-center gap-2 font-semibold md:flex">
      <Icon icon="lucide:users" class="size-5 text-muted" />
      {i18n.t("channels.friends")}
    </span>
    <span class="hidden h-5 border-base-content/10 border-s md:block"></span>
    <nav class="flex items-center gap-1" aria-label={i18n.t("friends.filter")}>
      {#each TABS as item (item)}
        <button
          type="button"
          class={["btn btn-ghost btn-sm", tab === item && "btn-active"]}
          aria-pressed={tab === item}
          onclick={() => {
            tab = item
          }}
        >
          {i18n.t(FRIEND_TAB_LABEL[item])}
          {#if item === "pending" && pendingCount > 0}
            <span class="badge badge-error badge-xs tabular-nums">{i18n.format.number(pendingCount)}</span>
          {/if}
        </button>
      {/each}
      <button
        type="button"
        class={["btn btn-sm", tab === "add" ? "btn-ghost text-success" : "btn-success"]}
        aria-pressed={tab === "add"}
        onclick={() => {
          tab = "add"
          notice = null
        }}
      >
        {i18n.t("friends.add.title")}
      </button>
    </nav>
  </header>

  {#if tab === "add"}
    <form class="flex flex-col gap-3 border-base-content/10 border-b p-6" onsubmit={request}>
      <h2 class="font-bold text-lg">{i18n.t("friends.add.title")}</h2>
      <p class="text-muted text-sm">
        {i18n.t("friends.add.hint")}
      </p>
      <div class="flex gap-2">
        <input
          class="input flex-1"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder={i18n.t("friends.add.placeholder")}
          aria-label={i18n.t("friends.add.userId")}
          bind:value={candidate}
        />
        <button
          type="submit"
          class="btn btn-primary"
          disabled={!isUserId(candidate) || sending}
        >
          {i18n.t("friends.add.send")}
        </button>
      </div>
      <p
        class={["min-h-5 text-sm", notice?.ok ? "text-success" : "text-error"]}
        role="status"
      >
        {notice ? i18n.text(notice.message) : ""}
      </p>
    </form>
  {:else}
    <div class="flex min-h-0 flex-1 flex-col px-6 pt-4">
      <label class="input input-sm w-full">
        <Icon icon="lucide:search" class="size-4 text-subtle" />
        <input bind:this={search} type="search" placeholder={i18n.t("ui.search")} bind:value={query} />
      </label>
      <p class="pt-5 pb-2 font-semibold text-subtle text-xs">
        {i18n.t("friends.header", { tab, count: listed.length })}
      </p>

      {#if listed.length === 0}
        <p class="py-10 text-center text-subtle text-sm">{i18n.t(EMPTY[tab])}</p>
      {:else}
        <ul class="min-h-0 flex-1 overflow-y-auto pb-4">
          {#each listed as friend (friend.userId)}
            <li class="border-base-content/10 border-t">
              <div
                class="group flex items-center gap-3 rounded-field px-2 py-2.5 hover:bg-base-content/5"
              >
                <span class="relative">
                  <Avatar name={friend.name} mxc={friend.avatarUrl} size="sm" />
                  <span
                    class={[
                      "absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-base-100",
                      isOnline(friend.presence)
                        ? friend.presence === "online"
                          ? "bg-success"
                          : "bg-warning"
                        : "bg-base-content/30",
                    ]}
                  ></span>
                </span>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate font-semibold text-sm" title={friend.userId}>
                    {friend.name}
                  </span>
                  <span class="truncate text-subtle text-xs">
                    {friend.state === "incoming"
                      ? i18n.t("friends.request.incoming")
                      : friend.state === "outgoing"
                        ? i18n.t("friends.request.outgoing")
                        : i18n.t(PRESENCE_LABEL(friend.presence))}
                  </span>
                </span>
                {#if friend.state === "incoming"}
                  <button
                    type="button"
                    class="btn btn-circle btn-sm"
                    aria-label={i18n.t("menu.invite.accept")}
                    title={i18n.t("menu.invite.accept")}
                    onclick={() => respond(friend, true)}
                  >
                    <Icon icon="lucide:check" class="size-4 text-success" />
                  </button>
                  <button
                    type="button"
                    class="btn btn-circle btn-sm"
                    aria-label={i18n.t("menu.invite.decline")}
                    title={i18n.t("menu.invite.decline")}
                    onclick={() => respond(friend, false)}
                  >
                    <Icon icon="lucide:x" class="size-4 text-error" />
                  </button>
                {:else}
                  <button
                    type="button"
                    class="btn btn-circle btn-sm"
                    aria-label={i18n.t("menu.user.message")}
                    title={i18n.t("menu.user.message")}
                    onclick={() => openDm(friend)}
                  >
                    <Icon icon="lucide:message-circle" class="size-4" />
                  </button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</section>
