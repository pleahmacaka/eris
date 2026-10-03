import type { MainModule, MjModel } from "@mujoco/mujoco"
import axios from "axios"
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  SphereGeometry,
  SRGBColorSpace,
} from "three"
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { frame, type Model } from "./mesh"
import { fileName, type ObjScan, resolveAsset } from "./model"

const PLANE = 0
const SPHERE = 2
const CAPSULE = 3
const ELLIPSOID = 4
const CYLINDER = 5
const BOX = 6
const MESH = 7

const HIDDEN_GROUP = 3

const RGB_ROLE = 1

const TEXTURE_2D = 0

const FILE_ATTRIBUTES = [
  "file",
  "fileright",
  "fileleft",
  "fileup",
  "filedown",
  "filefront",
  "fileback",
]

const MESH_TAGS = new Set(["mesh", "skin", "hfield"])

let runtime: Promise<MainModule> | null = null

let loads = 0

const mujoco = () => {
  runtime ??= Promise.all([
    import("@mujoco/mujoco"),
    import("@mujoco/mujoco/mujoco.wasm?url"),
  ])
    .then(([module, wasm]) =>
      module.default({ locateFile: () => wasm.default }),
    )
    .catch(error => {
      runtime = null
      throw error
    })

  return runtime
}

const isAbsolute = (path: string) =>
  path.startsWith("/") || path.startsWith("\\") || path.charAt(1) === ":"

const tidy = (path: string) => {
  const parts: string[] = []

  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (part === "..") {
      if (parts.length && parts[parts.length - 1] !== "..") {
        parts.pop()
      } else {
        parts.push(part)
      }
    } else if (part !== "." && part !== "") {
      parts.push(part)
    }
  }

  return parts.join("/")
}

const fetchBytes = async (url: string, signal: AbortSignal) => {
  const { data } = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    signal,
  })

  return new Uint8Array(data)
}

const parseXml = (bytes: Uint8Array) => {
  const doc = new DOMParser().parseFromString(
    new TextDecoder().decode(bytes),
    "application/xml",
  )
  const error = doc.querySelector("parsererror")

  if (error) {
    throw new Error(error.textContent ?? "Invalid MJCF")
  }

  return doc
}

const compilerDir = (docs: Document[], name: string) =>
  docs
    .flatMap(doc => [...doc.querySelectorAll("compiler")])
    .map(compiler => compiler.getAttribute(name))
    .find(value => value !== null) ?? null

const references = (docs: Document[]) => {
  const assets = compilerDir(docs, "assetdir") ?? ""
  const meshes = compilerDir(docs, "meshdir") ?? assets
  const textures = compilerDir(docs, "texturedir") ?? assets
  const found = new Set<string>()

  for (const element of docs.flatMap(doc => [...doc.querySelectorAll("*")])) {
    if (element.tagName === "include") {
      continue
    }

    const dir = MESH_TAGS.has(element.tagName)
      ? meshes
      : element.tagName === "texture"
        ? textures
        : ""

    for (const attribute of FILE_ATTRIBUTES) {
      const ref = element.getAttribute(attribute)

      if (ref && !isAbsolute(ref)) {
        found.add(tidy(`${dir}/${ref}`))
      }
    }
  }

  return found
}

const gather = async (url: string, signal: AbortSignal) => {
  const main = fileName(url)
  const files = new Map([[main, await fetchBytes(url, signal)]])

  if (main.toLowerCase().endsWith(".mjb")) {
    return { main, files }
  }

  const docs: Document[] = []
  const pending = [main]

  while (pending.length) {
    const path = pending.shift() ?? ""
    const bytes =
      files.get(path) ??
      (await fetchBytes(resolveAsset(path, url) ?? path, signal))
    const doc = parseXml(bytes)

    files.set(path, bytes)
    docs.push(doc)

    for (const include of doc.querySelectorAll("include[file]")) {
      const ref = tidy(include.getAttribute("file") ?? "")

      if (ref && !files.has(ref) && !pending.includes(ref)) {
        pending.push(ref)
      }
    }
  }

  const assets = [...references(docs)].filter(path => !files.has(path))
  const fetched = await Promise.all(
    assets.map(path =>
      fetchBytes(resolveAsset(path, url) ?? path, signal)
        .then(bytes => [path, bytes] as const)
        .catch(() => null),
    ),
  )

  for (const entry of fetched) {
    if (entry) {
      files.set(entry[0], entry[1])
    }
  }

  return { main, files }
}

