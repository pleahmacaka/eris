import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { baseName, fileName, fitDistance, resolveAsset, scanObj } from "./model"

const demo = join(import.meta.dir, "..", "demo", "house.obj")

const assetUrl = (path: string) =>
  `http://asset.localhost/${encodeURIComponent(path)}`

describe("scanObj", () => {
  test("counts the demo house and finds its material library", async () => {
    const scan = scanObj(await Bun.file(demo).text())

    expect(scan).toEqual({ vertices: 9, faces: 9, libraries: ["house.mtl"] })
  })

  test("handles CRLF, tabs and indentation", () => {
    const text =
      "mtllib  a b.mtl \r\n  v 0 0 0\r\nv\t1 0 0\r\nvn 0 1 0\r\nf 1 2 1\r\n"

    expect(scanObj(text)).toEqual({
      vertices: 2,
      faces: 1,
      libraries: ["a b.mtl"],
    })
  })
})

describe("resolveAsset", () => {
  test("resolves the demo library next to the obj on disk", async () => {
    const url = resolveAsset("house.mtl", pathToFileURL(demo).href)

    expect(url).not.toBeNull()
    expect(await Bun.file(fileURLToPath(url ?? "")).exists()).toBe(true)
  })

  test("plain http urls drop the query and accept backslashes", () => {
    const base = "https://cdn.test/models/car.obj?v=3"

    expect(resolveAsset("car.mtl", base)).toBe(
      "https://cdn.test/models/car.mtl",
    )
    expect(resolveAsset("tex\\paint.png", base)).toBe(
      "https://cdn.test/models/tex/paint.png",
    )
    expect(resolveAsset("../shared/a.png", base)).toBe(
      "https://cdn.test/shared/a.png",
    )
  })

  test("tauri asset urls on windows stay inside the encoded path", () => {
    const base = assetUrl("C:\\Users\\me\\models\\car.obj")

    expect(resolveAsset("car.mtl", base)).toBe(
      assetUrl("C:\\Users\\me\\models\\car.mtl"),
    )
    expect(resolveAsset("textures/paint.png", base)).toBe(
      assetUrl("C:\\Users\\me\\models\\textures\\paint.png"),
    )
    expect(resolveAsset("..\\..\\..\\..\\up.png", base)).toBe(
      assetUrl("C:\\up.png"),
    )
    expect(resolveAsset("D:\\tex\\wood.png", base)).toBe(
      assetUrl("D:\\tex\\wood.png"),
    )
  })

  test("tauri asset urls on unix and unc shares", () => {
    const unix = `asset://localhost/${encodeURIComponent("/home/me/모델/집.obj")}`

    expect(resolveAsset("./집.mtl", unix)).toBe(
      `asset://localhost/${encodeURIComponent("/home/me/모델/집.mtl")}`,
    )
    expect(
      resolveAsset("a.mtl", assetUrl("\\\\nas\\share\\cars\\car.obj")),
    ).toBe(assetUrl("\\\\nas\\share\\cars\\a.mtl"))
  })

  test("blob and invalid bases resolve to null", () => {
    expect(resolveAsset("a.mtl", "blob:http://localhost/0f2c")).toBeNull()
    expect(resolveAsset("a.mtl", "not a url")).toBeNull()
  })
})

test("fileName decodes plain and tauri urls", () => {
  expect(fileName("https://cdn.test/models/my%20car.obj?x=1")).toBe(
    "my car.obj",
  )
  expect(fileName(assetUrl("C:\\Users\\me\\집.obj"))).toBe("집.obj")
  expect(fileName("data:model/obj;base64,diAwIDAgMA==")).toBe("")
  expect(baseName("a\\b/c.png")).toBe("c.png")
})

test("fitDistance keeps the sphere inside the narrower field of view", () => {
  expect(fitDistance(1, 90, 1)).toBeCloseTo(Math.SQRT2)
  expect(fitDistance(1, 90, 2)).toBeCloseTo(Math.SQRT2)
  expect(fitDistance(1, 90, 0.5)).toBeCloseTo(Math.sqrt(5))
  expect(fitDistance(1, 90, Number.NaN)).toBeCloseTo(Math.SQRT2)
})
