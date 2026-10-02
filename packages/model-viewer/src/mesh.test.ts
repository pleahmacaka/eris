import { expect, test } from "bun:test"
import { join } from "node:path"
import { MeshPhongMaterial, MeshStandardMaterial } from "three"
import { buildModel, dress, parseMaterials, parseObj } from "./mesh"

const demo = (name: string) =>
  Bun.file(join(import.meta.dir, "..", "demo", name)).text()

test("the demo house survives the worker round trip and takes its mtl", async () => {
  const parsed = parseObj(await demo("house.obj"))

  expect(parsed.parts.map(p => [p.kind, p.name, p.materials])).toEqual([
    ["mesh", "walls", ["walls"]],
    ["mesh", "roof", ["roof"]],
  ])
  expect(parsed.parts.every(p => "normal" in p.attributes)).toBe(true)

  const model = buildModel(parsed.parts)

  expect(model.center).toEqual([0, 1.5, 0])
  expect(model.root.position.y).toBeCloseTo(0)

  const set = parseMaterials(
    await demo("house.mtl"),
    ref => ref,
    () => undefined,
  )

  dress(model, set, { wireframe: true, flat: false })

  const [walls, roof] = model.slots.map(s => s.object.material)

  expect(roof).toBeInstanceOf(MeshPhongMaterial)

  if (roof instanceof MeshPhongMaterial) {
    expect(roof.color.r).toBeGreaterThan(roof.color.g)
    expect(roof.wireframe).toBe(true)
  }

  dress(model, null, { wireframe: false, flat: true })

  expect(model.slots[0]?.object.material).toBeInstanceOf(MeshStandardMaterial)
  expect(walls).not.toBe(model.slots[0]?.object.material)
})
