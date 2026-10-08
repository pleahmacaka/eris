import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import type { IconifyJSON } from "@iconify/types"
import { getIcons } from "@iconify/utils"
import type { Plugin, ViteDevServer } from "vite"

export type IconifySubsetOptions = {
  collections: IconifyJSON[]
  scan: string[]
  extensions?: string[]
}

const ID = "virtual:iconify-subset"

const RESOLVED = `\0${ID}`

const DEFAULT_EXTENSIONS = [".svelte", ".ts", ".js", ".tsx", ".jsx", ".vue"]

const filesIn = (root: string, extensions: string[]) =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(
      entry =>
        entry.isFile() &&
        extensions.some(extension => entry.name.endsWith(extension)) &&
        !join(entry.parentPath, entry.name).includes("node_modules"),
    )
    .map(entry => join(entry.parentPath, entry.name))

const namesIn = (source: string, prefixes: string[]) => {
  const found = new Set<string>()

  for (const prefix of prefixes) {
    const pattern = new RegExp(`\\b${prefix}:([a-z0-9]+(?:-[a-z0-9]+)*)`, "g")

    for (const [, name] of source.matchAll(pattern)) {
      found.add(`${prefix}:${name}`)
    }
  }

  return found
}

export const iconifySubset = ({
  collections,
  scan,
  extensions = DEFAULT_EXTENSIONS,
}: IconifySubsetOptions): Plugin => {
  const prefixes = collections.map(collection => collection.prefix)
  const byFile = new Map<string, Set<string>>()
  let roots: string[] = []
  let server: ViteDevServer | undefined

  const read = (file: string) => {
    byFile.set(file, namesIn(readFileSync(file, "utf8"), prefixes))
  }

  const used = () => new Set([...byFile.values()].flatMap(names => [...names]))

  const build = () =>
    collections.flatMap(collection => {
      const names = [...used()]
        .filter(name => name.startsWith(`${collection.prefix}:`))
        .map(name => name.slice(collection.prefix.length + 1))
      const subset = getIcons(collection, names, true)

      if (subset?.not_found?.length) {
        console.warn(
          `[iconify-subset] unknown ${collection.prefix} icons: ${subset.not_found.join(", ")}`,
        )
      }

      return subset ? [{ ...subset, not_found: undefined }] : []
    })

  return {
    name: "iconify-subset",

    configResolved(config) {
      roots = scan.map(root => resolve(config.root, root))
    },

    buildStart() {
      byFile.clear()

      for (const root of roots) {
        for (const file of filesIn(root, extensions)) {
          read(file)
        }
      }
    },

    configureServer(dev) {
      server = dev

      dev.watcher.on("change", file => {
        if (!byFile.has(file)) {
          return
        }

        const before = used().size

        read(file)

        const module = server?.moduleGraph.getModuleById(RESOLVED)

        if (module && used().size !== before) {
          server?.moduleGraph.invalidateModule(module)
          server?.ws.send({ type: "full-reload" })
        }
      })
    },

    resolveId(id) {
      return id === ID ? RESOLVED : undefined
    },

    load(id) {
      return id === RESOLVED
        ? `export default ${JSON.stringify(build())}`
        : undefined
    },
  }
}
