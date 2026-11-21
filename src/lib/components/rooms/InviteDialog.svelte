<script lang="ts">
import InviteForm from "#lib/components/rooms/InviteForm.svelte"
import Dialog from "#lib/components/ui/Dialog.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { promptStore } from "#lib/store/prompt.svelte.js"

const target = $derived(promptStore.inviting)

const close = () => {
  promptStore.inviting = null
}
</script>

<Dialog open={target !== null} title={i18n.t("menu.room.invite")} onclose={close}>
  {#if target}
    <p class="text-muted text-sm">{i18n.t("rooms.invite.description", { name: target.name })}</p>
    <InviteForm roomId={target.roomId} />
  {/if}

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={close}>{i18n.t("ui.close")}</button>
  {/snippet}
</Dialog>
