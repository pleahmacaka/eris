import occtimportjs, { type OcctMesh } from "occt-import-js"
import wasm from "occt-import-js/dist/occt-import-js.wasm?url"
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  SRGBColorSpace,
} from "three"
import type { Part } from "./mesh"

const NEUTRAL: [number, number, number] = [0.71, 0.72, 0.75]

const EDGE = new Color(0x1d2026)

const CREASE_DEGREES = 30

const occt = occtimportjs({ locateFile: () => wasm })

const upright = (array: ArrayLike<number>) => {
  const out = new Float32Array(array.length)

  for (let i = 0; i < array.length; i += 3) {
    out[i] = array[i]
    out[i + 1] = array[i + 2]
    out[i + 2] = -array[i + 1]
  }

  return out
}

const linear = (rgb: [number, number, number]) =>
  new Color().setRGB(...rgb, SRGBColorSpace).toArray()

const edgesOf = (part: Part): Part => {
  const geometry = new BufferGeometry()

  geometry.setAttribute(
    "position",
    new BufferAttribute(part.attributes.position.array, 3),
  )
  geometry.setIndex(new BufferAttribute(part.index ?? new Uint32Array(), 1))

  const position = new EdgesGeometry(geometry, CREASE_DEGREES).getAttribute(
    "position",
  ).array as Float32Array
  const color = new Float32Array(position.length)

  for (let i = 0; i < color.length; i += 3) {
    EDGE.toArray(color, i)
  }

  return {
    kind: "line",
    name: `${part.name} edges`,
    attributes: {
      position: { array: position, itemSize: 3 },
      color: { array: color, itemSize: 3 },
    },
    groups: [],
    materials: [""],
  }
}

const partOf = (mesh: OcctMesh): Part => {
  const position = upright(mesh.attributes.position.array)
  const attributes: Part["attributes"] = {
    position: { array: position, itemSize: 3 },
  }

  if (mesh.attributes.normal) {
    attributes.normal = {
      array: upright(mesh.attributes.normal.array),
      itemSize: 3,
    }
  }

  const index = Uint32Array.from(mesh.index.array)
  const painted = mesh.brep_faces.filter(face => face.color)

  if (mesh.color || painted.length > 0) {
    const color = new Float32Array(position.length)
    const base = linear(mesh.color ?? NEUTRAL)

    for (let i = 0; i < color.length; i += 3) {
      color.set(base, i)
    }

    for (const face of painted) {
      const rgb = linear(face.color ?? NEUTRAL)

      for (let i = face.first * 3; i < (face.last + 1) * 3; i++) {
        color.set(rgb, index[i] * 3)
      }
    }

    attributes.color = { array: color, itemSize: 3 }
  }

  return {
    kind: "mesh",
    name: mesh.name,
    attributes,
    index,
    groups: [],
    materials: [""],
  }
}

addEventListener("message", async (e: MessageEvent<ArrayBuffer>) => {
  try {
    const result = (await occt).ReadStepFile(new Uint8Array(e.data), null)

    if (!result.success) {
      throw new Error("STEP import failed")
    }

    const meshes = result.meshes.map(partOf)
    const parts = [...meshes, ...meshes.map(edgesOf)]
    const transfer = parts.flatMap(part => [
      ...Object.values(part.attributes).map(a => a.array.buffer),
      ...(part.index ? [part.index.buffer] : []),
    ])

    postMessage(
      {
        parts,
        scan: {
          vertices: meshes.reduce(
            (sum, part) => sum + part.attributes.position.array.length / 3,
            0,
          ),
          faces: meshes.reduce(
            (sum, part) => sum + (part.index?.length ?? 0) / 3,
            0,
          ),
          libraries: [],
        },
      },
      { transfer },
    )
  } catch (error) {
    postMessage({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
