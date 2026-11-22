<script lang="ts">
import Icon from "@iconify/svelte"
import { onDestroy } from "svelte"
import SettingsCard from "#lib/components/settings/SettingsCard.svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { gridStep } from "#lib/shell/gridNav.js"
import type { ThemePreference } from "#lib/shell/theme.js"
import {
  THEME_FAMILIES,
  THEME_FAMILY_IDS,
  type ThemeFamily,
  themeName,
} from "#lib/shell/themeFamilies.js"
import { listPrefsStore } from "#lib/store/listPrefs.svelte.js"
import { themeStore } from "#lib/store/theme.svelte.js"

const MODES: { value: ThemePreference; label: MessageKey; icon: string }[] = [
  {
    value: "system",
    label: "settings.appearance.system",
    icon: "lucide:monitor",
  },
  { value: "dark", label: "settings.appearance.dark", icon: "lucide:moon" },
  { value: "light", label: "settings.appearance.light", icon: "lucide:sun" },
]

let hovered: ThemeFamily | null = null
let focused = $state<ThemeFamily | null>(null)

const preview = () => themeStore.preview(hovered ?? focused)

const hover = (family: ThemeFamily | null) => {
  hovered = family
  preview()
}

const focus = (family: ThemeFamily | null) => {
  focused = family
  preview()
}

const travel = (event: KeyboardEvent & { currentTarget: HTMLElement }) => {
  const option = event.currentTarget
  const options = [...(option.parentElement?.children ?? [])].filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  )
  const firstRow = options[0]?.offsetTop
  const target = gridStep(
    event.key,
    options.indexOf(option),
    options.length,
    options.filter(item => item.offsetTop === firstRow).length,
    getComputedStyle(option).direction === "rtl",
  )

  if (target !== null) {
    event.preventDefault()
    options[target]?.focus()
  }
}

onDestroy(() => themeStore.preview(null))
</script>

{#snippet miniature(theme: string)}
  <span data-theme={theme} class="flex size-full bg-base-100">
    <span class="flex w-1/6 flex-col items-center gap-1 bg-base-300 py-1.5">
      <span class="size-2.5 rounded-[30%] bg-primary"></span>
      <span class="size-2.5 rounded-full bg-base-100"></span>
      <span class="size-2.5 rounded-full bg-base-100"></span>
    </span>
    <span class="panel-surface flex w-1/3 flex-col gap-1 p-1.5">
      <span class="h-1 w-3/4 rounded-full bg-base-content/30"></span>
      <span class="h-1 w-1/2 rounded-full bg-base-content/15"></span>
      <span class="h-1 w-2/3 rounded-full bg-base-content/15"></span>
      <span class="mt-auto h-2 rounded-field bg-neutral"></span>
    </span>
    <span class="flex flex-1 flex-col justify-end gap-1 p-1.5">
      <span class="h-1 w-2/3 rounded-full bg-base-content/30"></span>
      <span class="h-1 w-1/2 rounded-full bg-base-content/15"></span>
      <span class="flex items-center gap-0.5">
        <span class="size-1.5 rounded-full bg-secondary"></span>
        <span class="size-1.5 rounded-full bg-accent"></span>
        <span class="size-1.5 rounded-full bg-success"></span>
        <span class="size-1.5 rounded-full bg-error"></span>
        <span class="ms-auto h-1.5 w-2/5 rounded-full bg-primary"></span>
      </span>
    </span>
  </span>
{/snippet}

<SettingsCard title={i18n.t("settings.appearance.title")}>
  <div class="flex flex-col gap-2">
    <p id="appearance-mode" class="font-semibold text-sm">{i18n.t("settings.appearance.mode")}</p>
    <div class="grid grid-cols-3 gap-3" role="radiogroup" aria-labelledby="appearance-mode">
      {#each MODES as mode (mode.value)}
        <label class="relative flex cursor-pointer flex-col gap-2">
          <input
            type="radio"
            name="theme-mode"
            class="peer sr-only"
            value={mode.value}
            checked={themeStore.preference === mode.value}
            onchange={() => themeStore.set(mode.value)}
          />
          <span
            class={[
              "relative block aspect-video overflow-hidden rounded-field border",
              "border-base-content/15 peer-checked:border-primary",
              "peer-checked:ring-2 peer-checked:ring-primary/30",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
              "peer-focus-visible:outline-primary",
            ]}
            aria-hidden="true"
          >
            {#if mode.value === "system"}
              {@render miniature(themeName(themeStore.shown, "dark"))}
              <span class="absolute inset-y-0 end-0 w-1/2 overflow-hidden">
                <span class="absolute inset-y-0 end-0 -start-full">
                  {@render miniature(themeName(themeStore.shown, "light"))}
                </span>
              </span>
            {:else}
              {@render miniature(themeName(themeStore.shown, mode.value))}
            {/if}
          </span>
          <span
            class={[
              "flex items-center gap-2 text-muted text-sm",
              "peer-checked:font-semibold peer-checked:text-base-content",
            ]}
          >
            <Icon icon={mode.icon} class="size-4" />
            <span class="min-w-0 truncate">{i18n.t(mode.label)}</span>
          </span>
        </label>
      {/each}
    </div>
  </div>

  <div class="flex flex-col gap-2 border-base-content/10 border-t pt-4">
    <p id="appearance-theme" class="font-semibold text-sm">{i18n.t("settings.appearance.theme")}</p>
    <div
      class="-m-1.5 grid grid-cols-2 sm:grid-cols-3"
      role="listbox"
      aria-labelledby="appearance-theme"
    >
      {#each THEME_FAMILY_IDS as family (family)}
        {@const selected = themeStore.family === family}
        <button
          type="button"
          role="option"
          aria-selected={selected}
          tabindex={family === (focused ?? themeStore.family) ? 0 : -1}
          class="group flex cursor-pointer flex-col gap-2 p-1.5 text-start outline-none"
          onclick={() => themeStore.setFamily(family)}
          onpointerenter={() => hover(family)}
          onpointerleave={() => hover(null)}
          onfocus={() => focus(family)}
          onblur={() => focus(null)}
          onkeydown={travel}
        >
          <span
            class={[
              "block aspect-video w-full overflow-hidden rounded-field border",
              "group-focus-visible:outline-2 group-focus-visible:outline-offset-2",
              "group-focus-visible:outline-primary",
              selected
                ? "border-primary ring-2 ring-primary/30"
                : "border-base-content/15",
            ]}
            aria-hidden="true"
          >
            {@render miniature(themeName(family, themeStore.scheme))}
          </span>
          <span
            class={[
              "flex w-full items-center gap-2 text-sm",
              selected ? "font-semibold text-base-content" : "text-muted",
            ]}
          >
            <span class="min-w-0 flex-1 truncate">{i18n.t(THEME_FAMILIES[family].label)}</span>
            {#if selected}
              <Icon icon="lucide:check" class="size-4 shrink-0 text-primary" />
            {/if}
          </span>
        </button>
      {/each}
    </div>
    <p class="text-muted text-xs">
      {i18n.t("settings.appearance.previewHint")}
    </p>
  </div>

  <div class="flex flex-col gap-3 border-base-content/10 border-t pt-4">
    <p class="font-semibold text-sm">{i18n.t("channels.list.conversations")}</p>
    <label class="flex cursor-pointer items-center justify-between gap-4">
      <span class="min-w-0 text-sm">{i18n.t("settings.appearance.dmPreview")}</span>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        checked={listPrefsStore.dmPreview}
        onchange={event => listPrefsStore.setDmPreview(event.currentTarget.checked)}
      />
    </label>
  </div>
</SettingsCard>
