import { readdirSync, readFileSync } from "node:fs"
import { extname, isAbsolute, join, relative, resolve } from "node:path"
import type { IconifyJSON } from "@iconify/types"
import { getIcons } from "@iconify/utils"
import type { Plugin, ViteDevServer } from "vite"

export type IconifySubsetOptions = {
  collections: IconifyJSON[]
  scan: string[]
  extensions?: string[]
  runtime?: string | false
}

const ID = "virtual:iconify-subset"

const RESOLVED = `\0${ID}`

const DEFAULT_EXTENSIONS = [".svelte", ".ts", ".js", ".tsx", ".jsx", ".vue"]

const RUNTIMES = [
  "@iconify/svelte",
  "@iconify/vue",
  "@iconify/react",
  "@iconify/solid",
  "iconify-icon",
]

const declaredRuntime = (root: string) => {
  try {
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    )
    const declared = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    }

    return RUNTIMES.find(name => name in declared) ?? null
  } catch {
    return null
  }
}

const moduleCode = (collections: IconifyJSON[], runtime: string | null) => {
  const lines = [
    `const collections = ${JSON.stringify(collections)}`,
    "export default collections",
  ]

  if (runtime) {
    lines.unshift(`import { addCollection } from ${JSON.stringify(runtime)}`)
    lines.push(
      "for (const collection of collections) addCollection(collection)",
    )
  }

  return lines.join(";")
}

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
  runtime,
}: IconifySubsetOptions): Plugin => {
  const prefixes = collections.map(collection => collection.prefix)
  const byFile = new Map<string, Set<string>>()
  let roots: string[] = []
  let register: string | null = null
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
          `[iconify-subset] unknown ${collection.prefix} icons: ${subset.not_found.join(", ")}`,
        )
      }

      return subset ? [{ ...subset, not_found: undefined }] : []
    })

  return {
    name: "iconify-subset",

    configResolved(config) {
      roots = scan.map(root => resolve(config.root, root))
      register =
        runtime === false ? null : (runtime ?? declaredRuntime(config.root))
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
      return id === RESOLVED ? moduleCode(build(), register) : undefined
    },
  }
}
