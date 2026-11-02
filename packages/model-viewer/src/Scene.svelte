<script lang="ts">
  import { T, useThrelte } from "@threlte/core"
  import { Grid, OrbitControls } from "@threlte/extras"
  import {
    type PerspectiveCamera,
    PMREMGenerator,
    PCFShadowMap,
    Vector3,
  } from "three"
  import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
  import type { OrbitControls as Orbit } from "three/examples/jsm/controls/OrbitControls.js"
  import { dress, type MaterialSet, type Model } from "./mesh"
  import { fitDistance } from "./model"

  let {
    model,
    materials,
    revision,
    wireframe,
    flat,
    guides,
    gridColors,
    lighting,
    brightness,
  }: {
    model: Model
    materials: MaterialSet | null
    revision: number
    wireframe: boolean
    flat: boolean
    guides: boolean
    gridColors: { cell: string; section: string }
    lighting: boolean
    brightness: number
  } = $props()

  const VIEW = new Vector3(0.9, 0.6, 1.2).normalize()

  const { invalidate, renderer, scene, size } = useThrelte()

  renderer.shadowMap.type = PCFShadowMap

  let camera = $state.raw<PerspectiveCamera>()
  let controls = $state.raw<Orbit>()

  const unit = $derived(10 ** Math.floor(Math.log10(model.radius)))

  export const frame = () => {
    if (!camera || !controls) {
      return
    }

    const [x, y, z] = model.center
    const { width, height } = size.current
    const distance =
      fitDistance(model.radius, camera.fov, width / height) * 1.2

    camera.near = distance / 100
    camera.far = distance * 100
    camera.position.set(x, y, z).addScaledVector(VIEW, distance)
    camera.updateProjectionMatrix()

    controls.target.set(x, y, z)
    controls.update()
    invalidate()
  }

  $effect(() => {
    model
    frame()
  })

  $effect(() => {
    for (const { object } of model.slots) {
      object.castShadow = true
    }
  })

  $effect(() => {
    revision
    dress(model, materials, { wireframe, flat })
    invalidate()
  })

  $effect(() => {
    if (!lighting) {
      return
    }

    const pmrem = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.04)

    room.dispose()
    pmrem.dispose()
    scene.environment = target.texture
    invalidate()

    return () => {
      scene.environment = null
      target.dispose()
      invalidate()
    }
  })

  $effect(() => {
    scene.environmentIntensity = 0.6 * brightness
    invalidate()
  })

  $effect(() => {
    guides
    gridColors
    lighting
    brightness
    invalidate()
  })
</script>

<T.PerspectiveCamera makeDefault fov={35} bind:ref={camera}>
  <OrbitControls enableDamping bind:ref={controls} />

  {#if lighting}
    <T.DirectionalLight
      position={[-2 * model.radius, 3 * model.radius, model.radius]}
      intensity={0.9 * brightness}
    />
  {/if}
</T.PerspectiveCamera>

{#if lighting}
  <T.HemisphereLight
    args={["#ffffff", "#3d4148"]}
    intensity={0.5 * brightness}
  />
{:else}
  <T.AmbientLight intensity={Math.PI * brightness} />
{/if}

<T is={model.root} dispose={false} />

{#if lighting}
  <T.DirectionalLight
    position={[
      model.center[0] - model.radius * 1.5,
      model.center[1] + model.radius * 4,
      model.center[2] + model.radius * 0.5,
    ]}
    intensity={1.2 * brightness}
    castShadow
    shadow.mapSize={[2048, 2048]}
    shadow.camera.left={-model.radius * 2}
    shadow.camera.right={model.radius * 2}
    shadow.camera.top={model.radius * 2}
    shadow.camera.bottom={-model.radius * 2}
    shadow.camera.far={model.radius * 8}
    shadow.radius={6}
    shadow.bias={-0.0005}
    oncreate={light => {
      light.target.position.set(...model.center)
      light.target.updateMatrixWorld()
    }}
  />

  <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
    <T.PlaneGeometry args={[model.radius * 40, model.radius * 40]} />
    <T.ShadowMaterial opacity={0.32} />
  </T.Mesh>
{/if}

{#if guides}
  <Grid
    position.y={-model.radius / 1000}
    cellSize={unit / 4}
    sectionSize={unit}
    cellColor={gridColors.cell}
    sectionColor={gridColors.section}
    cellThickness={0.5}
    sectionThickness={1}
    infiniteGrid
    fadeDistance={model.radius * 8}
  />
  <T.AxesHelper args={[model.radius * 1.4]} />
{/if}
