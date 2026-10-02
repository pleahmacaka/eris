import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  LoadingManager,
  type Material,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  type TypedArray,
  Vector3,
} from "three"
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { type ObjScan, scanObj } from "./model"

type Kind = "mesh" | "line" | "points"

type Drawable = Mesh | LineSegments | Points

export type Part = {
  kind: Kind
  name: string
  attributes: Record<string, { array: TypedArray; itemSize: number }>
  groups: BufferGeometry["groups"]
  materials: string[]
}

export type Parsed = { parts: Part[]; scan: ObjScan }

export type Model = {
  root: Group
  slots: { object: Drawable; names: string[]; fallback: Material }[]
  radius: number
  center: [number, number, number]
  size: [number, number, number]
}

export type Look = { wireframe: boolean; flat: boolean }

export type MaterialSet = MTLLoader.MaterialCreator

const TEXTURES = [
  "map",
  "specularMap",
  "emissiveMap",
  "normalMap",
  "bumpMap",
  "displacementMap",
  "alphaMap",
] as const

const NEUTRAL = 0xb4b8bf

const kindOf = (object: Drawable): Kind => {
  if (object instanceof Mesh) {
    return "mesh"
  }

  return object instanceof Points ? "points" : "line"
}

export const parseObj = (text: string): Parsed => {
  const parts: Part[] = []

  for (const object of new OBJLoader().parse(text).children) {
    if (
      !(
        object instanceof Mesh ||
        object instanceof LineSegments ||
        object instanceof Points
      )
    ) {
      continue
    }

    const kind = kindOf(object)
    const geometry: BufferGeometry =
      kind === "mesh" && !object.geometry.hasAttribute("normal")
        ? toCreasedNormals(object.geometry)
        : object.geometry

    parts.push({
      kind,
      name: object.name,
      attributes: Object.fromEntries(
        Object.entries(geometry.attributes).map(([key, a]) => [
          key,
          { array: a.array, itemSize: a.itemSize },
        ]),
      ),
      groups: geometry.groups,
      materials: [object.material].flat().map(m => m.name),
    })
  }

  return { parts, scan: scanObj(text) }
}

const fallbackFor = (kind: Kind, vertexColors: boolean): Material => {
  const color = vertexColors ? 0xffffff : NEUTRAL

  if (kind === "line") {
    return new LineBasicMaterial({ color, vertexColors })
  }

  if (kind === "points") {
    return new PointsMaterial({
      color,
      vertexColors,
      size: 2,
      sizeAttenuation: false,
    })
  }

  return new MeshStandardMaterial({
    color,
    vertexColors,
    roughness: 0.6,
    metalness: 0,
    side: DoubleSide,
  })
}

const drawableFor = (kind: Kind, geometry: BufferGeometry): Drawable => {
  if (kind === "mesh") {
    return new Mesh(geometry)
  }

  return kind === "line" ? new LineSegments(geometry) : new Points(geometry)
}

export const buildModel = (parts: Part[]): Model => {
  const root = new Group()
  const slots: Model["slots"] = []

  for (const part of parts) {
    const geometry = new BufferGeometry()

    for (const [key, { array, itemSize }] of Object.entries(part.attributes)) {
      geometry.setAttribute(key, new BufferAttribute(array, itemSize))
    }

    for (const { start, count, materialIndex } of part.groups) {
      geometry.addGroup(start, count, materialIndex)
    }

    const object = drawableFor(part.kind, geometry)
    const fallback = fallbackFor(part.kind, geometry.hasAttribute("color"))

    object.name = part.name
    object.material = fallback
    root.add(object)
    slots.push({ object, names: part.materials, fallback })
  }

  const box = new Box3().setFromObject(root)

  if (box.isEmpty()) {
    return { root, slots, radius: 1, center: [0, 0, 0], size: [0, 0, 0] }
  }

  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())

  root.position.set(-center.x, -box.min.y, -center.z)

  return {
    root,
    slots,
    radius: Math.max(size.length() / 2, 1e-6),
    center: [0, size.y / 2, 0],
    size: [size.x, size.y, size.z],
  }
}

export const dress = (model: Model, set: MaterialSet | null, look: Look) => {
  for (const { object, names, fallback } of model.slots) {
    const materials = names.map(name =>
      set && object instanceof Mesh && name in set.materialsInfo
        ? set.create(name)
        : fallback,
    )

    for (const material of materials) {
      if (
        material instanceof MeshStandardMaterial ||
        material instanceof MeshPhongMaterial
      ) {
        material.wireframe = look.wireframe
        material.flatShading = look.flat
        material.needsUpdate = true
      }
    }

    object.material = materials.length === 1 ? materials[0] : materials
  }
}

const phongMaterials = (set: MaterialSet) =>
  Object.values(set.materials).filter(m => m instanceof MeshPhongMaterial)

const dropMissingTextures = (set: MaterialSet) => {
  for (const material of phongMaterials(set)) {
    for (const slot of TEXTURES) {
      const texture = material[slot]

      if (texture && !texture.image) {
        texture.dispose()
        material[slot] = null
        material.needsUpdate = true
      }
    }
  }
}

export const parseMaterials = (
  text: string,
  resolve: (ref: string) => string,
  onSettled: () => void,
) => {
  const manager = new LoadingManager()
  const loader = new MTLLoader(manager)

  loader.setMaterialOptions({ side: DoubleSide })
  manager.setURLModifier(resolve)

  const set = loader.parse(text, "")

  manager.onLoad = () => {
    dropMissingTextures(set)
    onSettled()
  }

  return set
}

export const disposeMaterials = (set: MaterialSet) => {
  for (const material of phongMaterials(set)) {
    for (const slot of TEXTURES) {
      material[slot]?.dispose()
    }
  }

  for (const material of Object.values(set.materials)) {
    material.dispose()
  }
}

export const disposeModel = (model: Model) => {
  for (const { object, fallback } of model.slots) {
    object.geometry.dispose()
    fallback.dispose()
  }
}
