import { expect, test } from "bun:test"
import { Glob } from "bun"
import { lucideSubset } from "./icons"

const usedNames = async () => {
  const names = new Set<string>()

  for await (const entry of new Glob("**/*.{svelte,ts}").scan("src")) {
    const path = `src/${entry.replaceAll("\\", "/")}`

    if (path.includes(".test.")) {
      continue
    }

    for (const [, name] of (await Bun.file(path).text()).matchAll(
      /lucide:([a-z0-9-]+)/g,
    )) {
      names.add(name)
    }
  }

  return [...names].sort()
}

test("every lucide name used in src resolves in the generated subset", async () => {
  const known = new Set([
    ...Object.keys(lucideSubset.icons),
    ...Object.keys(lucideSubset.aliases ?? {}),
  ])

  const names = await usedNames()

  expect(names.length).toBeGreaterThan(50)
  expect(names.filter(name => !known.has(name))).toEqual([])
})

test("the subset carries no icon the app never asks for", async () => {
  const names = new Set(await usedNames())

  const orphans = Object.keys(lucideSubset.icons).filter(
    name =>
      !names.has(name) &&
      !Object.values(lucideSubset.aliases ?? {}).some(a => a.parent === name),
  )

  expect(orphans).toEqual([])
})
