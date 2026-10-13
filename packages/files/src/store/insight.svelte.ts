import { groupBy, pick } from "es-toolkit"
import { type GitState, gitStates } from "../git"
import type { Item } from "../items"
import { CLOUD_ONLY, sameLocation } from "../locations"
import {
  type GitHead,
  type GitRepo,
  type GitStatus,
  gitRepo,
  gitStatus,
  identicalFiles,
  probeDirs,
} from "../native"
import { findInstallers, isDownloads } from "./cleanup.svelte"
import { prefs } from "./prefs.svelte"
import { isTrusted } from "./trust"

export type InsightView = {
  duplicates: Map<string, number>
  empty: Set<string>
  repos: Set<string>
  submodules: Set<string>
  heads: Map<string, GitHead>
  installers: Set<string>
  repo: GitRepo | null
  git: GitStatus | null
  states: Map<string, GitState>
}

const EMPTY: InsightView = {
  duplicates: new Map(),
  empty: new Set(),
  repos: new Set(),
  submodules: new Set(),
  heads: new Map(),
  installers: new Set(),
  repo: null,
  git: null,
  states: new Map(),
}

const CACHE_LIMIT = 500

// ponytail: folders like System32 and WinSxS skip these scans; scanning visible items only would lift the caps
const DUPLICATE_SCAN_LIMIT = 1000

const PROBE_LIMIT = 2000

const GIT_PAUSE = 2000

const identical = new Map<string, string[][]>()

const hash = (values: Iterable<string | number>) => {
  let a = 0xdeadbeef
  let b = 0x41c6ce57

  const mix = (value: number) => {
    a = Math.imul(a ^ value, 2654435761)
    b = Math.imul(b ^ value, 1597334677)
  }

  for (const value of values) {
    if (typeof value === "number") {
      mix(value | 0)
      mix((value / 0x100000000) | 0)
    } else {
      for (let i = 0; i < value.length; i++) {
        mix(value.charCodeAt(i))
      }

      mix(-1)
    }
  }

  a =
    Math.imul(a ^ (a >>> 16), 2246822507) ^
    Math.imul(b ^ (b >>> 13), 3266489909)
  b =
    Math.imul(b ^ (b >>> 16), 2246822507) ^
    Math.imul(a ^ (a >>> 13), 3266489909)

  return 0x100000000 * (0x1fffff & b) + (a >>> 0)
}

function* stamps(items: Item[]) {
  for (const item of items) {
    yield item.path
    yield item.modified
    yield item.size
  }
}

const signature = (items: Item[]) => hash(stamps(items))

const sizeGroups = (items: Item[]) => {
  const hashable = items.filter(
    item =>
      !item.dir &&
      !item.link &&
      !item.packed &&
      item.size > 0 &&
      !(item.attrs & CLOUD_ONLY),
  )

  const groups = Object.values(groupBy(hashable, item => item.size)).filter(
    group => group.length > 1,
  )

  if (groups.flat().length > DUPLICATE_SCAN_LIMIT) {
    return []
  }

  return groups.map(group => ({
    key: group
      .map(item => `${item.path}|${item.modified}`)
      .sort()
      .join("\n"),
    paths: group.map(item => item.path),
  }))
}

const duplicateColors = async (
  groups: ReturnType<typeof sizeGroups>,
  items: Item[],
) => {
  const missing = groups.filter(group => !identical.has(group.key))

  if (missing.length > 0) {
    const found = await identicalFiles(missing.map(group => group.paths))

    if (identical.size > CACHE_LIMIT) {
      identical.clear()
    }

    for (const group of missing) {
      identical.set(
        group.key,
        found.filter(set => group.paths.includes(set[0])),
      )
    }
  }

  const order = new Map(items.map((item, index) => [item.path, index]))
  const sets = groups
    .flatMap(group => identical.get(group.key) ?? [])
    .sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))

  const colors = new Map<string, number>()

  sets.forEach((set, color) => {
    for (const path of set) {
      colors.set(path, color)
    }
  })

  return colors
}

