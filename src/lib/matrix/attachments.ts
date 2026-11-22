import { parseMxc } from "./media"

export type AttachmentKind = "image" | "video" | "audio" | "file"

export type ImageSize = { width: number; height: number }

export type AttachmentDigest = {
  kind: AttachmentKind
  url: string
  name: string
  mimeType: string
  size: number | null
  dimensions: ImageSize | null
}

type FileLike = { name: string; type: string; size: number }

const INLINE_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]

const FALLBACK_MIME_TYPE = "application/octet-stream"

const MSGTYPE = {
  image: "m.image",
  video: "m.video",
  audio: "m.audio",
  file: "m.file",
} as const

const KIND_BY_MSGTYPE = new Map<string, AttachmentKind>(
  (Object.keys(MSGTYPE) as AttachmentKind[]).map(kind => [MSGTYPE[kind], kind]),
)

export const attachmentKind = (mimeType: string): AttachmentKind => {
  if (INLINE_IMAGE_TYPES.includes(mimeType)) {
    return "image"
  }

  const family = mimeType.slice(0, mimeType.indexOf("/"))

  return family === "video" || family === "audio" ? family : "file"
}

export const attachmentContent = (
  file: FileLike,
  url: string,
  dimensions: ImageSize | null,
) => ({
  msgtype: MSGTYPE[attachmentKind(file.type)],
  body: file.name,
  filename: file.name,
  url,
  info: {
    mimetype: file.type || FALLBACK_MIME_TYPE,
    size: file.size,
    ...(dimensions ? { w: dimensions.width, h: dimensions.height } : {}),
  },
})

const text = (value: unknown) => (typeof value === "string" ? value : "")

const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {}

export const parseAttachment = (
  content: Record<string, unknown>,
): AttachmentDigest | null => {
  const kind = KIND_BY_MSGTYPE.get(text(content.msgtype))
  const url = text(content.url)

  if (!kind || parseMxc(url) === null) {
    return null
  }

  const info = record(content.info)
  const width = count(info.w)
  const height = count(info.h)

  return {
    kind,
    url,
    name: text(content.filename) || text(content.body),
    mimeType: text(info.mimetype),
    size: count(info.size),
    dimensions: width && height ? { width, height } : null,
  }
}

export const fitWithin = (
  size: ImageSize | null,
  bounds: ImageSize,
): ImageSize | null => {
  if (!size) {
    return null
  }

  const scale = Math.min(
    1,
    bounds.width / size.width,
    bounds.height / size.height,
  )

  return {
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  }
}
