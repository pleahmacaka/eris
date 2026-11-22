import type { MatrixClient } from "matrix-js-sdk"
import { SvelteMap } from "svelte/reactivity"
import { errorCode } from "#lib/matrix/errors.js"
import {
  downloadUrl,
  isMissingMedia,
  isUnsupportedEndpoint,
  type MediaEndpoint,
  parseMxc,
  type ThumbnailSpec,
  thumbnailKey,
  thumbnailUrl,
} from "#lib/matrix/media.js"

const UPLOAD_SIZE_FIELD = "m.upload.size"

class MediaError extends Error {
  constructor(readonly status: number) {
    super(`media request failed with status ${status}`)
  }
}

const errcodeOf = async (response: Response) => {
  try {
    return errorCode(await response.json())
  } catch {
    return undefined
  }
}

const httpStatus = (error: unknown) =>
  typeof error === "object" && error !== null && "httpStatus" in error
    ? (error.httpStatus as number | undefined)
    : undefined

const readUploadLimit = async (client: MatrixClient) => {
  try {
    const config = await client.getMediaConfig(true).catch((error: unknown) => {
      if (isUnsupportedEndpoint(httpStatus(error), errorCode(error))) {
        return client.getMediaConfig(false)
      }

      throw error
    })
    const limit = config[UPLOAD_SIZE_FIELD]

    return typeof limit === "number" ? limit : null
  } catch (error) {
    console.warn("media config request failed", error)

    return null
  }
}

class MediaStore {
  uploadLimit = $state<number | null>(null)

  private thumbnails = new SvelteMap<string, string | null>()
  private pending = new Map<string, Promise<void>>()
  private client: MatrixClient | null = null
  private legacy = false

  attach(client: MatrixClient) {
    this.client = client
    void this.loadUploadLimit(client)
  }

  detach() {
    for (const url of this.thumbnails.values()) {
      if (url) {
        URL.revokeObjectURL(url)
      }
    }

    this.thumbnails.clear()
    this.pending.clear()
    this.client = null
    this.legacy = false
    this.uploadLimit = null
  }

  thumbnail(mxc: string | null | undefined, spec: ThumbnailSpec) {
    return mxc ? (this.thumbnails.get(thumbnailKey(mxc, spec)) ?? null) : null
  }

  loadThumbnail(mxc: string, spec: ThumbnailSpec) {
    const key = thumbnailKey(mxc, spec)
    const client = this.client

    if (!client || this.thumbnails.has(key)) {
      return Promise.resolve()
    }

    const pending =
      this.pending.get(key) ??
      this.fetchThumbnail(client, key, mxc, spec).finally(() =>
        this.pending.delete(key),
      )

    this.pending.set(key, pending)

    return pending
  }

  async download(mxc: string) {
    const parsed = parseMxc(mxc)
    const client = this.client

    if (!parsed || !client) {
      throw new MediaError(404)
    }

    return this.fetchBlob(client, endpoint =>
      downloadUrl(client.getHomeserverUrl(), parsed, endpoint),
    )
  }

  async upload(file: File, onProgress?: (fraction: number) => void) {
    const client = this.client

    if (!client) {
      throw new MediaError(401)
    }

    const { content_uri } = await client.uploadContent(file, {
      progressHandler: ({ loaded, total }) =>
        onProgress?.(total > 0 ? loaded / total : 0),
    })

    return content_uri
  }

  private async loadUploadLimit(client: MatrixClient) {
    const limit = await readUploadLimit(client)

    if (this.client === client) {
      this.uploadLimit = limit
    }
  }

  private async fetchThumbnail(
    client: MatrixClient,
    key: string,
    mxc: string,
    spec: ThumbnailSpec,
  ) {
    const parsed = parseMxc(mxc)

    if (!parsed) {
      this.thumbnails.set(key, null)

      return
    }

    try {
      const blob = await this.fetchBlob(client, endpoint =>
        thumbnailUrl(client.getHomeserverUrl(), parsed, spec, endpoint),
      )

      if (this.client === client) {
        this.thumbnails.set(key, URL.createObjectURL(blob))
      }
    } catch (error) {
      if (
        this.client === client &&
        error instanceof MediaError &&
        isMissingMedia(error.status)
      ) {
        this.thumbnails.set(key, null)
      }
    }
  }

  private async fetchBlob(
    client: MatrixClient,
    urlFor: (endpoint: MediaEndpoint) => string,
  ) {
    if (!this.legacy) {
      const authenticated = () =>
        fetch(urlFor("authenticated"), {
          headers: { Authorization: `Bearer ${client.getAccessToken()}` },
        })
      const first = await authenticated()
      // an SDK request refreshes an expired OAuth access token; raw fetch cannot
      const response =
        first.status === 401
          ? await client.whoami().then(authenticated, () => first)
          : first

      if (response.ok) {
        return response.blob()
      }

      if (!isUnsupportedEndpoint(response.status, await errcodeOf(response))) {
        throw new MediaError(response.status)
      }

      this.legacy = true
    }

    const response = await fetch(urlFor("legacy"))

    if (!response.ok) {
      throw new MediaError(response.status)
    }

    return response.blob()
  }
}

export const mediaStore = new MediaStore()
