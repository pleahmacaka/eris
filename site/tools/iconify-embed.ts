import { readdirSync, readFileSync } from "node:fs"
import { extname, isAbsolute, join, relative, resolve } from "node:path"
import type { IconifyJSON } from "@iconify/types"
import { getIcons } from "@iconify/utils"
import type { Plugin, ViteDevServer } from "vite"

export type IconifyEmbedOptions = {
  collections: IconifyJSON[]
  scan: string[]
  extensions?: string[]
}

const ID = "virtual:iconify-embed"

const RESOLVED = `\0${ID}`

const DEFAULT_EXTENSIONS = [".svelte", ".ts"]

const moduleCode = (collections: IconifyJSON[]) =>
  [
    'import { _api, addCollection } from "@iconify/svelte"',
    `const collections = ${JSON.stringify(collections)}`,
    "for (const collection of collections) addCollection(collection)",
    '_api.setAPIModule("", { prepare: () => [], send: () => undefined })',
    "export default collections",
  ].join(";")

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

export const iconifyEmbed = ({
  collections,
  scan,
  extensions = DEFAULT_EXTENSIONS,
}: IconifyEmbedOptions): Plugin => {
  const prefixes = collections.map(collection => collection.prefix)
  const byFile = new Map<string, Set<string>>()
  let roots: string[] = []
  let server: ViteDevServer | undefined

  const scanned = (file: string) =>
    extensions.includes(extname(file)) &&
    !file.includes("node_modules") &&
    roots.some(root => {
      const inside = relative(root, file)

      return !!inside && !inside.startsWith("..") && !isAbsolute(inside)
    })

  const read = (file: string) => {
    byFile.set(file, namesIn(readFileSync(file, "utf8"), prefixes))
  }

  const used = () => new Set([...byFile.values()].flatMap(names => [...names]))

  const signature = () => [...used()].sort().join(",")

  const build = () =>
    collections.flatMap(collection => {
      const names = [...used()]
        .filter(name => name.startsWith(`${collection.prefix}:`))
        .map(name => name.slice(collection.prefix.length + 1))
      const subset = getIcons(collection, names, true)

      if (subset?.not_found?.length) {
        console.warn(
          `[iconify-embed] unknown ${collection.prefix} icons: ${subset.not_found.join(", ")}`,
        )
      }

      return subset ? [{ ...subset, not_found: undefined }] : []
    })

  return {
    name: "iconify-embed",

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

      const refresh = (update: () => void) => {
        const before = signature()

        update()

        const module = server?.moduleGraph.getModuleById(RESOLVED)

        if (module && signature() !== before) {
          server?.moduleGraph.invalidateModule(module)
          server?.ws.send({ type: "full-reload" })
        }
      }

      dev.watcher.add(roots)

      for (const event of ["add", "change"] as const) {
        dev.watcher.on(event, file => {
          if (scanned(resolve(file))) {
            refresh(() => read(resolve(file)))
          }
        })
      }

      dev.watcher.on("unlink", file => {
        if (byFile.has(resolve(file))) {
          refresh(() => byFile.delete(resolve(file)))
        }
      })
    },

    resolveId(id) {
      return id === ID ? RESOLVED : undefined
    },

    load(id) {
      return id === RESOLVED ? moduleCode(build()) : undefined
    },
  }
}
