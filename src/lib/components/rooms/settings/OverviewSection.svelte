<script lang="ts">
import { EventType } from "matrix-js-sdk"
import { untrack } from "svelte"
import IconPicker from "#lib/components/ui/IconPicker.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { actionError, errorCode } from "#lib/matrix/errors.js"
import { ROOM_NAME_EVENT, stateEventLevel } from "#lib/matrix/power.js"
import { applyState, type RoomAdmin } from "#lib/matrix/roomActions.js"
import type { RoomKind } from "#lib/menu/menus.js"
import { sessionStore } from "#lib/store/session.svelte.js"

type Props = { view: RoomAdmin; kind: RoomKind; server: boolean }

let { view, kind, server }: Props = $props()

let name = $state(untrack(() => view.name))
let topic = $state(untrack(() => view.topic))
let icon = $state<File | null>(null)
let removing = $state(false)
let busy = $state(false)
let notice = $state<{ ok: boolean; message: Message } | null>(null)

const may = (type: string) =>
  view.myLevel >= stateEventLevel(view.content, type)

const mayName = $derived(may(ROOM_NAME_EVENT))
const mayTopic = $derived(may(EventType.RoomTopic))
const mayIcon = $derived(may(EventType.RoomAvatar))
const trimmedName = $derived(name.trim())
const dirty = $derived(
  trimmedName !== view.name ||
    topic.trim() !== view.topic ||
    icon !== null ||
    removing,
)

const save = async (event: SubmitEvent) => {
  event.preventDefault()

  const client = sessionStore.client
  const roomId = view.room.roomId

  if (!client || !dirty || trimmedName === "" || busy) {
    return
  }

  busy = true
  notice = null

  try {
    if (icon) {
      const { content_uri } = await client.uploadContent(icon)

      await applyState(client, () =>
        client.sendStateEvent(
          roomId,
          EventType.RoomAvatar,
          { url: content_uri },
          "",
        ),
      )
    } else if (removing) {
      await applyState(client, () =>
        client.sendStateEvent(roomId, EventType.RoomAvatar, {}, ""),
      )
    }

    if (trimmedName !== view.name) {
      await applyState(client, () => client.setRoomName(roomId, trimmedName))
    }

    if (topic.trim() !== view.topic) {
      await applyState(client, () => client.setRoomTopic(roomId, topic.trim()))
    }

    icon = null
    removing = false
    notice = { ok: true, message: { key: "rooms.settings.saved" } }
  } catch (cause) {
    notice = { ok: false, message: actionError(errorCode(cause)) }
  } finally {
    busy = false
  }
}
</script>

<form class="flex flex-col gap-4" onsubmit={save}>
  {#if server}
    <div class="flex items-center gap-4">
      <IconPicker
        bind:file={icon}
        name={view.name}
        label={i18n.t("rooms.settings.iconPick", { kind })}
        mxc={removing ? null : view.avatarUrl}
        disabled={busy || !mayIcon}
      />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <p class="text-muted text-xs">
          {i18n.t("rooms.settings.iconHint", { kind })}
        </p>
        {#if (view.avatarUrl && !removing) || icon}
          <button
            type="button"
            class="btn btn-ghost btn-sm w-fit"
            disabled={busy || !mayIcon}
            onclick={() => {
              removing = icon === null
              icon = null
            }}
          >
            {i18n.t(icon ? "rooms.settings.iconUnselect" : "rooms.settings.iconRemove")}
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <fieldset class="fieldset gap-2" disabled={busy}>
    <label class="fieldset-label" for="settings-name">{i18n.t("rooms.settings.name", { kind })}</label>
    <input
      id="settings-name"
      class="input w-full"
      autocomplete="off"
      required
      disabled={!mayName}
      bind:value={name}
    />

    <label class="fieldset-label" for="settings-topic">{i18n.t("rooms.settings.topic")}</label>
    <textarea
      id="settings-topic"
      class="textarea w-full"
      rows="3"
      disabled={!mayTopic}
      bind:value={topic}
    ></textarea>
  </fieldset>

  <div class="flex items-center gap-2">
    <p
      class={["min-h-5 flex-1 text-xs", notice?.ok ? "text-success" : "text-error"]}
      role={notice?.ok ? "status" : "alert"}
    >
      {notice ? i18n.text(notice.message) : ""}
    </p>
    <button
      type="submit"
      class="btn btn-primary btn-sm"
      disabled={!dirty || trimmedName === "" || busy}
    >
      {i18n.t("ui.save")}
    </button>
  </div>
</form>
