import { icons as lucide } from "@iconify-json/lucide"
import { Glob } from "bun"

const EXTRA: string[] = []

const OUT = "src/lib/icons.ts"

const scanSources = async () => {
  const files: string[] = []

  for await (const entry of new Glob("**/*.{svelte,ts}").scan("src")) {
    const path = `src/${entry.replaceAll("\\", "/")}`

    if (!path.includes(".test.") && path !== OUT) {
      files.push(path)
    }
  }

  return files.sort()
}

const collect = async () => {
  const used = new Set(EXTRA)
  const dynamic: string[] = []

  for (const path of await scanSources()) {
    const source = await Bun.file(path).text()

    for (const [, name] of source.matchAll(/lucide:([a-z0-9-]*)/g)) {
      if (name) {
        used.add(name)
      } else {
        dynamic.push(path)
      }
    }
  }

  return { used: [...used].sort(), dynamic: [...new Set(dynamic)] }
}

const chainFor = (name: string) => {
  const chain: string[] = []
  let current = name

  while (!(current in lucide.icons)) {
    const alias = lucide.aliases?.[current]

    if (!alias?.parent) {
      return null
    }

    chain.push(current)
    current = alias.parent
  }

  return [...chain, current]
}

const { used, dynamic } = await collect()

const icons: typeof lucide.icons = {}
const aliases: NonNullable<typeof lucide.aliases> = {}
const missing: string[] = []

for (const name of used) {
  const chain = chainFor(name)

  if (!chain) {
    missing.push(name)
    continue
  }

  for (const step of chain) {
    if (step in lucide.icons) {
      icons[step] = lucide.icons[step]
    } else {
      aliases[step] = lucide.aliases?.[step] ?? { parent: step }
    }
  }
}

const sort = <T>(record: Record<string, T>) =>
  Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  )

const subset = {
  prefix: lucide.prefix,
  lastModified: lucide.lastModified,
  width: lucide.width,
  height: lucide.height,
  icons: sort(icons),
  ...(Object.keys(aliases).length > 0 ? { aliases: sort(aliases) } : {}),
}

const source = `import type { IconifyJSON } from "@iconify-json/lucide"

export const lucideSubset: IconifyJSON = ${JSON.stringify(subset, null, 2)}
`

await Bun.write(OUT, source)

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

const full = Bun.file("node_modules/@iconify-json/lucide/icons.json").size

console.log(
  `${OUT}: ${Object.keys(icons).length} icons, ${Object.keys(aliases).length} aliases, ${kb(source.length)} (full set ${kb(full)})`,
)

if (dynamic.length > 0) {
  console.log(
    `unresolved dynamic names, add them to EXTRA in scripts/icons.ts:\n  ${dynamic.join("\n  ")}`,
  )
}

if (missing.length > 0) {
  console.log(`not in @iconify-json/lucide: ${missing.join(", ")}`)
  process.exitCode = 1
}
