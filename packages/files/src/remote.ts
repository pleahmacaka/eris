export type Remote = {
  url: string
  flags: string[]
  name: string
  icon: string
  label: string
}

const HOSTS: Record<string, { icon: string; label: string }> = {
  "github.com": { icon: "simple-icons:github", label: "GitHub" },
  "gitlab.com": { icon: "simple-icons:gitlab", label: "GitLab" },
  "huggingface.co": { icon: "simple-icons:huggingface", label: "Hugging Face" },
  "bitbucket.org": { icon: "simple-icons:bitbucket", label: "Bitbucket" },
  "codeberg.org": { icon: "simple-icons:codeberg", label: "Codeberg" },
  "gitea.com": { icon: "simple-icons:gitea", label: "Gitea" },
  "git.sr.ht": { icon: "simple-icons:sourcehut", label: "SourceHut" },
}

const HUB_KINDS = new Set(["datasets", "spaces"])

const locate = (address: string) => {
  if (address.startsWith("git@")) {
    const colon = address.indexOf(":")

    return colon < 0
      ? null
      : { host: address.slice(4, colon), path: address.slice(colon + 1) }
  }

  const withScheme = address.includes("://") ? address : `https://${address}`

  try {
    const url = new URL(withScheme)

    return ["https:", "http:", "ssh:"].includes(url.protocol)
      ? { host: url.hostname, path: url.pathname }
      : null
  } catch {
    return null
  }
}

const isRepository = (host: string, parts: string[]) => {
  if (host === "huggingface.co") {
    const owned = HUB_KINDS.has(parts[0]) ? parts.slice(1) : parts

    return owned.length === 2
  }

  if (host === "gitlab.com") {
    return parts.length >= 2 && !parts.includes("-")
  }

  return parts.length === 2
}

export const parseRemote = (input: string): Remote | null => {
  const [address = "", ...flags] = input.trim().split(" ").filter(Boolean)
  const found = locate(address)

  if (!found) {
    return null
  }

  const host = found.host.startsWith("www.") ? found.host.slice(4) : found.host
  const known = HOSTS[host]
  const parts = found.path.split("/").filter(Boolean)

  if (!known || !isRepository(host, parts)) {
    return null
  }

  const last = parts.at(-1) ?? ""
  const name = last.endsWith(".git") ? last.slice(0, -4) : last
  const url =
    address.includes("://") || address.startsWith("git@")
      ? address
      : `https://${address}`

  return { url, flags, name, ...known }
}
