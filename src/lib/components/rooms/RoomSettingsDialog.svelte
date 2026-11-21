<script lang="ts">
import { untrack } from "svelte"
import InviteSection from "#lib/components/rooms/settings/InviteSection.svelte"
import MembersSection from "#lib/components/rooms/settings/MembersSection.svelte"
import OverviewSection from "#lib/components/rooms/settings/OverviewSection.svelte"
import PermissionsSection from "#lib/components/rooms/settings/PermissionsSection.svelte"
import Dialog from "#lib/components/ui/Dialog.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { promptStore } from "#lib/store/prompt.svelte.js"
import { roomAdminStore } from "#lib/store/roomAdmin.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"

const TABS = [
  { id: "overview", label: "rooms.settings.overview" },
  { id: "permissions", label: "rooms.settings.permissions" },
  { id: "members", label: "rooms.settings.members" },
  { id: "invite", label: "channels.invites" },
] as const

type TabId = (typeof TABS)[number]["id"]

let tab = $state<TabId>("overview")

const target = $derived(promptStore.configuring)
const view = $derived(roomAdminStore.view)
const server = $derived(target?.kind === "server")

$effect(() => {
  const client = sessionStore.client
  const roomId = target?.roomId

  if (!client || !roomId) {
    return
  }

  untrack(() => {
    tab = "overview"
    roomAdminStore.watch(client, roomId)
  })

  return () => roomAdminStore.unwatch()
})

const close = () => {
  promptStore.configuring = null
}
</script>

<Dialog open={target !== null} title={target ? i18n.t("menu.room.settings", { kind: target.kind }) : ""} size="wide" onclose={close}>
  <div role="tablist" class="tabs tabs-box shrink-0 flex-nowrap overflow-x-auto">
    {#each TABS as item (item.id)}
      <button
        type="button"
        role="tab"
        class={["tab whitespace-nowrap", tab === item.id && "tab-active"]}
        aria-selected={tab === item.id}
        onclick={() => {
          tab = item.id
        }}
      >
        {i18n.t(item.label)}
      </button>
    {/each}
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto pe-1">
    {#if view && target}
      {#if tab === "overview"}
        <OverviewSection {view} kind={target.kind} {server} />
      {:else if tab === "permissions"}
        <PermissionsSection {view} {server} />
      {:else if tab === "members"}
        <MembersSection {view} />
      {:else}
        <InviteSection {view} />
      {/if}
    {:else}
      <p class="text-muted text-sm">{i18n.t("ui.loading")}</p>
    {/if}
  </div>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={close}>{i18n.t("ui.close")}</button>
  {/snippet}
</Dialog>
