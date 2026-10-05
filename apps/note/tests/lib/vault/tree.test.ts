import { expect, test } from "bun:test"
import { buildTree } from "../../../src/lib/vault/tree"

test("nests files under folders, folders first, names in Korean order", () => {
  const tree = buildTree([
    { path: "하.md", folder: false },
    { path: "가", folder: true },
    { path: "가/나.md", folder: false },
    { path: "다.md", folder: false },
  ])

  expect(tree.map(n => n.name)).toEqual(["가", "다.md", "하.md"])
  expect(tree[0].children.map(n => n.path)).toEqual(["가/나.md"])
})

test("creates parent folders a listing did not report", () => {
  const tree = buildTree([{ path: "x/y/z.md", folder: false }])

  expect(tree[0]).toMatchObject({ path: "x", folder: true })
  expect(tree[0].children[0]).toMatchObject({ path: "x/y", folder: true })
  expect(tree[0].children[0].children[0].path).toBe("x/y/z.md")
})
