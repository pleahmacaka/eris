<script lang="ts">
import Icon from "@iconify/svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { actionError, errorCode } from "#lib/matrix/errors.js"
import {
  canChangeLevel,
  canModerate,
  canUnban,
  levelLabel,
} from "#lib/matrix/power.js"
import type { AdminMember, RoomAdmin } from "#lib/matrix/roomActions.js"
import { confirmModeration } from "#lib/menu/actions.js"
import { promptStore } from "#lib/store/prompt.svelte.js"
import { roomAdminStore } from "#lib/store/roomAdmin.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"

let { view }: { view: RoomAdmin } = $props()

let query = $state("")
let busy = $state(false)
let error = $state<Message | null>(null)

const matches = (member: AdminMember) => {
  const needle = query.trim().toLowerCase()

  return (
    needle === "" ||
    member.name.toLowerCase().includes(needle) ||
    member.userId.toLowerCase().includes(needle)
  )
}

const members = $derived(view.members.filter(matches))
const banned = $derived(view.banned.filter(matches))
const mayUnban = $derived(canUnban(view.content, view.myLevel))

const rank = (member: AdminMember) => ({
  actor: view.myLevel,
  target: member.level,
  self: member.userId === view.myUserId,
})

const changeRole = (member: AdminMember) => {
  promptStore.assigning = {
    roomId: view.room.roomId,
    name: view.name,
    userId: member.userId,
    userName: member.name,
  }
}

const unban = async (member: AdminMember) => {
  busy = true
  error = null

  try {
    await sessionStore.client?.unban(view.room.roomId, member.userId)
  } catch (cause) {
    error = actionError(errorCode(cause))
  } finally {
    busy = false
  }
}
</script>

{#snippet identity(member: AdminMember)}
  <Avatar name={member.name} mxc={member.avatarUrl} size="sm" />
  <div class="min-w-0 flex-1">
    <p class="truncate font-medium text-sm" title={member.name}>{member.name}</p>
    <p class="truncate text-subtle text-xs" title={member.userId}>{member.userId}</p>
  </div>
{/snippet}

<div class="flex flex-col gap-3">
  <label class="input input-sm w-full">
    <Icon icon="lucide:search" class="size-4 text-subtle" />
    <input
      type="search"
      class="grow"
      placeholder={i18n.t("rooms.members.searchPlaceholder")}
      aria-label={i18n.t("rooms.members.search")}
      bind:value={query}
    />
  </label>

  {#if roomAdminStore.partial}
    <p class="text-warning text-xs" role="alert">
      {i18n.t("rooms.members.partial")}
    </p>
  {/if}

  <p class="flex items-center gap-2 px-2 font-semibold text-subtle text-xs">
    <span>{i18n.t("members.role.member")}</span>
    <span class="tabular-nums">{i18n.format.number(members.length)}</span>
  </p>
  {#if members.length === 0}
    <p class="px-2 text-subtle text-xs">{i18n.t("ui.noResults")}</p>
  {:else}
    <ul class="flex flex-col">
      {#each members as member (member.userId)}
        <li class="flex items-center gap-3 rounded-field px-2 py-1.5 hover:bg-base-content/5">
          {@render identity(member)}
          {#if member.invited}
            <span class="badge badge-ghost badge-sm whitespace-nowrap">{i18n.t("rooms.members.invited")}</span>
          {/if}
          <span class="badge badge-ghost badge-sm whitespace-nowrap">{i18n.text(levelLabel(member.level))}</span>
          <div class="flex w-24 shrink-0 justify-end gap-1">
            {#if canChangeLevel(view.content, rank(member))}
              <button
                type="button"
                class="btn btn-ghost btn-square btn-xs"
                aria-label={i18n.t("rooms.members.changeRoleNamed", { name: member.name })}
                title={i18n.t("menu.user.changeRole")}
                onclick={() => changeRole(member)}
              >
                <Icon icon="lucide:shield" class="size-4" />
              </button>
            {/if}
            {#if canModerate(view.content, "kick", rank(member))}
              <button
                type="button"
                class="btn btn-ghost btn-square btn-xs text-error"
                aria-label={i18n.t("rooms.members.kickNamed", { name: member.name })}
                title={i18n.t("menu.user.kick")}
                onclick={() => confirmModeration("kick", view.room, member)}
              >
                <Icon icon="lucide:user-minus" class="size-4" />
              </button>
            {/if}
            {#if canModerate(view.content, "ban", rank(member))}
              <button
                type="button"
                class="btn btn-ghost btn-square btn-xs text-error"
                aria-label={i18n.t("rooms.members.banNamed", { name: member.name })}
                title={i18n.t("menu.user.ban")}
                onclick={() => confirmModeration("ban", view.room, member)}
              >
                <Icon icon="lucide:ban" class="size-4" />
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="flex items-center gap-2 px-2 pt-2 font-semibold text-subtle text-xs">
    <span>{i18n.t("rooms.members.banList")}</span>
    <span class="tabular-nums">{banned.length}</span>
  </p>
  {#if banned.length === 0}
    <p class="px-2 text-subtle text-xs">{i18n.t("rooms.members.noBans")}</p>
  {:else}
    <ul class="flex flex-col">
      {#each banned as member (member.userId)}
        <li class="flex items-center gap-3 rounded-field px-2 py-1.5 hover:bg-base-content/5">
          {@render identity(member)}
          {#if mayUnban}
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              disabled={busy}
              onclick={() => unban(member)}
            >
              {i18n.t("rooms.members.unban")}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <p class="min-h-5 px-2 text-error text-xs" role="alert">{error ? i18n.text(error) : ""}</p>
</div>
