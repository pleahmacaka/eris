import {
  type ConnectionState,
  type RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client"
import {
  AutoDiscovery,
  type IOpenIDToken,
  type MatrixClient,
  Method,
} from "matrix-js-sdk"
import type { MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc"
import { type AudioPrefs, captureOptions } from "../media/devices"
import { digestMembership } from "./digest"
import {
  type LivekitParticipantDigest,
  type LivekitTransport,
  livekitServiceUrlFromTransports,
  livekitServiceUrlFromWellKnown,
  oldestTransport,
  participantIdentity,
} from "./groupCall"

const RTC_TRANSPORTS_PREFIX = "/_matrix/client/unstable/org.matrix.msc4143"

const fetchRtcTransports = async (client: MatrixClient) => {
  try {
    const response = await client.http.authedRequest<{
      rtc_transports?: unknown
    }>(Method.Get, "/rtc/transports", undefined, undefined, {
      prefix: RTC_TRANSPORTS_PREFIX,
    })

    return response.rtc_transports
  } catch (error) {
    console.warn("rtc transport discovery failed", error)

    return undefined
  }
}

const fetchWellKnown = async (domain: string | null) => {
  if (!domain) {
    return undefined
  }

  try {
    return await AutoDiscovery.getRawClientConfig(domain)
  } catch (error) {
    console.warn("well-known discovery failed", error)

    return undefined
  }
}

export const discoverLivekitServiceUrl = async (client: MatrixClient) =>
  livekitServiceUrlFromTransports(await fetchRtcTransports(client)) ??
  livekitServiceUrlFromWellKnown(await fetchWellKnown(client.getDomain()))

export type LivekitAccess = { url: string; jwt: string }

export const fetchLivekitAccess = (
  client: MatrixClient,
  serviceUrl: string,
  roomId: string,
  openIdToken: IOpenIDToken,
  deviceId: string,
) =>
  client.http.requestOtherUrl<LivekitAccess>(
    Method.Post,
    `${serviceUrl}/sfu/get`,
    {
      room: roomId,
      openid_token: openIdToken,
      device_id: deviceId,
    },
  )

export const sessionTransport = (
  session: MatrixRTCSession,
  serviceUrl: string,
): LivekitTransport =>
  oldestTransport(session.memberships.map(digestMembership)) ?? {
    type: "livekit",
    livekit_service_url: serviceUrl,
  }

export const joinSession = (
  client: MatrixClient,
  session: MatrixRTCSession,
  transport: LivekitTransport,
) => {
  const userId = client.getUserId() ?? ""
  const deviceId = client.getDeviceId() ?? ""

  session.join(
    { userId, deviceId, memberId: participantIdentity(userId, deviceId) },
    [transport],
    {
      callIntent: "audio",
      callCapabilities: ["m.render_audio"],
      manageMediaKeys: false,
    },
  )
}

export const createLivekitRoom = (prefs: AudioPrefs) =>
  new Room({
    adaptiveStream: false,
    dynacast: false,
    audioCaptureDefaults: captureOptions(prefs),
    audioOutput: prefs.outputId ? { deviceId: prefs.outputId } : undefined,
  })

const SYSTEM_DEVICE = "default"

const switchDevice = (
  room: Room,
  kind: "audioinput" | "audiooutput",
  deviceId: string | null,
) => room.switchActiveDevice(kind, deviceId ?? SYSTEM_DEVICE, deviceId !== null)

const restartMicrophone = async (room: Room, prefs: AudioPrefs) => {
  room.options.audioCaptureDefaults = captureOptions(prefs)
  await room.localParticipant
    .getTrackPublication(Track.Source.Microphone)
    ?.audioTrack?.restartTrack(captureOptions(prefs))
}

const processingChanged = (previous: AudioPrefs, next: AudioPrefs) =>
  previous.echoCancellation !== next.echoCancellation ||
  previous.noiseSuppression !== next.noiseSuppression ||
  previous.autoGainControl !== next.autoGainControl

export const applyAudioPrefs = async (
  room: Room,
  previous: AudioPrefs,
  next: AudioPrefs,
) => {
  if (previous.outputId !== next.outputId) {
    await switchDevice(room, "audiooutput", next.outputId)
  }

  if (processingChanged(previous, next)) {
    await restartMicrophone(room, next)
  } else if (previous.inputId !== next.inputId) {
    await switchDevice(room, "audioinput", next.inputId)
  }
}

export const connectLivekitRoom = (room: Room, access: LivekitAccess) =>
  room.connect(access.url, access.jwt, {
    // WebKitGTK's webrtcbin does not implement the default "balanced" policy and never finishes the publisher handshake
    rtcConfig: { bundlePolicy: "max-bundle" },
  })

export const publishMicrophone = async (room: Room) => {
  await room.localParticipant.setMicrophoneEnabled(true)
  // WebKitGTK only writes a=ssrc after its first local description; without a second offer the SFU drops the audio
  await room.engine.negotiate()
}

export type LivekitHandlers = {
  onParticipants: () => void
  onConnection: (state: ConnectionState) => void
  onAudioElement: (element: HTMLMediaElement, attached: boolean) => void
  onPlayback: (canPlay: boolean) => void
}

export const bindLivekitRoom = (room: Room, handlers: LivekitHandlers) => {
  const refresh = () => handlers.onParticipants()
  const onSubscribed = (track: RemoteTrack) => {
    if (track.kind === Track.Kind.Audio) {
      handlers.onAudioElement(track.attach(), true)
    }

    refresh()
  }
  const onUnsubscribed = (track: RemoteTrack) => {
    if (track.kind === Track.Kind.Audio) {
      for (const element of track.detach()) {
        handlers.onAudioElement(element, false)
      }
    }

    refresh()
  }
  const onConnection = (state: ConnectionState) => handlers.onConnection(state)
  const onPlayback = () => handlers.onPlayback(room.canPlaybackAudio)

  room
    .on(RoomEvent.ParticipantConnected, refresh)
    .on(RoomEvent.ParticipantDisconnected, refresh)
    .on(RoomEvent.ActiveSpeakersChanged, refresh)
    .on(RoomEvent.TrackMuted, refresh)
    .on(RoomEvent.TrackUnmuted, refresh)
    .on(RoomEvent.LocalTrackPublished, refresh)
    .on(RoomEvent.LocalTrackUnpublished, refresh)
    .on(RoomEvent.TrackSubscribed, onSubscribed)
    .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
    .on(RoomEvent.ConnectionStateChanged, onConnection)
    .on(RoomEvent.AudioPlaybackStatusChanged, onPlayback)

  return () => {
    room
      .off(RoomEvent.ParticipantConnected, refresh)
      .off(RoomEvent.ParticipantDisconnected, refresh)
      .off(RoomEvent.ActiveSpeakersChanged, refresh)
      .off(RoomEvent.TrackMuted, refresh)
      .off(RoomEvent.TrackUnmuted, refresh)
      .off(RoomEvent.LocalTrackPublished, refresh)
      .off(RoomEvent.LocalTrackUnpublished, refresh)
      .off(RoomEvent.TrackSubscribed, onSubscribed)
      .off(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .off(RoomEvent.ConnectionStateChanged, onConnection)
      .off(RoomEvent.AudioPlaybackStatusChanged, onPlayback)
  }
}

export const livekitParticipants = (room: Room): LivekitParticipantDigest[] =>
  [room.localParticipant, ...room.remoteParticipants.values()].map(
    participant => ({
      identity: participant.identity,
      speaking: participant.isSpeaking,
      micEnabled: participant.isMicrophoneEnabled,
    }),
  )
