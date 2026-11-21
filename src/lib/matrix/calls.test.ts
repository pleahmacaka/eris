import { describe, expect, test } from "bun:test"
import {
  CALL_PHASE_LABEL,
  callPhase,
  canPlaceVoiceCall,
  formatDuration,
  hangupMessage,
} from "./calls"

describe("callPhase", () => {
  test("maps pre-answer states by direction", () => {
    expect(callPhase("fledgling", "outbound")).toBe("outgoing")
    expect(callPhase("invite_sent", "outbound")).toBe("outgoing")
    expect(callPhase("wait_local_media", "inbound")).toBe("incoming")
    expect(callPhase("ringing", "inbound")).toBe("incoming")
  })

  test("maps answer and connection states", () => {
    expect(callPhase("create_answer", "inbound")).toBe("connecting")
    expect(callPhase("connecting", "outbound")).toBe("connecting")
    expect(callPhase("connected", "outbound")).toBe("active")
    expect(callPhase("ended", "inbound")).toBe("ended")
  })

  test("labels every phase", () => {
    expect(CALL_PHASE_LABEL).toEqual({
      outgoing: "call.phase.outgoing",
      incoming: "call.phase.incoming",
      connecting: "call.phase.connecting",
      active: "call.phase.active",
      ended: "call.phase.ended",
    })
  })
})

describe("formatDuration", () => {
  test("zero-pads minutes and seconds", () => {
    expect(formatDuration(0)).toBe("00:00")
    expect(formatDuration(65_000)).toBe("01:05")
    expect(formatDuration(3_600_000 + 61_000)).toBe("1:01:01")
    expect(formatDuration(-5)).toBe("00:00")
  })
})

describe("hangupMessage", () => {
  test("maps each hangup reason to its message", () => {
    expect(hangupMessage("user_hangup").key).toBe("timeline.call.ended")
    expect(hangupMessage("invite_timeout").key).toBe("call.hangup.noAnswer")
    expect(hangupMessage("no_user_media").key).toBe("errors.microphone.denied")
    expect(hangupMessage("ice_failed").key).toBe("call.hangup.network")
    expect(hangupMessage("something_else").key).toBe("call.hangup.failed")
  })
})

describe("canPlaceVoiceCall", () => {
  test("allows only two-member rooms with VoIP support", () => {
    expect(canPlaceVoiceCall(2, true)).toBe(true)
    expect(canPlaceVoiceCall(3, true)).toBe(false)
    expect(canPlaceVoiceCall(2, false)).toBe(false)
  })
})
