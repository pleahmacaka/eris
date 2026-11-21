import {
  EventType,
  JoinRule,
  type MatrixClient,
  Preset,
  RestrictedAllowType,
  Visibility,
} from "matrix-js-sdk"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import type { Translate } from "#lib/i18n/translate.js"
import { serverName } from "./rooms"
import {
  type ChannelKind,
  type RoomAddress,
  SPACE_ROOM_TYPE,
  VOICE_ROOM_TYPE,
} from "./spaces"

const callPowerLevels = { events: { [EventType.GroupCallMemberPrefix]: 0 } }

const DEFAULT_CHANNELS: { name: MessageKey; kind: ChannelKind }[] = [
  { name: "channels.default.general", kind: "text" },
  { name: "channels.default.voiceLounge", kind: "voice" },
]

const createSpace = (
  client: MatrixClient,
  name: string,
  avatarUrl: string | null,
) =>
  client.createRoom({
    name,
    creation_content: { type: SPACE_ROOM_TYPE },
    preset: Preset.PrivateChat,
    visibility: Visibility.Private,
    power_level_content_override: { events_default: 100 },
    initial_state: avatarUrl
      ? [
          {
            type: EventType.RoomAvatar,
            state_key: "",
            content: { url: avatarUrl },
          },
        ]
      : [],
  })

export const createChannel = async (
  client: MatrixClient,
  spaceId: string,
  name: string,
  kind: ChannelKind,
) => {
  const via = [serverName(client.getUserId() ?? "")]
  const { room_id } = await client.createRoom({
    name,
    creation_content: kind === "voice" ? { type: VOICE_ROOM_TYPE } : undefined,
    preset: Preset.PrivateChat,
    visibility: Visibility.Private,
    initial_state: [
      {
        type: EventType.SpaceParent,
        state_key: spaceId,
        content: { via, canonical: true },
      },
      {
        type: EventType.RoomJoinRules,
        state_key: "",
        content: {
          join_rule: JoinRule.Restricted,
          allow: [
            { type: RestrictedAllowType.RoomMembership, room_id: spaceId },
          ],
        },
      },
    ],
    power_level_content_override: callPowerLevels,
  })

  await client.sendStateEvent(spaceId, EventType.SpaceChild, { via }, room_id)

  return room_id
}

export const createServer = async (
  client: MatrixClient,
  name: string,
  icon: File | null,
  translate: Translate,
) => {
  const avatarUrl = icon ? (await client.uploadContent(icon)).content_uri : null
  const { room_id } = await createSpace(client, name, avatarUrl)

  for (const channel of DEFAULT_CHANNELS) {
    await createChannel(client, room_id, translate(channel.name), channel.kind)
  }

  return room_id
}

export const createDmRoom = (client: MatrixClient, userIds: string[]) =>
  client.createRoom({
    invite: userIds,
    is_direct: true,
    preset: Preset.TrustedPrivateChat,
    visibility: Visibility.Private,
    power_level_content_override: callPowerLevels,
  })

export const joinByAddress = (client: MatrixClient, address: RoomAddress) =>
  client.joinRoom(address.target, { viaServers: address.via })
