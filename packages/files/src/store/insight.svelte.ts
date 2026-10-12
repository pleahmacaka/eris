import { groupBy, pick } from "es-toolkit"
import { type GitState, gitStates } from "../git"
import type { Item } from "../items"
import { CLOUD_ONLY, sameLocation } from "../locations"
import {
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
  installers: new Set(),
  repo: null,
  git: null,
  states: new Map(),
}

const CACHE_LIMIT = 500

const identical = new Map<string, string[][]>()

const signature = (items: Item[]) =>
  items.map(item => `${item.path}|${item.modified}|${item.size}`).join("\n")

const sizeGroups = (items: Item[]) => {
  const hashable = items.filter(
    item =>
      !item.dir &&
      !item.link &&
      !item.packed &&
      item.size > 0 &&
      !(item.attrs & CLOUD_ONLY),
  )

  return Object.values(groupBy(hashable, item => item.size))
    .filter(group => group.length > 1)
    .map(group => ({
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

const gitView = async (location: string, items: Item[], whole: boolean) => {
  const repo = await gitRepo(location)

  if (!repo || !isTrusted(repo.root)) {
    return { repo, git: null, states: EMPTY.states }
  }

  const git = await gitStatus(location, whole)

  return { repo, git, states: git ? gitStates(git, items) : EMPTY.states }
}

export class Insight {
  view = $state.raw<InsightView>(EMPTY)

  whole = $state(false)

  #location = ""

  #items: Item[] = []

  #active = false

  #keys = new Map<string, string>()

  update(location: string, items: Item[], active: boolean) {
    if (!sameLocation(location, this.#location) || !active) {
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
      groups ? groups.map(group => group.key).join("\0") : null,
      async () => ({
        duplicates: await duplicateColors(groups ?? [], items),
      }),
    )

    this.#job(
      "probe",
      ["empty", "repos", "submodules"],
      signature(folders),
      async () => {
        const found = await probeDirs(folders.map(item => item.path))

        return {
          empty: new Set(found.empty),
          repos: new Set(found.repos),
          submodules: new Set(found.submodules),
        }
      },
    )

    this.#job(
      "installers",
      ["installers"],
      watchInstallers ? signature(items) : null,
      async () => ({ installers: await findInstallers(items) }),
    )

    this.#job(
      "git",
      ["repo", "git", "states"],
      [signature(items), this.whole, prefs.trustedRepos.join("\n")].join("\0"),
      () => gitView(location, items, this.whole),
    )
  }

  refreshGit() {
    this.#keys.delete("git")
    this.update(this.#location, this.#items, this.#active)
  }

  #job<K extends keyof InsightView>(
    name: string,
    fields: K[],
    input: string | null,
    work: () => Promise<Pick<InsightView, K>>,
  ) {
    const key = JSON.stringify([this.#location, input])

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

    work()
      .catch(() => none)
      .then(apply)
  }
}
