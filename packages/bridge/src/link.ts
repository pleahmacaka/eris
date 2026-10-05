// Note registers this scheme, so Eris can open a note it finds in event text
export const NOTE_SCHEME = "arixlab-note"

export const NOTE_LINK = `${NOTE_SCHEME}://open?path=`

export const noteUrl = (path: string) =>
  `${NOTE_LINK}${encodeURIComponent(path.normalize("NFC"))}`

// only the shape of the link; the vault decides whether the path is a note
export const notePathOf = (url: string): string | null => {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== `${NOTE_SCHEME}:` || parsed.hostname !== "open") {
      return null
    }

    return parsed.searchParams.get("path") || null
  } catch {
    return null
  }
}