const compile = (
  module: MainModule,
  main: string,
  files: Map<string, Uint8Array>,
) => {
  // the nested root keeps refs like ../meshes inside the mounted tree
  const root = `/eris-mjcf/${++loads}/a/b/c`
  const written: string[] = []

  try {
    for (const [path, bytes] of files) {
      const target = `/${tidy(`${root}/${path}`)}`

      module.FS.mkdirTree(target.slice(0, target.lastIndexOf("/")), 0o777)
      module.FS.writeFile(target, bytes)
      written.push(target)
    }

    const entry = `${root}/${main}`

    return main.toLowerCase().endsWith(".mjb")
      ? module.MjModel.from_binary_path(entry, new module.MjVFS())
      : module.MjModel.mj_loadXML(entry)
  } finally {
    for (const path of written) {
      module.FS.unlink(path)
    }
  }
}

const meshGeometry = (m: MjModel, id: number) => {
  const vertadr = m.mesh_vertadr[id]
  const faceadr = m.mesh_faceadr[id]
  const facenum = m.mesh_facenum[id]
  const texadr = m.mesh_texcoordadr[id]
  const vertices = m.mesh_vert
  const faces = m.mesh_face
  const faceTexcoords = m.mesh_facetexcoord
  const texcoords = m.mesh_texcoord
  const positions = new Float32Array(facenum * 9)
  const uvs = texadr >= 0 ? new Float32Array(facenum * 6) : null

  for (let f = 0; f < facenum; f++) {
    for (let c = 0; c < 3; c++) {
      const corner = 3 * (faceadr + f) + c
      const v = 3 * (vertadr + faces[corner])

      positions[9 * f + 3 * c] = vertices[v]
      positions[9 * f + 3 * c + 1] = vertices[v + 1]
      positions[9 * f + 3 * c + 2] = vertices[v + 2]

      if (uvs) {
        const t = 2 * (texadr + faceTexcoords[corner])

        uvs[6 * f + 2 * c] = texcoords[t]
        uvs[6 * f + 2 * c + 1] = texcoords[t + 1]
      }
    }
  }

  const geometry = new BufferGeometry()

  geometry.setAttribute("position", new BufferAttribute(positions, 3))

  if (uvs) {
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2))
  }

  return toCreasedNormals(geometry, Math.PI / 6)
}

const primitive = (m: MjModel, g: number, type: number) => {
  const [x, y, z] = [0, 1, 2].map(axis => m.geom_size[3 * g + axis])

  switch (type) {
    case SPHERE:
      return new SphereGeometry(x, 32, 16)
    case CAPSULE:
      return new CapsuleGeometry(x, 2 * y, 8, 24).rotateX(Math.PI / 2)
    case ELLIPSOID:
      return new SphereGeometry(1, 32, 16).scale(x, y, z)
    case CYLINDER:
      return new CylinderGeometry(x, x, 2 * y, 32).rotateX(Math.PI / 2)
    case BOX:
      return new BoxGeometry(2 * x, 2 * y, 2 * z)
    case MESH:
      return meshGeometry(m, m.geom_dataid[g])
    default:
      return null
  }
}

const texture = (m: MjModel, material: number) => {
  if (material < 0) {
    return null
  }

  const stride = m.mat_texid.length / m.nmat
  const id = m.mat_texid[material * stride + RGB_ROLE]

  if (id < 0 || m.tex_type[id] !== TEXTURE_2D) {
    return null
  }

  const width = m.tex_width[id]
  const height = m.tex_height[id]
  const channels = m.tex_nchannel[id]
  const start = m.tex_adr[id]
  const source = m.tex_data
  const pixels = new Uint8Array(width * height * 4)

  for (let p = 0; p < width * height; p++) {
    for (let c = 0; c < 4; c++) {
      pixels[4 * p + c] =
        c < channels
          ? source[start + p * channels + c]
          : c === 3
            ? 255
            : source[start + p * channels]
    }
  }

  const map = new DataTexture(pixels, width, height, RGBAFormat)

  map.colorSpace = SRGBColorSpace
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  map.needsUpdate = true

  return map
}

