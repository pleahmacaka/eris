<script lang="ts">
import ChannelHeader from "#lib/components/chat/ChannelHeader.svelte"
import Composer from "#lib/components/chat/Composer.svelte"
import MessageList from "#lib/components/chat/MessageList.svelte"
import VoiceStage from "#lib/components/chat/VoiceStage.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import {
  type MentionOption,
  type MentionPick,
  type MentionQuery,
  ROOM_MENTION_LABEL,
  roomOptions,
  userOptions,
} from "#lib/matrix/mentions.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { mediaStore } from "#lib/store/media.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"

const room = $derived(chatStore.selected)
const placeholder = $derived(
  room === null
    ? i18n.t("chat.composer.placeholder")
    : i18n.t(
        room.isDm
          ? "chat.composer.placeholderDm"
          : "chat.composer.placeholderRoom",
        {
          name: room.name,
        },
      ),
)
const myUserId = $derived(sessionStore.session?.userId ?? "")
const knownMentions = $derived(
  chatStore.members.map(
    (member): MentionPick => ({
      label: member.userId,
      target: { kind: "user", userId: member.userId },
    }),
  ),
)

const suggest = (query: MentionQuery) =>
  query.trigger === "@"
    ? userOptions(
        chatStore.members.filter(member => member.userId !== myUserId),
        query.query,
        chatStore.canMentionRoom,
      )
    : roomOptions(chatStore.mentionableRooms(), query.query)

const resolve = (option: MentionOption): MentionPick | null => {
  switch (option.kind) {
    case "user":
      return {
        label: `@${option.title}`,
        target: { kind: "user", userId: option.key },
      }
    case "everyone":
      return { label: ROOM_MENTION_LABEL, target: { kind: "everyone" } }
    default:
      return chatStore.roomMention(option.key)
  }
}
</script>

{#if room}
  <ChannelHeader {room} />
  {#if room.kind === "voice"}
    <VoiceStage {room} />
  {/if}
  <MessageList />
  {#if chatStore.error}
    <p class="px-4 py-1 text-error text-xs" role="alert">{i18n.text(chatStore.error)}</p>
  {/if}
  <Composer
    {placeholder}
    disabled={chatStore.loadingRoom}
    uploadLimit={mediaStore.uploadLimit}
    mentions={{ known: knownMentions, suggest, resolve }}
    onsend={(text, spans) => chatStore.send(text, spans)}
    onattach={(file, onProgress) => chatStore.sendFile(file, onProgress)}
  />
{:else}
  <div class="flex flex-1 items-center justify-center text-muted text-sm">{i18n.t("ui.loading")}</div>
{/if}
