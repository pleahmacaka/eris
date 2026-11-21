<script lang="ts">
import InviteForm from "#lib/components/rooms/InviteForm.svelte"
import CopyButton from "#lib/components/ui/CopyButton.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { RoomAdmin } from "#lib/matrix/roomActions.js"

let { view }: { view: RoomAdmin } = $props()
</script>

<div class="flex flex-col gap-6">
  {#if view.canInvite}
    <InviteForm roomId={view.room.roomId} />
  {:else}
    <p class="text-muted text-sm">{i18n.t("rooms.invite.noPermission")}</p>
  {/if}

  <div class="flex flex-col gap-2">
    <label class="fieldset-label" for="invite-link">{i18n.t("rooms.invite.link")}</label>
    <p class="text-subtle text-xs">
      {i18n.t("rooms.invite.linkHint")}
    </p>
    <div class="flex items-center gap-2">
      <input id="invite-link" class="input min-w-0 flex-1" readonly value={view.link} />
      <CopyButton text={view.link} label={i18n.t("menu.room.copyLink")} />
    </div>
  </div>
</div>