const surface = (m: MjModel, g: number) => {
  const id = m.geom_matid[g]
  const rgba =
    id >= 0
      ? [0, 1, 2, 3].map(c => m.mat_rgba[4 * id + c])
      : [0, 1, 2, 3].map(c => m.geom_rgba[4 * g + c])

  return {
    rgba,
    material: new MeshStandardMaterial({
      color: new Color().setRGB(rgba[0], rgba[1], rgba[2], SRGBColorSpace),
      opacity: rgba[3],
      transparent: rgba[3] < 1,
      roughness: 0.6,
      metalness: 0,
      side: DoubleSide,
      map: texture(m, id),
    }),
  }
}

const place = (
  positions: Float64Array,
  matrices: Float64Array,
  g: number,
  mesh: Mesh,
) => {
  const r = matrices.subarray(9 * g, 9 * g + 9)
  const p = positions.subarray(3 * g, 3 * g + 3)

  new Matrix4()
    .setFromMatrix3(new Matrix3().fromArray(r).transpose())
    .setPosition(p[0], p[1], p[2])
    .decompose(mesh.position, mesh.quaternion, mesh.scale)
}

const build = (module: MainModule, m: MjModel) => {
  const data = new module.MjData(m)

  module.mj_kinematics(m, data)

  const positions = Float64Array.from(data.geom_xpos)
  const matrices = Float64Array.from(data.geom_xmat)

  data.delete()

  const body = new Group()
  const root = new Group()
  const slots: Model["slots"] = []
  const planes: number[] = []

  body.rotation.x = -Math.PI / 2
  root.add(body)

  for (let g = 0; g < m.ngeom; g++) {
    const type = m.geom_type[g]

    if (m.geom_group[g] >= HIDDEN_GROUP) {
      continue
    }

    if (type === PLANE) {
      planes.push(g)
      continue
    }

    const geometry = primitive(m, g, type)
    const { rgba, material } = surface(m, g)

    if (!geometry || rgba[3] === 0) {
      geometry?.dispose()
      material.map?.dispose()
      material.dispose()
      continue
    }

    const mesh = new Mesh(geometry, material)

    place(positions, matrices, g, mesh)
    body.add(mesh)
    slots.push({ object: mesh, names: [""], fallback: material })
  }

  const model = frame(root, slots)

  for (const g of planes) {
    const id = m.geom_matid[g]
    const span = (half: number) => (half > 0 ? 2 * half : model.radius * 8)
    const width = span(m.geom_size[3 * g])
    const height = span(m.geom_size[3 * g + 1])
    const { material } = surface(m, g)
    const mesh = new Mesh(new PlaneGeometry(width, height), material)

    // mat_texuniform is a byte view the wasm bindings cannot read, so floors tile per unit length
    if (material.map && id >= 0) {
      material.map.repeat.set(
        m.mat_texrepeat[2 * id] * width,
        m.mat_texrepeat[2 * id + 1] * height,
      )
    }

    place(positions, matrices, g, mesh)
    body.add(mesh)
    slots.push({ object: mesh, names: [""], fallback: material })
  }

  return model
}

export const loadMjcf = async (url: string, signal: AbortSignal) => {
  const { main, files } = await gather(url, signal)
  const module = await mujoco()

  signal.throwIfAborted()

  const m = compile(module, main, files)

  try {
    const scan: ObjScan = {
      vertices: m.nmeshvert,
      faces: m.nmeshface,
      libraries: [],
    }

    return {
      model: build(module, m),
      scan,
      bytes: files.get(main)?.byteLength ?? 0,
    }
  } finally {
    m.delete()
  }
}
