<script lang="ts">
import Icon from "@iconify/svelte"
import AsciiField from "#lib/components/brand/AsciiField.svelte"
import Logo from "#lib/components/brand/Logo.svelte"
import RailButton from "#lib/components/rail/RailButton.svelte"
import ServerDialog from "#lib/components/rail/ServerDialog.svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { homeSections, spaceSections } from "#lib/menu/actions.js"
import { channelsPath, HOME_PATH, parseChannelsPath } from "#lib/routes.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { goto } from "$app/navigation"

let adding = $state(false)

const homeUnread = $derived(
  chatStore.dms.some(room => room.unread > 0) || chatStore.invites.length > 0,
)
const homeHighlight = $derived(
  chatStore.dms.reduce(
    (sum, room) => sum + room.highlight,
    chatStore.invites.length,
  ),
)

import { page } from "$app/state"

const activeSpaceId = $derived(
  parseChannelsPath(page.url.pathname)?.spaceId ?? null,
)
</script>

<nav
  class={[
    "relative isolate flex w-18 shrink-0 flex-col items-center gap-2",
    "overflow-y-auto overflow-x-clip bg-base-300 py-3",
  ]}
  aria-label={i18n.t("rail.servers")}
>
  <AsciiField class="absolute inset-0 -z-10 size-full opacity-40" />

  <RailButton
    label={i18n.t("channels.home")}
    tone="brand"
    selected={activeSpaceId === null}
    unread={homeUnread}
    highlight={homeHighlight}
    menu={homeSections}
    onclick={() => goto(HOME_PATH)}
  >
    <Logo class="size-6" mono />
  </RailButton>

  <span class="h-0.5 w-8 rounded-full bg-base-content/10" aria-hidden="true"></span>

  {#each chatStore.spaces as space (space.id)}
    <RailButton
      label={space.name}
      selected={activeSpaceId === space.id}
      unread={space.unread > 0}
      highlight={space.highlight}
      menu={() => spaceSections(space)}
      onclick={() => goto(channelsPath({ spaceId: space.id, roomId: null }))}
    >
      <Avatar name={space.name} mxc={space.avatarUrl} size="fill" tone="none" />
    </RailButton>
  {/each}

  <RailButton
    label={i18n.t("rail.addServer")}
    tone="action"
    onclick={() => {
      adding = true
    }}
  >
    <Icon icon="lucide:plus" class="size-5" />
  </RailButton>
</nav>

<ServerDialog
  open={adding}
  onclose={() => {
    adding = false
  }}
/>
