import { trim } from "es-toolkit"
import { imageIcon } from "./image-icon"
import type { GitHead } from "./native"
import type { GitHost } from "./store/prefs.svelte"

export type RepoHost = {
  name: string | null
  domain: string | null
  icon: string
  slug: string | null
  path: string | null
  web: string | null
  fork: string | null
}

type Provider = {
  name: string
  icon: string
  domains: string[]
  marks: string[]
}

const PROVIDERS: Provider[] = [
  {
    name: "GitHub",
    icon: "simple-icons:github",
    domains: ["github.com"],
    marks: ["github"],
  },
  {
    name: "GitLab",
    icon: "simple-icons:gitlab",
    domains: ["gitlab.com"],
    marks: ["gitlab"],
  },
  {
    name: "Bitbucket",
    icon: "simple-icons:bitbucket",
    domains: ["bitbucket.org"],
    marks: ["bitbucket"],
  },
  {
    name: "Codeberg",
    icon: "simple-icons:codeberg",
    domains: ["codeberg.org"],
    marks: [],
  },
  {
    name: "Forgejo",
    icon: "simple-icons:forgejo",
    domains: [],
    marks: ["forgejo"],
  },
  {
    name: "Gitea",
    icon: "simple-icons:gitea",
    domains: ["gitea.com"],
    marks: ["gitea"],
  },
  {
    name: "Azure DevOps",
    icon: "simple-icons:azuredevops",
    domains: ["dev.azure.com", "visualstudio.com"],
    marks: [],
  },
  {
    name: "Hugging Face",
    icon: "simple-icons:huggingface",
    domains: ["huggingface.co", "hf.co"],
    marks: [],
  },
]

const GENERIC = "simple-icons:git"

const within = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`)

export const parseRemote = (url: string) => {
  if (url.includes("://")) {
    try {
      const parsed = new URL(url)

      return { host: parsed.hostname.toLowerCase(), path: parsed.pathname }
    } catch {
      return null
    }
  }

  const colon = url.indexOf(":")
  const login = url.slice(0, colon)

  if (colon < 2 || login.includes("/") || login.includes("\\")) {
    return null
  }

  return {
    host: login.slice(login.indexOf("@") + 1).toLowerCase(),
    path: url.slice(colon + 1),
  }
}

const repoPath = (path: string) => {
  const trimmed = trim(path, "/")

  return trimmed.endsWith(".git") ? trimmed.slice(0, -4) : trimmed
}

const slugOf = (path: string) => repoPath(path).toLowerCase()

const remoteUrl = (head: GitHead, name: string) =>
  head.remotes.find(remote => remote.name === name)?.url

export const hostOf = (
  head: GitHead | null | undefined,
  custom: GitHost[] = [],
): RepoHost => {
  const url = head && (remoteUrl(head, "origin") ?? head.remotes[0]?.url)
  const origin = url ? parseRemote(url) : null

  if (!head || !origin) {
    return {
      name: null,
      domain: null,
      icon: GENERIC,
      slug: null,
      path: null,
      web: null,
      fork: null,
    }
  }

  const own = custom.find(
    entry => entry.domain && within(origin.host, entry.domain.toLowerCase()),
  )
  const provider = PROVIDERS.find(
    entry =>
      entry.domains.some(domain => within(origin.host, domain)) ||
      entry.marks.some(mark => origin.host.includes(mark)),
  )
  const path = repoPath(origin.path)
  const slug = path.toLowerCase()
  const upstreamUrl = remoteUrl(head, "upstream")
  const upstream = upstreamUrl ? parseRemote(upstreamUrl) : null
  const parent = upstream ? slugOf(upstream.path) : null

  return {
    name: own?.name || provider?.name || null,
    domain: origin.host,
    icon: own?.logo ? imageIcon(own.logo) : (provider?.icon ?? GENERIC),
    slug,
    path,
    web: path ? `https://${origin.host}/${path}` : null,
    fork: parent && parent !== slug ? parent : null,
  }
}
