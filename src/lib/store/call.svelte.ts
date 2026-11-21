import type { MatrixClient } from "matrix-js-sdk"
import {
  type CallError,
  CallErrorCode,
  type CallState,
  type MatrixCall,
} from "matrix-js-sdk/lib/webrtc/call"
import type { Message } from "#lib/i18n/translate.js"
import {
  CALL_PHASE_LABEL,
  type CallDirection,
  type CallPhase,
  callPhase,
  formatDuration,
  hangupMessage,
} from "#lib/matrix/calls.js"
import { errorCode, mediaError } from "#lib/matrix/errors.js"
import { bindCall, watchIncomingCalls } from "#lib/matrix/voip.js"
import { type AudioPrefs, DEFAULT_AUDIO_PREFS } from "#lib/media/devices.js"
import { requestMicrophone } from "#lib/media/microphone.js"

const ENDED_VISIBLE_MS = 5000

class CallStore {
  phase = $state<CallPhase | null>(null)
  direction = $state<CallDirection>("outbound")
  roomId = $state<string | null>(null)
  peerName = $state("")
  muted = $state(false)
  message = $state<Message | null>(null)
  streams = $state.raw<MediaStream[]>([])

  private connectedAt = $state<number | null>(null)
  private now = $state(Date.now())

  label = $derived(this.phase ? CALL_PHASE_LABEL[this.phase] : null)
  duration = $derived(
    this.connectedAt === null
      ? ""
      : formatDuration(this.now - this.connectedAt),
  )
  active = $derived(this.phase !== null && this.phase !== "ended")

  private call: MatrixCall | null = null
  private client: MatrixClient | null = null
  private audio = DEFAULT_AUDIO_PREFS
  private unbind: (() => void) | null = null
  private unwatch: (() => void) | null = null
  private ticker: ReturnType<typeof setInterval> | null = null
  private endedTimer: ReturnType<typeof setTimeout> | null = null

  watch(client: MatrixClient, peerNameOf: (roomId: string) => string) {
    this.unwatch?.()
    this.client = client
    void this.applyAudio()
    this.unwatch = watchIncomingCalls(client, call => {
      if (this.active) {
        call.reject()

        return
      }

      this.adopt(call, "inbound", peerNameOf(call.roomId ?? ""))
    })
  }

  stopWatching() {
    this.unwatch?.()
    this.unwatch = null
    this.client = null
    this.call?.hangup(CallErrorCode.UserHangup, false)
    this.reset()
  }

  useAudio(prefs: AudioPrefs) {
    this.audio = prefs

    return this.applyAudio()
  }

  place(client: MatrixClient, roomId: string, peerName: string) {
    if (this.active) {
      return
    }

    const call = client.createCall(roomId)

    if (!call) {
      this.message = { key: "call.unsupported" }

      return
    }

    this.adopt(call, "outbound", peerName)
    requestMicrophone()
      .then(() => call.placeVoiceCall())
      .catch((error: unknown) => {
        this.message = mediaError(errorCode(error))
        call.hangup(CallErrorCode.NoUserMedia, false)
      })
  }

  answer() {
    const call = this.call

    if (!call) {
      return
    }

    requestMicrophone()
      .then(() => call.answer(true, false))
      .catch((error: unknown) => {
        this.message = mediaError(errorCode(error))
        call.hangup(CallErrorCode.NoUserMedia, false)
      })
  }

  reject() {
    this.call?.reject()
  }

  hangup() {
    this.call?.hangup(CallErrorCode.UserHangup, false)
  }

  async toggleMute() {
    const call = this.call

    if (!call) {
      return
    }

    await call.setMicrophoneMuted(!this.muted)
    this.muted = call.isMicrophoneMuted()
  }

  dismiss() {
    if (this.phase === "ended") {
      this.reset()
    }
  }

  private async applyAudio() {
    const handler = this.client?.getMediaHandler()
    const { inputId, autoGainControl, echoCancellation, noiseSuppression } =
      this.audio

    if (handler) {
      await handler.setAudioSettings({
        autoGainControl,
        echoCancellation,
        noiseSuppression,
      })
      await handler.setAudioInput(inputId ?? "")
    }
  }

  private adopt(call: MatrixCall, direction: CallDirection, peerName: string) {
    this.clearTimers()
    this.unbind?.()
    this.call = call
    this.direction = direction
    this.roomId = call.roomId ?? null
    this.peerName = peerName
    this.muted = false
    this.message = null
    this.streams = []
    this.connectedAt = null
    this.phase = callPhase(call.state, direction)
    this.unbind = bindCall(call, {
      onState: state => this.onState(state),
      onStreams: streams => {
        this.streams = streams
      },
      onHangup: reason => {
        this.message ??= hangupMessage(reason)
        this.finish()
      },
      onError: (error: CallError) => {
        this.message = mediaError(error.code)
      },
    })
  }

  private onState(state: CallState) {
    this.phase = callPhase(state, this.direction)

    if (this.phase === "active" && this.connectedAt === null) {
      this.connectedAt = Date.now()
      this.now = this.connectedAt
      this.ticker = setInterval(() => {
        this.now = Date.now()
      }, 1000)
    }

    if (this.phase === "ended") {
      this.finish()
    }
  }

  private finish() {
    if (this.ticker) {
      clearInterval(this.ticker)
      this.ticker = null
    }

    this.unbind?.()
    this.unbind = null
    this.call = null
    this.streams = []
    this.phase = "ended"
    this.message ??= hangupMessage(undefined)
    this.endedTimer ??= setTimeout(() => this.reset(), ENDED_VISIBLE_MS)
  }

  private clearTimers() {
    if (this.ticker) {
      clearInterval(this.ticker)
      this.ticker = null
    }

    if (this.endedTimer) {
      clearTimeout(this.endedTimer)
      this.endedTimer = null
    }
  }

  private reset() {
    this.clearTimers()
    this.unbind?.()
    this.unbind = null
    this.call = null
    this.phase = null
    this.roomId = null
    this.peerName = ""
    this.muted = false
    this.message = null
    this.streams = []
    this.connectedAt = null
  }
}

export const callStore = new CallStore()
