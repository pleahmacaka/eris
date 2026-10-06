import { NOTE_REPO } from "$lib/data/note"

export type Platform = "windows" | "android"

export type Download = {
  platform: Platform
  kind: "installer" | "msi" | "apk"
  url: string
  size: number
}

export type Release = {
  version: string
  url: string
  published: string | null
  downloads: Download[]
}

type Asset = { name: string; browser_download_url: string; size: number }

type GitHubRelease = {
  tag_name: string
  html_url: string
  draft: boolean
  prerelease: boolean
  published_at: string | null
  assets: Asset[]
}

const TAG = /^(\d+\.\d+\.\d+.*)$/

const ENDPOINT = `https://api.github.com/repos/${NOTE_REPO}/releases?per_page=30`

const TIMEOUT_MS = 5000

const ORDER: Download["kind"][] = ["installer", "msi", "apk"]

type Fetch = typeof globalThis.fetch

const download = (asset: Asset): Download | null => {
  const name = asset.name.toLowerCase()
  const kind = name.endsWith(".exe")
    ? "installer"
    : name.endsWith(".msi")
      ? "msi"
      : name.endsWith(".apk")
        ? "apk"
        : null

  if (!kind) {
    return null
  }

  return {
    platform: kind === "apk" ? "android" : "windows",
    kind,
    url: asset.browser_download_url,
    size: asset.size,
  }
}

async function fetchLatest(fetch: Fetch): Promise<Release | null> {
  const res = await fetch(ENDPOINT, {
    headers: { accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!res.ok) {
    return null
  }

  const releases = (await res.json()) as GitHubRelease[]
  const release = releases.find(
    r => !r.draft && !r.prerelease && TAG.test(r.tag_name),
  )

  if (!release) {
    return null
  }

  return {
    version: release.tag_name.replace(TAG, "$1"),
    url: release.html_url,
    published: release.published_at,
    downloads: release.assets
      .map(download)
      .filter(d => d !== null)
      .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)),
  }
}

export const latestNote = (fetch: Fetch) => fetchLatest(fetch).catch(() => null)
