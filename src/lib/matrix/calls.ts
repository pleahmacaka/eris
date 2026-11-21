import type { CallState } from "matrix-js-sdk/lib/webrtc/call"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import type { Message } from "#lib/i18n/translate.js"

export type CallPhase =
  | "outgoing"
  | "incoming"
  | "connecting"
  | "active"
  | "ended"

export type CallDirection = "inbound" | "outbound"

export const CALL_PHASE_LABEL: Record<CallPhase, MessageKey> = {
  outgoing: "call.phase.outgoing",
  incoming: "call.phase.incoming",
  connecting: "call.phase.connecting",
  active: "call.phase.active",
  ended: "call.phase.ended",
}

export const callPhase = (
  state: `${CallState}`,
  direction: CallDirection,
): CallPhase => {
  switch (state) {
    case "ended":
      return "ended"
    case "connected":
      return "active"
    case "connecting":
    case "create_answer":
      return "connecting"
    case "ringing":
      return "incoming"
    default:
      return direction === "inbound" ? "incoming" : "outgoing"
  }
}

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, "0")

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

const hangupKey = (reason: string | undefined): MessageKey => {
  switch (reason) {
    case undefined:
    case "user_hangup":
      return "timeline.call.ended"
    case "invite_timeout":
      return "call.hangup.noAnswer"
    case "user_busy":
      return "call.hangup.busy"
    case "answered_elsewhere":
      return "call.hangup.answeredElsewhere"
    case "ice_failed":
    case "ice_timeout":
    case "signalling_timeout":
      return "call.hangup.network"
    case "no_user_media":
    case "user_media_failed":
      return "errors.microphone.denied"
    default:
      return "call.hangup.failed"
  }
}

export const hangupMessage = (reason: string | undefined): Message => ({
  key: hangupKey(reason),
})

export const canPlaceVoiceCall = (joinedCount: number, supportsVoip: boolean) =>
  supportsVoip && joinedCount === 2
