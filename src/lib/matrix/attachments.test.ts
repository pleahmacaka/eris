import { describe, expect, test } from "bun:test"
import {
  attachmentContent,
  attachmentKind,
  fitWithin,
  parseAttachment,
} from "./attachments"

const MXC = "mxc://example.org/abc"

describe("attachmentKind", () => {
  test("shows web image formats inline", () => {
    expect(attachmentKind("image/png")).toBe("image")
    expect(attachmentKind("image/jpeg")).toBe("image")
    expect(attachmentKind("image/gif")).toBe("image")
    expect(attachmentKind("image/webp")).toBe("image")
  })

  test("sends images a browser cannot draw safely as files", () => {
    expect(attachmentKind("image/svg+xml")).toBe("file")
    expect(attachmentKind("image/heic")).toBe("file")
  })

  test("picks players for video and audio", () => {
    expect(attachmentKind("video/mp4")).toBe("video")
    expect(attachmentKind("audio/ogg")).toBe("audio")
  })

  test("falls back to a file for everything else", () => {
    expect(attachmentKind("text/plain")).toBe("file")
    expect(attachmentKind("application/zip")).toBe("file")
    expect(attachmentKind("")).toBe("file")
    expect(attachmentKind("video")).toBe("file")
  })
})

describe("attachmentContent", () => {
  test("builds an m.image event with the picture size", () => {
    expect(
      attachmentContent(
        { name: "cat.png", type: "image/png", size: 1234 },
        MXC,
        { width: 640, height: 480 },
      ),
    ).toEqual({
      msgtype: "m.image",
      body: "cat.png",
      filename: "cat.png",
      url: MXC,
      info: { mimetype: "image/png", size: 1234, w: 640, h: 480 },
    })
  })

  test("builds m.video, m.audio and m.file events from the MIME type", () => {
    const msgtype = (type: string) =>
      attachmentContent({ name: "a", type, size: 1 }, MXC, null).msgtype

    expect(msgtype("video/webm")).toBe("m.video")
    expect(msgtype("audio/mpeg")).toBe("m.audio")
    expect(msgtype("text/plain")).toBe("m.file")
  })

  test("names a generic type when the browser reports none", () => {
    expect(
      attachmentContent({ name: "blob", type: "", size: 5 }, MXC, null),
    ).toEqual({
      msgtype: "m.file",
      body: "blob",
      filename: "blob",
      url: MXC,
      info: { mimetype: "application/octet-stream", size: 5 },
    })
  })
})

describe("parseAttachment", () => {
  test("reads an image event", () => {
    expect(
      parseAttachment({
        msgtype: "m.image",
        body: "cat.png",
        url: MXC,
        info: { mimetype: "image/png", size: 1234, w: 640, h: 480 },
      }),
    ).toEqual({
      kind: "image",
      url: MXC,
      name: "cat.png",
      mimeType: "image/png",
      size: 1234,
      dimensions: { width: 640, height: 480 },
    })
  })

  test("prefers the filename over a caption body", () => {
    expect(
      parseAttachment({
        msgtype: "m.file",
        body: "the report",
        filename: "report.pdf",
        url: MXC,
      }),
    ).toMatchObject({ kind: "file", name: "report.pdf", size: null })
  })

  test("tolerates missing or malformed info", () => {
    expect(
      parseAttachment({
        msgtype: "m.video",
        body: "clip.mp4",
        url: MXC,
        info: { size: "big", w: 0, h: -3 },
      }),
    ).toEqual({
      kind: "video",
      url: MXC,
      name: "clip.mp4",
      mimeType: "",
      size: null,
      dimensions: null,
    })
  })

  test("ignores text messages and unusable media URLs", () => {
    expect(parseAttachment({ msgtype: "m.text", body: "hi" })).toBeNull()
    expect(parseAttachment({ msgtype: "constructor", url: MXC })).toBeNull()
    expect(
      parseAttachment({ msgtype: "m.image", body: "x", url: "https://x/y" }),
    ).toBeNull()
    expect(parseAttachment({ msgtype: "m.image", body: "x" })).toBeNull()
  })
})

describe("fitWithin", () => {
  const bounds = { width: 400, height: 300 }

  test("keeps small images at their own size", () => {
    expect(fitWithin({ width: 200, height: 100 }, bounds)).toEqual({
      width: 200,
      height: 100,
    })
  })

  test("scales down by the tighter side and keeps the ratio", () => {
    expect(fitWithin({ width: 1600, height: 800 }, bounds)).toEqual({
      width: 400,
      height: 200,
    })
    expect(fitWithin({ width: 600, height: 1200 }, bounds)).toEqual({
      width: 150,
      height: 300,
    })
  })

  test("has no box without a known size", () => {
    expect(fitWithin(null, bounds)).toBeNull()
  })
})
