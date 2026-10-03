<script lang="ts">
  import type { Account } from "@eris/auth"
  import {
    type Appearance,
    type Background,
    type DockBackground,
    defaultAppearance,
    type ThemeMode,
  } from "@eris/settings"
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { publish } from "./api"
  import type { CommunityCopy, Field, Surface } from "./copy"
  import Stage from "./Stage.svelte"
  import { type CommunityTheme, slugify, toolsOf } from "./support"

  let {
    t,
    studio,
    theme,
    account,
    live,
    login,
    onclose,
    onsaved,
  }: {
    t: CommunityCopy
    studio?: string
    theme: CommunityTheme | null
    account: Account | null
    live: boolean
    login: string
    onclose: () => void
    onsaved: (theme: CommunityTheme) => void
  } = $props()

  type RangeField = Exclude<Field, "mode" | "background" | "dockBackground" | "dockBorder">

  const RANGES: Record<RangeField, [number, number, number]> = {
    accentHue: [0, 360, 1],
    accentSpread: [0, 120, 1],
    vividness: [0, 0.25, 0.01],
    texture: [0, 1, 0.05],
    radius: [0, 2, 0.05],
    blur: [0, 2, 0.05],
    surfaceOpacity: [0.6, 1, 0.02],
    dockOpacity: [0.6, 1, 0.02],
    dockBlur: [0, 2, 0.05],
    dockRadius: [0, 2, 0.05],
    dockTint: [0, 0.4, 0.02],
  }

  const LOOK: RangeField[] = ["accentHue", "accentSpread", "vividness", "texture", "radius", "blur", "surfaceOpacity"]

  const DOCK: RangeField[] = ["dockOpacity", "dockBlur", "dockRadius", "dockTint"]

  const MODES: ThemeMode[] = ["dark", "light", "system"]

  const BACKGROUNDS: Background[] = ["solid", "aura", "glass"]

  const DOCK_BACKGROUNDS: DockBackground[] = ["inherit", "solid", "aura", "glass"]

  const TAG_LIMIT = 6

  const PREVIEW_DELAY = 300

  const user = $derived(account?.user ?? null)

  const authorOf = () => {
    const meta = user?.user_metadata ?? {}

    return String(meta.user_name ?? meta.full_name ?? user?.email?.split("@")[0] ?? "").slice(0, 40)
  }

  const initial = untrack(() => theme)

  let name = $state(initial?.name ?? "")
  let author = $state(initial?.author ?? authorOf())
  let description = $state(initial?.description ?? "")
  let tags = $state(initial?.tags.join(", ") ?? "")
  const isField = (key: string): key is keyof Appearance => key in defaultAppearance

  const option = <T extends string>(options: readonly T[], value: string) =>
    options.find(candidate => candidate === value)

  let swatch = $state<[string, string, string]>(
    initial ? [initial.swatch[0], initial.swatch[1], initial.swatch[2]] : ["#131018", "#ac89e8", "#e8e7ed"],
  )
  let draft = $state<Appearance>({ ...defaultAppearance, ...initial?.appearance })
  let touched = $state(new Set(Object.keys(initial?.appearance ?? {}).filter(isField)))
  let surface = $state<Surface>("desktop")
  let busy = $state(false)
  let failure = $state("")

  const appearance = $derived.by(() => {
    const picked: Partial<Appearance> = Object.fromEntries(
      [...touched].map(key => [key, draft[key]]),
    )

    return touched.has("accentHue") ? { ...picked, useSystemAccent: false } : picked
  })

  let previewed = $state<Partial<Appearance>>(untrack(() => appearance))

  $effect(() => {
    const next = appearance
    const timer = setTimeout(() => {
      previewed = next
    }, PREVIEW_DELAY)

    return () => clearTimeout(timer)
  })

  const cleanTags = $derived(
    [...new Set(tags.split(",").map(tag => tag.trim().toLowerCase().replaceAll(" ", "-")))]
      .filter(tag => tag && tag.length <= 24 && [...tag].every(c => (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "-"))
      .slice(0, TAG_LIMIT),
  )

  const valid = $derived(
    name.trim().length > 0 && author.trim().length > 0 && Object.keys(appearance).length > 0,
  )

  const ALL_SURFACES: Surface[] = ["desktop", "files", "terminal"]

  const surfaces = $derived(toolsOf({ appearance }).length > 1 ? ALL_SURFACES : ALL_SURFACES.slice(0, 1))

  const set = <K extends keyof Appearance>(key: K, value: Appearance[K]) => {
    draft[key] = value
    touched = new Set(touched).add(key)
  }

  const save = async () => {
    busy = true
    failure = ""

    try {
      const saved = await publish(
        {
          slug: theme?.slug ?? slugify(name),
          author: author.trim(),
          name: name.trim(),
          description: description.trim(),
          swatch,
          appearance,
          tags: cleanTags,
        },
        theme?.id,
      )

      onsaved(saved)
    } catch (error) {
      failure = error instanceof Error && error.message === "rate_limited" ? t.editor.rateLimited : t.editor.failed
    } finally {
      busy = false
    }
  }
</script>

{#snippet range(key: RangeField)}
  {@const [min, max, step] = RANGES[key]}

  <label class="flex flex-col gap-1">
    <span class="flex justify-between text-xs">
      <span>{t.editor.fields[key]}</span>
      <span class="text-base-content/60 tabular-nums">{draft[key]}</span>
    </span>
    <input
      type="range"
      class="range range-primary range-xs w-full"
      {min}
      {max}
      {step}
      value={draft[key]}
      oninput={e => set(key, Number(e.currentTarget.value))}
    />
  </label>
{/snippet}

<section class="flex flex-col gap-6">
  <div class="flex items-center justify-between gap-4">
    <h1 class="text-3xl font-bold tracking-tight">
      {theme ? t.editor.editTitle : t.editor.newTitle}
    </h1>

    <button type="button" class="btn btn-ghost btn-sm" onclick={onclose}>
      <Icon icon="lucide:x" class="size-4" />
      {t.editor.cancel}
    </button>
  </div>

  <div class="grid gap-6 lg:grid-cols-5">
    <div class="flex flex-col gap-3 lg:col-span-3">
      <div class="overflow-hidden rounded-box border border-base-content/10">
        <Stage
          {studio}
          appearance={previewed}
          {surface}
          title={t.surfaces[surface]}
          unavailable={t.previewUnavailable}
        />
      </div>

      {#if surfaces.length > 1}
        <div role="tablist" class="tabs tabs-box self-start">
          {#each surfaces as option (option)}
            <button
              type="button"
              role="tab"
              class={["tab", surface === option && "tab-active"]}
              aria-selected={surface === option}
              onclick={() => (surface = option)}
            >
              {t.surfaces[option]}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <form
      class="flex flex-col gap-4 lg:col-span-2"
      onsubmit={e => {
        e.preventDefault()
        save()
      }}
    >
      <label class="flex flex-col gap-1 text-sm">
        {t.editor.name}
        <input class="input w-full" maxlength="60" required bind:value={name} />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        {t.editor.author}
        <input class="input w-full" maxlength="40" required bind:value={author} />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        {t.editor.description}
        <textarea class="textarea w-full" maxlength="280" rows="2" bind:value={description}></textarea>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        {t.editor.tagsField}
        <input class="input w-full" bind:value={tags} />
        <span class="text-xs text-base-content/60">{t.editor.tagsHint}</span>
      </label>

      <fieldset class="flex flex-col gap-1 text-sm">
        <legend class="mb-1">{t.editor.swatch}</legend>
        <div class="flex gap-2">
          {#each swatch as _, index (index)}
            <input
              type="color"
              class="size-9 cursor-pointer rounded-field border border-base-content/15 bg-transparent"
              aria-label={`${t.editor.swatch} ${index + 1}`}
              bind:value={swatch[index]}
            />
          {/each}
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-3 rounded-box border border-base-content/10 p-4">
        <legend class="px-1 text-sm font-medium">{t.editor.look}</legend>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-xs">
            {t.editor.fields.mode}
            <select
              class="select select-sm"
              value={draft.mode}
              onchange={e => {
                const mode = option(MODES, e.currentTarget.value)

                if (mode) {
                  set("mode", mode)
                }
              }}
            >
              {#each MODES as mode (mode)}
                <option value={mode}>{t.editor.themeModes[mode]}</option>
              {/each}
            </select>
          </label>

          <label class="flex flex-col gap-1 text-xs">
            {t.editor.fields.background}
            <select
              class="select select-sm"
              value={draft.background}
              onchange={e => {
                const background = option(BACKGROUNDS, e.currentTarget.value)

                if (background) {
                  set("background", background)
                }
              }}
            >
              {#each BACKGROUNDS as background (background)}
                <option value={background}>{t.editor.backgrounds[background]}</option>
              {/each}
            </select>
          </label>
        </div>

        {#each LOOK as key (key)}
          {@render range(key)}
        {/each}
      </fieldset>

      <fieldset class="flex flex-col gap-3 rounded-box border border-base-content/10 p-4">
        <legend class="px-1 text-sm font-medium">{t.editor.dock}</legend>

        <label class="flex flex-col gap-1 text-xs">
          {t.editor.fields.dockBackground}
          <select
            class="select select-sm"
            value={draft.dockBackground}
            onchange={e => {
              const background = option(DOCK_BACKGROUNDS, e.currentTarget.value)

              if (background) {
                set("dockBackground", background)
              }
            }}
          >
            {#each DOCK_BACKGROUNDS as background (background)}
              <option value={background}>{t.editor.dockBackgrounds[background]}</option>
            {/each}
          </select>
        </label>

        {#each DOCK as key (key)}
          {@render range(key)}
        {/each}

        <label class="flex items-center justify-between gap-2 text-xs">
          {t.editor.fields.dockBorder}
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            checked={draft.dockBorder}
            onchange={e => set("dockBorder", e.currentTarget.checked)}
          />
        </label>
      </fieldset>

      {#if failure}
        <p role="alert" class="text-sm text-error">{failure}</p>
      {/if}

      {#if !live}
        <p class="text-sm text-base-content/60">{t.editor.unavailable}</p>
      {:else if !user}
        <a class="btn btn-primary" href={login}>{t.editor.signIn}</a>
      {:else}
        <button type="submit" class="btn btn-primary" disabled={!valid || busy}>
          {#if busy}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          {theme ? t.editor.save : t.editor.publish}
        </button>
      {/if}
    </form>
  </div>
</section>
