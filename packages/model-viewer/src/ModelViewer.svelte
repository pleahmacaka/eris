<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Canvas } from "@threlte/core"
  import { NeutralToneMapping } from "three"
  import {
    type ModelViewerLabels,
    type ModelViewerLocale,
    modelViewerLabels,
    viewerLocale,
  } from "./labels"
  import { fetchText, loadModel } from "./load"
  import {
    disposeMaterials,
    disposeModel,
    type MaterialSet,
    type Model,
    parseMaterials,
  } from "./mesh"
  import { baseName, fileName, type ObjScan, resolveAsset } from "./model"
  import Scene from "./Scene.svelte"

  let {
    objUrl,
    mtlUrl = null,
    title,
    locale,
    labels,
    onfullscreen,
  }: {
    objUrl: string
    mtlUrl?: string | null
    title?: string
    locale?: ModelViewerLocale
    labels?: Partial<ModelViewerLabels>
    onfullscreen?: (fullscreen: boolean) => void
  } = $props()

  type Round = {
    label: string
    icon: string
    tip: string
    onclick?: () => void
    target?: string
    pressed?: boolean
    disabled?: boolean
  }

  const BACKDROPS = {
    white: { surface: "bg-zinc-100", cell: "#d4d4d8", section: "#a1a1aa" },
    gray: { surface: "bg-zinc-600", cell: "#71717a", section: "#a1a1aa" },
    black: { surface: "bg-zinc-950", cell: "#27272a", section: "#3f3f46" },
  }

  type Backdrop = keyof typeof BACKDROPS

  const BACKDROP_KEYS = Object.keys(BACKDROPS) as Backdrop[]

  const VIEW_KEY = "eris-model-viewer.view"

  const uid = $props.id()

  const lang = $derived<ModelViewerLocale>(
    locale ?? viewerLocale(globalThis.navigator?.language),
  )
  const text = $derived({ ...modelViewerLabels[lang], ...labels })
  const heading = $derived(title ?? fileName(objUrl))

  let status = $state<"loading" | "ready" | "error">("loading")
  let progress = $state<number | null>(null)
  let failure = $state("")
  let model = $state.raw<Model | null>(null)
  let scan = $state.raw<ObjScan | null>(null)
  let bytes = $state(0)
  let materials = $state.raw<MaterialSet | null>(null)
  let materialMissing = $state(false)
  let revision = $state(0)

  let wireframe = $state(false)
  let flat = $state(false)
  let fullscreen = $state(false)
  let dragging = $state(false)
  let detailsOpen = $state(false)
  let viewOpen = $state(false)

  let shell = $state<HTMLElement>()
  let picker = $state<HTMLInputElement>()
  let scene = $state<ReturnType<typeof Scene>>()

  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null") ?? {}
    } catch {
      return {}
    }
  })()

  const view = $state({
    backdrop: BACKDROP_KEYS.includes(stored.backdrop)
      ? (stored.backdrop as Backdrop)
      : "gray",
    guides: typeof stored.guides === "boolean" ? stored.guides : true,
    lighting: typeof stored.lighting === "boolean" ? stored.lighting : true,
    brightness:
      typeof stored.brightness === "number" ? stored.brightness : 1,
  })

  $effect(() => {
    localStorage.setItem(VIEW_KEY, JSON.stringify(view))
  })

  const ready = $derived(status === "ready")

  const textures = new Map<string, string>()
  let source: { text: string; base: string } | null = null

  const count = (n: number) => n.toLocaleString(lang)

  const fileSize = (n: number) => {
    const mega = n >= 1024 ** 2

    return new Intl.NumberFormat(lang, {
      style: "unit",
      unit: mega ? "megabyte" : "kilobyte",
      maximumFractionDigits: 1,
    }).format(n / (mega ? 1024 ** 2 : 1024))
  }

  const facts = $derived(
    model && scan
      ? [
          [text.file, heading],
          [text.fileSize, fileSize(bytes)],
          [text.vertices, count(scan.vertices)],
          [text.faces, count(scan.faces)],
          [text.objects, count(model.slots.length)],
          [
            text.materials,
            materials
              ? count(Object.keys(materials.materialsInfo).length)
              : text.none,
          ],
          [
            text.dimensions,
            model.size
              .map(n => n.toLocaleString(lang, { maximumFractionDigits: 2 }))
              .join(" × "),
          ],
        ]
      : [],
  )

  const applyMaterials = (body: string, base: string) => {
    if (materials) {
      disposeMaterials(materials)
    }

    source = { text: body, base }
    materials = parseMaterials(
      body,
      ref =>
        textures.get(baseName(ref).toLowerCase()) ??
        resolveAsset(ref, base) ??
        ref,
      () => revision++,
    )
    materialMissing = false
  }

  const releaseMaterials = () => {
    if (materials) {
      disposeMaterials(materials)
    }

    for (const url of textures.values()) {
      URL.revokeObjectURL(url)
    }

    textures.clear()
    materials = null
    source = null
    materialMissing = false
  }

  $effect(() => {
    const url = objUrl
    const explicit = mtlUrl
    const controller = new AbortController()
    const { signal } = controller
    let loaded: Model | null = null

    status = "loading"
    progress = null

    loadModel(url, signal, ratio => (progress = ratio))
      .then(result => {
        if (signal.aborted) {
          disposeModel(result.model)

          return
        }

        loaded = result.model
        model = result.model
        scan = result.scan
        bytes = result.bytes
        status = "ready"

        const library = result.scan.libraries[0]
        const mtl =
          explicit ??
          (library === undefined ? undefined : resolveAsset(library, url))

        if (mtl === undefined) {
          return
        }

        materialMissing = true

        if (mtl) {
          fetchText(mtl, signal)
            .then(body => {
              if (!signal.aborted) {
                applyMaterials(body, mtl)
              }
            })
            .catch(() => undefined)
        }
      })
      .catch(error => {
        if (!signal.aborted) {
          failure = error instanceof Error ? error.message : String(error)
          status = "error"
        }
      })

    return () => {
      controller.abort()
      releaseMaterials()

      if (loaded) {
        disposeModel(loaded)
      }

      model = null
      scan = null
    }
  })

  const attach = async (files: File[]) => {
    const mtl = files.find(f => f.name.toLowerCase().endsWith(".mtl"))
    const body = mtl ? await mtl.text() : source?.text

    if (body === undefined || !model) {
      return
    }

    for (const file of files) {
      if (file === mtl) {
        continue
      }

      const name = file.name.toLowerCase()
      const previous = textures.get(name)

      if (previous) {
        URL.revokeObjectURL(previous)
      }

      textures.set(name, URL.createObjectURL(file))
    }

    applyMaterials(body, mtl ? objUrl : (source?.base ?? objUrl))
  }

  const toggleFullscreen = () => {
    if (onfullscreen) {
      fullscreen = !fullscreen
      onfullscreen(fullscreen)
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined)
    } else {
      shell?.requestFullscreen().catch(() => undefined)
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    const leaving = e.key === "Escape" && fullscreen && onfullscreen

    if (e.key === "F11" || leaving) {
      e.preventDefault()
      toggleFullscreen()
    }
  }

  const carriesFiles = (e: DragEvent) =>
    e.dataTransfer?.types.includes("Files") ?? false

  const ondragover = (e: DragEvent) => {
    if (carriesFiles(e)) {
      e.preventDefault()
      dragging = status === "ready"
    }
  }

  const ondragleave = (e: DragEvent & { currentTarget: HTMLElement }) => {
    const inside =
      e.relatedTarget instanceof Node &&
      e.currentTarget.contains(e.relatedTarget)

    if (!inside) {
      dragging = false
    }
  }

  const ondrop = (e: DragEvent) => {
    if (!carriesFiles(e)) {
      return
    }

    e.preventDefault()

    if (dragging) {
      dragging = false
      attach(Array.from(e.dataTransfer?.files ?? []))
    }
  }

  const onpick = (e: Event & { currentTarget: HTMLInputElement }) => {
    attach(Array.from(e.currentTarget.files ?? []))
    e.currentTarget.value = ""
  }
