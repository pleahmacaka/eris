import { describe, expect, test } from "bun:test"
import {
  AVATAR_THUMBNAIL,
  downloadUrl,
  isMissingMedia,
  isUnsupportedEndpoint,
  parseMxc,
  thumbnailKey,
  thumbnailUrl,
} from "./media"

const HOMESERVER = "https://example.org:8448"

describe("parseMxc", () => {
  test("splits the server name and the media id", () => {
    expect(parseMxc("mxc://example.org/AbC_123-x")).toEqual({
      server: "example.org",
      mediaId: "AbC_123-x",
    })
  })

  test("keeps a port or an IPv6 literal in the server name", () => {
    expect(parseMxc("mxc://example.org:8448/abc")?.server).toBe(
      "example.org:8448",
    )
    expect(parseMxc("mxc://[::1]:8448/abc")?.server).toBe("[::1]:8448")
  })

  test("rejects other schemes and missing parts", () => {
    expect(parseMxc(null)).toBeNull()
    expect(parseMxc(undefined)).toBeNull()
    expect(parseMxc("")).toBeNull()
    expect(parseMxc("https://example.org/a.png")).toBeNull()
    expect(parseMxc("mxc://example.org")).toBeNull()
    expect(parseMxc("mxc://example.org/")).toBeNull()
    expect(parseMxc("mxc:///abc")).toBeNull()
  })

  test("rejects ids that could change the request path", () => {
    expect(parseMxc("mxc://example.org/abc/def")).toBeNull()
    expect(parseMxc("mxc://example.org/..")).toBeNull()
    expect(parseMxc("mxc://example.org/abc?x=1")).toBeNull()
    expect(parseMxc("mxc://example.org/abc#frag")).toBeNull()
    expect(parseMxc("mxc://exa mple.org/abc")).toBeNull()
    expect(parseMxc("mxc://example.org/a%2Fb")).toBeNull()
  })
})

describe("media URLs", () => {
  const mxc = { server: "example.org", mediaId: "abc" }

  test("builds the authenticated thumbnail URL with the crop size", () => {
    expect(
      thumbnailUrl(HOMESERVER, mxc, AVATAR_THUMBNAIL, "authenticated"),
    ).toBe(
      "https://example.org:8448/_matrix/client/v1/media/thumbnail/example.org/abc?width=96&height=96&method=crop",
    )
  })

  test("builds the legacy thumbnail URL on the media prefix", () => {
    expect(
      thumbnailUrl(
        HOMESERVER,
        mxc,
        { width: 800, height: 600, method: "scale" },
        "legacy",
      ),
    ).toBe(
      "https://example.org:8448/_matrix/media/v3/thumbnail/example.org/abc?width=800&height=600&method=scale",
    )
  })

  test("builds download URLs for both endpoints", () => {
    expect(downloadUrl(HOMESERVER, mxc, "authenticated")).toBe(
      "https://example.org:8448/_matrix/client/v1/media/download/example.org/abc",
    )
    expect(downloadUrl(HOMESERVER, mxc, "legacy")).toBe(
      "https://example.org:8448/_matrix/media/v3/download/example.org/abc",
    )
  })

  test("keys the cache by mxc, size and method", () => {
    expect(thumbnailKey("mxc://example.org/abc", AVATAR_THUMBNAIL)).toBe(
      "mxc://example.org/abc|96x96|crop",
    )
  })
})

describe("endpoint fallback", () => {
  test("falls back when the server does not know the endpoint", () => {
    expect(isUnsupportedEndpoint(404, "M_UNRECOGNIZED")).toBe(true)
    expect(isUnsupportedEndpoint(400, "M_UNRECOGNIZED")).toBe(true)
    expect(isUnsupportedEndpoint(404, undefined)).toBe(true)
  })

  test("does not fall back for missing media or other failures", () => {
    expect(isUnsupportedEndpoint(404, "M_NOT_FOUND")).toBe(false)
    expect(isUnsupportedEndpoint(403, "M_FORBIDDEN")).toBe(false)
    expect(isUnsupportedEndpoint(500, undefined)).toBe(false)
    expect(isUnsupportedEndpoint(undefined, undefined)).toBe(false)
  })

  test("treats client errors as missing, but not rate limits or outages", () => {
    expect(isMissingMedia(404)).toBe(true)
    expect(isMissingMedia(403)).toBe(true)
    expect(isMissingMedia(429)).toBe(false)
    expect(isMissingMedia(502)).toBe(false)
  })
})
