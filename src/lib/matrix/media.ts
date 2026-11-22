export type Mxc = { server: string; mediaId: string }

export type ThumbnailSpec = {
  width: number
  height: number
  method: "crop" | "scale"
}

export type MediaEndpoint = "authenticated" | "legacy"

export const AVATAR_THUMBNAIL: ThumbnailSpec = {
  width: 96,
  height: 96,
  method: "crop",
}

export const AVATAR_LARGE: ThumbnailSpec = {
  width: 256,
  height: 256,
  method: "crop",
}

export const MESSAGE_THUMBNAIL: ThumbnailSpec = {
  width: 800,
  height: 600,
  method: "scale",
}

const MXC_SCHEME = "mxc://"

const ALPHANUMERIC =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

const SERVER_CHARS = `${ALPHANUMERIC}-.:[]`

const MEDIA_ID_CHARS = `${ALPHANUMERIC}-_`

const MEDIA_PREFIX: Record<MediaEndpoint, string> = {
  authenticated: "/_matrix/client/v1/media",
  legacy: "/_matrix/media/v3",
}

const madeOf = (value: string | undefined, allowed: string) =>
  value !== undefined &&
  value !== "" &&
  [...value].every(char => allowed.includes(char))

export const parseMxc = (uri: string | null | undefined): Mxc | null => {
  if (!uri?.startsWith(MXC_SCHEME)) {
    return null
  }

  const [server, mediaId, ...rest] = uri.slice(MXC_SCHEME.length).split("/")

  return rest.length === 0 &&
    madeOf(server, SERVER_CHARS) &&
    madeOf(mediaId, MEDIA_ID_CHARS)
    ? { server, mediaId }
    : null
}

const mediaUrl = (
  homeserver: string,
  kind: "thumbnail" | "download",
  mxc: Mxc,
  endpoint: MediaEndpoint,
) =>
  `${homeserver}${MEDIA_PREFIX[endpoint]}/${kind}/${mxc.server}/${mxc.mediaId}`

export const thumbnailUrl = (
  homeserver: string,
  mxc: Mxc,
  spec: ThumbnailSpec,
  endpoint: MediaEndpoint,
) =>
  `${mediaUrl(homeserver, "thumbnail", mxc, endpoint)}?width=${spec.width}&height=${spec.height}&method=${spec.method}`

export const downloadUrl = (
  homeserver: string,
  mxc: Mxc,
  endpoint: MediaEndpoint,
) => mediaUrl(homeserver, "download", mxc, endpoint)

export const thumbnailKey = (mxc: string, spec: ThumbnailSpec) =>
  `${mxc}|${spec.width}x${spec.height}|${spec.method}`

export const isUnsupportedEndpoint = (
  status: number | undefined,
  errcode: string | undefined,
) => errcode === "M_UNRECOGNIZED" || (status === 404 && errcode === undefined)

export const isMissingMedia = (status: number) =>
  status >= 400 && status < 500 && status !== 429
