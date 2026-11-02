declare module "occt-import-js" {
  export type OcctMesh = {
    name: string
    color?: [number, number, number]
    brep_faces: {
      first: number
      last: number
      color: [number, number, number] | null
    }[]
    attributes: {
      position: { array: number[] }
      normal?: { array: number[] }
    }
    index: { array: number[] }
  }

  type Result = { success: boolean; meshes: OcctMesh[] }

  type Occt = {
    ReadStepFile: (content: Uint8Array, params: null) => Result
  }

  const occtimportjs: (options: {
    locateFile: (path: string) => string
  }) => Promise<Occt>

  export default occtimportjs
}
