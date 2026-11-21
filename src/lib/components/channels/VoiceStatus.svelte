<script lang="ts">
import Icon from "@iconify/svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"

const connected = $derived(groupCallStore.phase === "connected")
</script>

<div class="flex items-center gap-2 border-base-content/10 border-t bg-base-300/40 px-3 py-2">
  <Icon
    icon="lucide:radio"
    class={["size-4 shrink-0", connected ? "text-success" : "text-warning"]}
  />
  <div class="min-w-0 flex-1">
    <p class={["font-semibold text-sm", connected ? "text-success" : "text-warning"]}>
      {i18n.t(connected ? "voice.status.connected" : groupCallStore.label)}
    </p>
    <p class="truncate text-muted text-xs" title={groupCallStore.roomName}>
      {groupCallStore.roomName}
    </p>
  </div>
  <button
    type="button"
    class="btn btn-ghost btn-square btn-sm"
    aria-label={i18n.t("voice.status.disconnect")}
    title={i18n.t("voice.status.disconnect")}
    disabled={groupCallStore.phase === "leaving"}
    onclick={() => groupCallStore.leave()}
  >
    <Icon icon="lucide:phone-off" class="size-4" />
  </button>
</div>
