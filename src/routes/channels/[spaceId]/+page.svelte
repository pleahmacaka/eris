<script lang="ts">
import EmptyPane from "#lib/components/chat/EmptyPane.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { channelsPath } from "#lib/routes.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { layoutStore } from "#lib/store/layout.svelte.js"
import { goto } from "$app/navigation"

$effect(() => {
  const first = chatStore.textChannels.find(
    channel => channel.membership === "join",
  )

  if (!layoutStore.narrow && first && chatStore.selectedSpaceId) {
    void goto(
      channelsPath({ spaceId: chatStore.selectedSpaceId, roomId: first.id }),
      {
        replaceState: true,
      },
    )
  }
})
</script>

<EmptyPane
  title={i18n.t("channels.space.emptyTitle")}
  body={i18n.t("channels.space.emptyBody")}
/>
