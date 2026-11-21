<script lang="ts">
import Icon from "@iconify/svelte"
import AudioToggle from "#lib/components/call/AudioToggle.svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import PresenceDot from "#lib/components/ui/PresenceDot.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { PRESENCE_LABEL } from "#lib/matrix/friends.js"
import { localpart } from "#lib/matrix/rooms.js"
import { SETTINGS_PATH } from "#lib/routes.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"
import { profileCardStore } from "#lib/store/profileCard.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { goto } from "$app/navigation"

const userId = $derived(sessionStore.session?.userId ?? "")
const status = $derived(
  sessionStore.presence
    ? i18n.t(PRESENCE_LABEL(sessionStore.presence))
    : localpart(userId),
)
</script>

<div class="flex h-13 shrink-0 items-center gap-1 bg-base-300/70 px-2">
  <button
    type="button"
    class={[
      "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-field p-1 text-start",
      "hover:bg-base-content/5",
    ]}
    title={userId}
    onclick={event => profileCardStore.open(userId, event.currentTarget)}
  >
    <span class="relative shrink-0">
      <Avatar
        name={sessionStore.displayName}
        mxc={sessionStore.avatarUrl}
        size="sm"
        tone="primary"
      />
      <PresenceDot presence={sessionStore.presence} class="border-base-300" />
    </span>
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate font-semibold text-sm leading-4.5">
        {sessionStore.displayName}
      </span>
      <span class="truncate text-muted text-xs leading-4">{status}</span>
    </span>
  </button>

  <div class="flex shrink-0 gap-0.5">
    <AudioToggle
      kind="mic"
      surface="ghost"
      off={groupCallStore.muted}
      disabled={!groupCallStore.active}
      onclick={() => groupCallStore.toggleMute()}
    />
    <AudioToggle
      kind="speaker"
      surface="ghost"
      off={groupCallStore.deafened}
      disabled={!groupCallStore.active}
      onclick={() => groupCallStore.toggleDeafen()}
    />
    <button
      type="button"
      class="btn btn-ghost btn-square btn-sm"
      aria-label={i18n.t("settings.title")}
      title={i18n.t("settings.title")}
      onclick={() => goto(SETTINGS_PATH)}
    >
      <Icon icon="lucide:settings" class="size-4.5" />
    </button>
  </div>
</div>