const gitView = async (
  found: Promise<GitRepo | null>,
  location: string,
  items: Item[],
  whole: boolean,
) => {
  const repo = await found

  if (!repo || !isTrusted(repo.root)) {
    return { repo, git: null, states: EMPTY.states }
  }

  const git = await gitStatus(location, whole, repo)

  return { repo, git, states: gitStates(git, items) }
}

export class Insight {
  view = $state.raw<InsightView>(EMPTY)

  whole = $state(false)

  #location = ""

  #items: Item[] = []

  #active = false

  #keys = new Map<string, string>()

  #repo: {
    location: string
    marked: boolean
    found: Promise<GitRepo | null>
  } | null = null

  #gitAt = 0

  #gitSettings = ""

  update(location: string, items: Item[], active: boolean) {
    const moved = !sameLocation(location, this.#location)

    if (moved || !active) {
      this.view = EMPTY
      this.#keys.clear()
    }

    this.#location = location
    this.#items = items
    this.#active = active

    if (!active) {
      return
    }

    const groups = prefs.duplicates ? sizeGroups(items) : null
    const folders = items.filter(item => item.dir && !item.link)
    const watchInstallers = prefs.cleanup && isDownloads(location)

    this.#job(
      "duplicates",
      ["duplicates"],
      groups ? hash(groups.map(group => group.key)) : null,
      async () => ({
        duplicates: await duplicateColors(groups ?? [], items),
      }),
    )

    this.#job(
      "probe",
      ["empty", "repos", "submodules", "heads"],
      folders.length > PROBE_LIMIT ? null : signature(folders),
      async () => {
        const found = await probeDirs(folders.map(item => item.path))

        return {
          empty: new Set(found.empty),
          repos: new Set(found.repos),
          submodules: new Set(found.submodules),
          heads: new Map(Object.entries(found.heads ?? {})),
        }
      },
    )

    this.#job(
      "installers",
      ["installers"],
      watchInstallers ? signature(items) : null,
      async () => ({ installers: await findInstallers(items) }),
    )

    const settings = [this.whole, ...prefs.trustedRepos].join("\n")
    const whole = this.whole
    const pause =
      moved || settings !== this.#gitSettings
        ? 0
        : Math.max(0, this.#gitAt + GIT_PAUSE - Date.now())

    this.#gitSettings = settings

    this.#job(
      "git",
      ["repo", "git", "states"],
      `${signature(items)}\0${settings}`,
      () => {
        this.#gitAt = Date.now()

        return gitView(this.#repoOf(location, items), location, items, whole)
      },
      pause,
    )
  }

  refreshGit() {
    this.#keys.delete("git")
    this.#repo = null
    this.#gitAt = 0
    this.update(this.#location, this.#items, this.#active)
  }

  #repoOf(location: string, items: Item[]) {
    const marked = items.some(item => item.name === ".git")
    const known = this.#repo

    if (
      known &&
      known.marked === marked &&
      sameLocation(known.location, location)
    ) {
      return known.found
    }

    const found = gitRepo(location)

    this.#repo = { location, marked, found }
    found.catch(() => {
      if (this.#repo?.found === found) {
        this.#repo = null
      }
    })

    return found
  }

  #job<K extends keyof InsightView>(
    name: string,
    fields: K[],
    input: string | number | null,
    work: () => Promise<Pick<InsightView, K>>,
    pause = 0,
  ) {
    const key = `${this.#location}\0${input}`

    if (this.#keys.get(name) === key) {
      return
    }

    this.#keys.set(name, key)

    const none = pick(EMPTY, fields)
    const apply = (patch: Pick<InsightView, K>) => {
      if (this.#keys.get(name) === key) {
        this.view = { ...this.view, ...patch }
      }
    }

    if (input === null) {
      apply(none)

      return
    }

    const run = () => {
      if (this.#keys.get(name) === key) {
        work()
          .catch(() => none)
          .then(apply)
      }
    }

    if (pause > 0) {
      setTimeout(run, pause)
    } else {
      run()
    }
  }
}
