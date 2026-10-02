<script lang="ts">
  import { T, useThrelte } from "@threlte/core"
  import { Grid, OrbitControls } from "@threlte/extras"
  import { type PerspectiveCamera, Vector3 } from "three"
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

  const { invalidate, size } = useThrelte()

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
    revision
    dress(model, materials, { wireframe, flat })
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
      intensity={2.4 * brightness}
    />
  {/if}
</T.PerspectiveCamera>

{#if lighting}
  <T.HemisphereLight
    args={["#ffffff", "#3d4148"]}
    intensity={1.1 * brightness}
  />
{:else}
  <T.AmbientLight intensity={Math.PI * brightness} />
{/if}

<T is={model.root} dispose={false} />

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
