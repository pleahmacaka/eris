import { describe, expect, test } from "bun:test"
import { errorCode, loginError, mediaError, roomError } from "./errors"

describe("errorCode", () => {
  test("prefers the Matrix errcode and falls back to the error name", () => {
    expect(errorCode({ errcode: "M_FORBIDDEN", name: "MatrixError" })).toBe(
      "M_FORBIDDEN",
    )
    expect(errorCode(new DOMException("denied", "NotAllowedError"))).toBe(
      "NotAllowedError",
    )
    expect(errorCode("text")).toBeUndefined()
  })
})

describe("error messages", () => {
  test("map each cause to its message", () => {
    expect(loginError("M_FORBIDDEN").key).toBe("errors.login.credentials")
    expect(loginError(undefined).key).toBe("errors.login.unreachable")
    expect(roomError("M_NOT_FOUND").key).toBe("errors.room.userNotFound")
    expect(mediaError("NotAllowedError").key).toBe("errors.microphone.denied")
    expect(mediaError("Other").key).toBe("errors.call.failed")
  })
})
