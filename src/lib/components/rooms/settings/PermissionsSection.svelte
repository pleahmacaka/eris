<script lang="ts">
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { actionError, errorCode } from "#lib/matrix/errors.js"
import {
  canEditLevels,
  canSetPermission,
  levelLabel,
  PERMISSIONS,
  type PermissionLevels,
  permissionChoices,
  readPermissionLevels,
} from "#lib/matrix/power.js"
import {
  type RoomAdmin,
  savePermissions,
  spaceChildIds,
} from "#lib/matrix/roomActions.js"
import { sessionStore } from "#lib/store/session.svelte.js"

let { view, server }: { view: RoomAdmin; server: boolean } = $props()

let draft = $state<PermissionLevels>({})
let propagate = $state(false)
let busy = $state(false)
let notice = $state<{ ok: boolean; message: Message } | null>(null)

const content = $derived(view.content)
const current = $derived(readPermissionLevels(content))
const editable = $derived(canEditLevels(content, view.myLevel))
const changed = $derived(
  Object.fromEntries(
    PERMISSIONS.filter(
      permission => draft[permission.key] !== current[permission.key],
    ).map(permission => [permission.key, draft[permission.key] ?? 0]),
  ),
)
const dirty = $derived(Object.keys(changed).length > 0)

$effect(() => {
  draft = { ...current }
})

const save = async () => {
  const client = sessionStore.client

  if (!client || !dirty || busy) {
    return
  }

  const levels = changed
  const children = propagate
    ? spaceChildIds(client, view.room.roomId)
        .map(roomId => client.getRoom(roomId))
        .filter(room => room?.getMyMembership() === "join")
    : []

  busy = true
  notice = null

  try {
    await savePermissions(client, view.room, levels)

    for (const child of children) {
      if (child) {
        await savePermissions(client, child, levels)
      }
    }

    notice = { ok: true, message: { key: "rooms.permissions.saved" } }
  } catch (cause) {
    notice = { ok: false, message: actionError(errorCode(cause)) }
  } finally {
    busy = false
  }
}
</script>

<div class="flex flex-col gap-4">
  <p class="text-muted text-sm">
    {editable
      ? i18n.t("rooms.permissions.hint")
      : i18n.t("rooms.permissions.readOnly")}
  </p>

  <ul class="flex flex-col">
    {#each PERMISSIONS as permission (permission.key)}
      {@const level = current[permission.key] ?? 0}
      <li class="flex items-center gap-3 border-base-content/10 border-b py-2 last:border-b-0">
        <label class="min-w-0 flex-1 text-sm" for="permission-{permission.key}">
          {i18n.t(permission.label)}
        </label>
        <select
          id="permission-{permission.key}"
          class="select select-sm w-44"
          disabled={busy || !canSetPermission(content, permission, view.myLevel, level)}
          value={draft[permission.key] ?? level}
          onchange={event => {
            draft[permission.key] = Number(event.currentTarget.value)
            notice = null
          }}
        >
          {#each permissionChoices(level) as choice (choice)}
            <option value={choice} disabled={choice > view.myLevel}>
              {i18n.text(levelLabel(choice))}
            </option>
          {/each}
        </select>
      </li>
    {/each}
  </ul>

  {#if server && editable}
    <label class="flex cursor-pointer items-center gap-3 text-sm">
      <input type="checkbox" class="checkbox checkbox-primary checkbox-sm" bind:checked={propagate} />
      {i18n.t("rooms.permissions.applyToChannels")}
    </label>
  {/if}

  <div class="flex items-center gap-2">
    <p
      class={["min-h-5 flex-1 text-xs", notice?.ok ? "text-success" : "text-error"]}
      role={notice?.ok ? "status" : "alert"}
    >
      {notice ? i18n.text(notice.message) : ""}
    </p>
    <button
      type="button"
      class="btn btn-ghost btn-sm"
      disabled={!dirty || busy}
      onclick={() => {
        draft = { ...current }
      }}
    >
      {i18n.t("rooms.permissions.revert")}
    </button>
    <button type="button" class="btn btn-primary btn-sm" disabled={!dirty || busy} onclick={save}>
      {i18n.t("ui.save")}
    </button>
  </div>
</div>