</script>

<svelte:window {onkeydown} />

<svelte:document
  onfullscreenchange={() => {
    if (!onfullscreen) {
      fullscreen = document.fullscreenElement === shell
    }
  }}
/>

{#snippet round(b: Round)}
  <div class={["tooltip", b.tip]} data-tip={b.label}>
    <button
      type="button"
      aria-label={b.label}
      aria-pressed={b.pressed}
      disabled={b.disabled}
      popovertarget={b.target}
      style:anchor-name={b.target ? `--${b.target}` : undefined}
      class={[
        "btn btn-circle btn-sm border-base-content/15 bg-base-100/85",
        "shadow-sm backdrop-blur-md",
        b.pressed && "btn-active",
      ]}
      onclick={b.onclick}
    >
      <Icon icon={b.icon} class="size-4" />
    </button>
  </div>
{/snippet}

{#snippet toggle(label: string, checked: boolean, set: (on: boolean) => void)}
  <label class="flex cursor-pointer items-center justify-between gap-3 py-1">
    <span>{label}</span>
    <input
      type="checkbox"
      class="toggle toggle-primary toggle-xs"
      {checked}
      onchange={e => set(e.currentTarget.checked)}
    />
  </label>
{/snippet}

<section
  bind:this={shell}
  aria-label={heading}
  class={[
    "relative size-full overflow-hidden font-sans text-base-content",
    "transition-colors duration-200",
    BACKDROPS[view.backdrop].surface,
  ]}
  {ondragover}
  {ondragleave}
  {ondrop}
>
  {#if model}
    <div class="absolute inset-0">
      <Canvas toneMapping={NeutralToneMapping}>
        <Scene
          bind:this={scene}
          {model}
          {materials}
          {revision}
          {wireframe}
          {flat}
          guides={view.guides}
          gridColors={BACKDROPS[view.backdrop]}
          lighting={view.lighting}
          brightness={view.brightness}
        />
      </Canvas>
    </div>
  {/if}

  {#if status === "loading"}
    <div class="absolute inset-0 grid place-items-center">
      <div
        class={[
          "flex w-52 flex-col items-center gap-3 rounded-box p-4",
          "bg-base-100/85 shadow-sm backdrop-blur-md",
        ]}
      >
        <span class="text-sm text-base-content/70">{text.loading}</span>

        {#if progress === null}
          <progress class="progress w-full"></progress>
        {:else}
          <progress class="progress w-full" value={progress} max="1"
          ></progress>
        {/if}
      </div>
    </div>
  {:else if status === "error"}
    <div class="absolute inset-0 grid place-items-center p-6">
      <div
        class={[
          "flex max-w-sm flex-col items-center gap-2 rounded-box p-5",
          "bg-base-100/85 text-center shadow-sm backdrop-blur-md",
        ]}
      >
        <Icon icon="lucide:triangle-alert" class="size-8 text-base-content/40" />
        <p class="text-sm font-semibold">{text.loadFailed}</p>
        <p class="text-xs break-all text-base-content/60">{failure}</p>
      </div>
    </div>
  {/if}

  <div class="absolute top-3 left-3">
    {@render round({
      label: text.details,
      icon: "lucide:info",
      tip: "tooltip-right",
      target: `${uid}-details`,
      pressed: detailsOpen,
      disabled: !ready,
    })}
  </div>

  <div class="absolute top-3 right-3">
    {@render round({
      label: text.view,
      icon: "lucide:layers",
      tip: "tooltip-left",
      target: `${uid}-view`,
      pressed: viewOpen,
    })}
  </div>

  <div class="absolute bottom-3 left-3">
    {@render round({
      label: text.attachMaterial,
      icon: "lucide:palette",
      tip: "tooltip-right",
      onclick: () => picker?.click(),
      disabled: !ready,
    })}
  </div>

  <div class="absolute right-3 bottom-3 flex gap-2">
    {@render round({
      label: text.resetView,
      icon: "lucide:rotate-ccw",
      tip: "tooltip-top",
      onclick: () => scene?.frame(),
      disabled: !ready,
    })}

    {@render round({
      label: fullscreen ? text.exitFullscreen : text.fullscreen,
      icon: fullscreen ? "lucide:minimize" : "lucide:maximize",
      tip: "tooltip-left",
      onclick: toggleFullscreen,
    })}
  </div>

  <div
    id={`${uid}-details`}
    popover="manual"
    style:position-anchor={`--${uid}-details`}
    class={[
      "dropdown m-0 mt-2 w-64 rounded-box border border-base-content/10 p-3",
      "bg-base-100/90 text-xs shadow-lg backdrop-blur-md",
    ]}
    ontoggle={e => (detailsOpen = e.newState === "open")}
  >
    <dl class="grid grid-cols-3 gap-x-3 gap-y-1.5">
      {#each facts as [label, value] (label)}
        <dt class="text-base-content/60">{label}</dt>
        <dd class="col-span-2 truncate tabular-nums" title={value}>{value}</dd>
      {/each}
    </dl>
  </div>

  <div
    id={`${uid}-view`}
    popover="auto"
    style:position-anchor={`--${uid}-view`}
    class={[
      "dropdown dropdown-end m-0 mt-2 w-64 rounded-box border p-3 text-sm",
      "border-base-content/10 bg-base-100/90 shadow-lg backdrop-blur-md",
    ]}
    ontoggle={e => (viewOpen = e.newState === "open")}
  >
    <div class="flex items-center justify-between gap-3 pb-2">
      <span>{text.background}</span>

      <div class="flex gap-2">
        {#each BACKDROP_KEYS as key (key)}
          <button
            type="button"
            aria-label={text[key]}
            title={text[key]}
            aria-pressed={view.backdrop === key}
            class={[
              "size-5 cursor-pointer rounded-full border border-base-content/20",
              "ring-2 ring-offset-2 ring-offset-base-100",
              "transition-shadow duration-150",
              BACKDROPS[key].surface,
              view.backdrop === key
                ? "ring-primary"
                : "ring-transparent hover:ring-base-content/25",
            ]}
            onclick={() => (view.backdrop = key)}
          ></button>
        {/each}
      </div>
    </div>

    <div class="flex flex-col border-t border-base-content/10 py-1">
      {@render toggle(text.guides, view.guides, on => (view.guides = on))}
      {@render toggle(text.lighting, view.lighting, on => (view.lighting = on))}

      <label class="flex flex-col gap-1.5 py-1">
        <span class="flex justify-between">
          {text.brightness}
          <span class="text-base-content/60 tabular-nums">
            {Math.round(view.brightness * 100)}%
          </span>
        </span>

        <input
          type="range"
          class="range range-primary range-xs"
          min="0.2"
          max="2"
          step="0.05"
          aria-label={text.brightness}
          bind:value={view.brightness}
        />
      </label>
    </div>

    <div class="flex flex-col border-t border-base-content/10 pt-1">
      {@render toggle(text.wireframe, wireframe, on => (wireframe = on))}
      {@render toggle(text.flatShading, flat, on => (flat = on))}
    </div>
  </div>

  {#if materialMissing && ready}
    <div class="absolute inset-x-0 bottom-3 flex justify-center">
      <div
        class={[
          "flex items-center gap-2 rounded-full py-1 pr-1 pl-3 text-xs",
          "border border-base-content/10 bg-base-100/90 shadow-sm backdrop-blur-md",
        ]}
      >
        <span class="text-base-content/70">{text.materialMissing}</span>

        <button
          type="button"
          class="btn btn-ghost btn-xs"
          onclick={() => picker?.click()}
        >
          {text.attachMaterial}
        </button>
      </div>
    </div>
  {/if}

  {#if dragging}
    <div
      class={[
        "pointer-events-none absolute inset-3 grid place-items-center",
        "rounded-box border-2 border-dashed border-primary/60",
        "bg-base-100/70 backdrop-blur-sm",
      ]}
    >
      <div class="flex flex-col items-center gap-2 text-sm">
        <Icon icon="lucide:palette" class="size-6 text-primary" />
        <span>{text.dropHint}</span>
      </div>
    </div>
  {/if}

  <input
    bind:this={picker}
    type="file"
    accept=".mtl,image/*"
    multiple
    hidden
    onchange={onpick}
  />
</section>
