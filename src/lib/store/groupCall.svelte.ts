import type { Room as LivekitRoom } from "livekit-client"
import type { MatrixClient, Room } from "matrix-js-sdk"
import {
  type MatrixRTCSession,
  MatrixRTCSessionEvent,
} from "matrix-js-sdk/lib/matrixrtc"
import type { Message } from "#lib/i18n/translate.js"
import { digestMembership, memberAvatarUrl } from "#lib/matrix/digest.js"
import {
  errorCode,
  GROUP_CALL_UNSUPPORTED,
  mediaError,
} from "#lib/matrix/errors.js"
import {
  GROUP_CALL_LABEL,
  type GroupCallPhase,
  type GroupParticipant,
  mergeParticipants,
  phaseFromConnection,
} from "#lib/matrix/groupCall.js"
import { localpart } from "#lib/matrix/rooms.js"
import {
  applyAudioPrefs,
  bindLivekitRoom,
  connectLivekitRoom,
  createLivekitRoom,
  discoverLivekitServiceUrl,
  fetchLivekitAccess,
  joinSession,
  livekitParticipants,
  publishMicrophone,
  sessionTransport,
} from "#lib/matrix/rtc.js"
import { type AudioPrefs, DEFAULT_AUDIO_PREFS } from "#lib/media/devices.js"
import { requestMicrophone } from "#lib/media/microphone.js"

const LEAVE_TIMEOUT_MS = 5000

export type GroupCallSupport =
  | "unknown"
  | "checking"
  | "available"
  | "unavailable"

class GroupCallStore {
  roomId = $state<string | null>(null)
  phase = $state<GroupCallPhase>("idle")
  participants = $state.raw<GroupParticipant[]>([])
  roomName = $state("")
  muted = $state(false)
  deafened = $state(false)
  error = $state<Message | null>(null)
  errorRoomId = $state<string | null>(null)
  canPlayAudio = $state(true)
  support = $state<GroupCallSupport>("unknown")

  label = $derived(GROUP_CALL_LABEL[this.phase])
  active = $derived(this.roomId !== null && this.phase !== "idle")

  private client: MatrixClient | null = null
  private room: Room | null = null
  private session: MatrixRTCSession | null = null
  private livekit: LivekitRoom | null = null
  private unbindRoom: (() => void) | null = null
  private unbindSession: (() => void) | null = null
  private audio: HTMLMediaElement[] = []
  private serviceUrl: string | null = null
  private audioPrefs = DEFAULT_AUDIO_PREFS

  async probeSupport(client: MatrixClient) {
    if (this.support !== "unknown") {
      return
    }

    this.support = "checking"
    this.serviceUrl = await discoverLivekitServiceUrl(client)
    this.support = this.serviceUrl ? "available" : "unavailable"
  }

  clearSupport() {
    this.support = "unknown"
    this.serviceUrl = null
  }

  async join(client: MatrixClient, room: Room) {
    if (this.roomId !== null) {
      await this.leave()
    }

    this.client = client
    this.room = room
    this.roomId = room.roomId
    this.roomName = room.name
    this.phase = "joining"
    this.error = null
    this.errorRoomId = room.roomId

    try {
      const serviceUrl =
        this.serviceUrl ?? (await discoverLivekitServiceUrl(client))

      if (!serviceUrl) {
        this.error = GROUP_CALL_UNSUPPORTED
        await this.leave(true)

        return
      }

      await requestMicrophone()

      const session = client.matrixRTC.getRoomSession(room)
      const transport = sessionTransport(session, serviceUrl)
      const openIdToken = await client.getOpenIdToken()
      const access = await fetchLivekitAccess(
        client,
        transport.livekit_service_url,
        room.roomId,
        openIdToken,
        client.getDeviceId() ?? "",
      )
      const livekit = createLivekitRoom(this.audioPrefs)

      this.session = session
      this.livekit = livekit
      this.unbindRoom = bindLivekitRoom(livekit, {
        onParticipants: () => this.refresh(),
        onConnection: state => {
          this.phase = phaseFromConnection(state)

          if (this.phase === "idle") {
            void this.leave()
          }
        },
        onAudioElement: (element, attached) => {
          element.muted = this.deafened
          this.audio = attached
            ? [...this.audio, element]
            : this.audio.filter(item => item !== element)
        },
        onPlayback: canPlay => {
          this.canPlayAudio = canPlay
        },
      })

      const onMemberships = () => this.refresh()

      session.on(MatrixRTCSessionEvent.MembershipsChanged, onMemberships)
      this.unbindSession = () =>
        session.off(MatrixRTCSessionEvent.MembershipsChanged, onMemberships)

      await connectLivekitRoom(livekit, access)
      joinSession(client, session, transport)
      this.phase = phaseFromConnection(livekit.state)
      this.canPlayAudio = livekit.canPlaybackAudio
      this.refresh()
      await publishMicrophone(livekit)
      this.muted = !livekit.localParticipant.isMicrophoneEnabled
      this.refresh()
    } catch (error) {
      this.error = mediaError(errorCode(error))

      if (this.phase !== "connected") {
        await this.leave(true)
      }
    }
  }

  async useAudio(prefs: AudioPrefs) {
    const previous = this.audioPrefs

    this.audioPrefs = prefs

    if (this.livekit) {
      await applyAudioPrefs(this.livekit, previous, prefs)
    }
  }

  async toggleMute() {
    const livekit = this.livekit

    if (!livekit) {
      return
    }

    try {
      await livekit.localParticipant.setMicrophoneEnabled(this.muted)
      this.muted = !livekit.localParticipant.isMicrophoneEnabled
    } catch (error) {
      this.error = mediaError(errorCode(error))
    }

    this.refresh()
  }

  toggleDeafen() {
    this.deafened = !this.deafened

    for (const element of this.audio) {
      element.muted = this.deafened
    }
  }

  async startAudio() {
    await this.livekit?.startAudio()
    this.canPlayAudio = this.livekit?.canPlaybackAudio ?? true
  }

  async leave(keepError = false) {
    const { session, livekit } = this

    this.phase = "leaving"
    this.unbindRoom?.()
    this.unbindSession?.()
    this.unbindRoom = null
    this.unbindSession = null

    for (const element of this.audio) {
      element.remove()
    }

    this.audio = []
    this.session = null
    this.livekit = null

    if (session?.isJoined()) {
      await session.leave(LEAVE_TIMEOUT_MS)
    }

    await livekit?.disconnect()

    this.roomId = null
    this.roomName = ""
    this.room = null
    this.client = null
    this.participants = []
    this.muted = false
    this.phase = "idle"

    if (!keepError) {
      this.error = null
    }
  }

  private refresh() {
    const { client, session, livekit, room } = this

    if (!client || !session || !livekit || !room) {
      return
    }

    this.participants = mergeParticipants(
      session.memberships.map(digestMembership),
      livekitParticipants(livekit),
      {
        userId: client.getUserId() ?? "",
        deviceId: client.getDeviceId() ?? "",
      },
      userId => ({
        name: room.getMember(userId)?.name ?? localpart(userId),
        avatarUrl: memberAvatarUrl(room.getMember(userId)),
      }),
    )
  }
}

export const groupCallStore = new GroupCallStore()
