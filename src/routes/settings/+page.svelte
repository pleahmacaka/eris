<script lang="ts">
import Icon from "@iconify/svelte"
import Backdrop from "#lib/components/chat/Backdrop.svelte"
import AppearanceSettings from "#lib/components/settings/AppearanceSettings.svelte"
import KeymapSettings from "#lib/components/settings/KeymapSettings.svelte"
import LanguageSettings from "#lib/components/settings/LanguageSettings.svelte"
import ProfileSettings from "#lib/components/settings/ProfileSettings.svelte"
import VoiceSettings from "#lib/components/settings/VoiceSettings.svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { HOME_PATH } from "#lib/routes.js"
import { openExternal } from "#lib/shell/authRedirect.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { titleBarStore } from "#lib/store/titleBar.svelte.js"
import { goto } from "$app/navigation"

type Section =
  | "profile"
  | "voice"
  | "appearance"
  | "language"
  | "keymap"
  | "window"
  | "session"

type Entry = { id: Section; label: MessageKey; icon: string }

const groups = $derived<Entry[][]>([
  [
    {
      id: "profile",
      label: "settings.profile.title",
      icon: "lucide:user-round",
    },
    { id: "voice", label: "keymap.group.voice", icon: "lucide:mic" },
  ],
  [
    {
      id: "appearance",
      label: "settings.appearance.title",
      icon: "lucide:palette",
    },
    {
      id: "language",
      label: "settings.language.title",
      icon: "lucide:languages",
    },
    { id: "keymap", label: "keymap.title", icon: "lucide:keyboard" },
    ...(titleBarStore.supported
      ? [
          {
            id: "window",
            label: "settings.window.title",
            icon: "lucide:app-window",
          } as const,
        ]
      : []),
  ],
  [{ id: "session", label: "settings.session.title", icon: "lucide:log-out" }],
])

let chosen = $state<Section | null>(null)

const active = $derived<Section>(chosen ?? "profile")
const accountUri = $derived(sessionStore.session?.oauth?.accountUri ?? null)

const close = () => {
  if (history.length > 1) {
    history.back()
  } else {
    void goto(HOME_PATH)
  }
}
</script>

<main class="relative isolate flex h-full overflow-hidden bg-base-100">
  <Backdrop strength="faint" />

  <nav
    class={[
      "panel-surface flex w-full shrink-0 flex-col overflow-y-auto md:w-56",
      chosen ? "max-md:hidden" : "",
    ]}
    aria-label={i18n.t("settings.title")}
  >
    <header class="flex h-12 shrink-0 items-center gap-2 px-3">
      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm"
        aria-label={i18n.t("ui.close")}
        title={i18n.t("ui.close")}
        onclick={close}
      >
        <Icon icon="lucide:x" class="size-5" />
      </button>
      <h1 class="font-bold">{i18n.t("settings.title")}</h1>
    </header>

    <div class="flex flex-col gap-2 px-2 pb-4">
      {#each groups as group, index (index)}
        {#if index > 0}
          <div class="mx-2 border-base-content/10 border-t"></div>
        {/if}
        <ul class="flex flex-col gap-0.5">
          {#each group as entry (entry.id)}
            {@const current = active === entry.id}
            <li>
              <button
                type="button"
                class={[
                  "flex h-9 w-full items-center gap-2.5 rounded-field px-2.5 text-start text-sm",
                  "text-muted hover:bg-base-content/5 hover:text-base-content",
                  current
                    ? "md:bg-base-content/10 md:font-semibold md:text-base-content"
                    : "",
                ]}
                aria-current={current ? "page" : undefined}
                onclick={() => (chosen = entry.id)}
              >
                <Icon icon={entry.icon} class="size-4 shrink-0" />
                <span class="min-w-0 flex-1 truncate">{i18n.t(entry.label)}</span>
                <Icon icon="lucide:chevron-right" class="size-4 shrink-0 md:hidden rtl:-scale-x-100" />
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </div>
  </nav>

  <div
    class={[
      "flex min-w-0 flex-1 flex-col",
      chosen ? "" : "max-md:hidden",
    ]}
  >
    <header class="flex h-12 shrink-0 items-center gap-2 px-3 md:hidden">
      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm"
        aria-label={i18n.t("ui.back")}
        title={i18n.t("ui.back")}
        onclick={() => (chosen = null)}
      >
        <Icon icon="lucide:arrow-left" class="size-5 rtl:-scale-x-100" />
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="flex w-full max-w-2xl flex-col gap-6 px-6 py-8 md:px-10">
        {#if active === "profile"}
          <ProfileSettings />
        {:else if active === "voice"}
          <VoiceSettings />
        {:else if active === "appearance"}
          <AppearanceSettings />
        {:else if active === "language"}
          <LanguageSettings />
        {:else if active === "keymap"}
          <KeymapSettings />
        {:else if active === "window"}
          <section class="flex flex-col gap-3 rounded-box border border-base-content/10 bg-base-100/50 p-6">
            <h2 class="font-bold">{i18n.t("settings.window.title")}</h2>
            <label class="flex cursor-pointer items-center justify-between gap-4">
              <span class="min-w-0 text-sm">{i18n.t("settings.window.customTitleBar")}</span>
              <input
                type="checkbox"
                class="toggle toggle-primary"
                checked={titleBarStore.custom}
                onchange={e => titleBarStore.setCustom(e.currentTarget.checked)}
              />
            </label>
          </section>
        {:else}
          <section class="flex flex-col gap-3 rounded-box border border-base-content/10 bg-base-100/50 p-6">
            <h2 class="font-bold">{i18n.t("settings.session.title")}</h2>
            <p class="text-muted text-sm">{i18n.t("settings.session.hint")}</p>
            <div class="flex flex-wrap gap-2">
              {#if accountUri}
                <button type="button" class="btn btn-outline w-fit" onclick={() => openExternal(accountUri)}>
                  <Icon icon="lucide:external-link" class="size-4" />
                  {i18n.t("settings.session.manageAccount")}
                </button>
              {/if}
              <button type="button" class="btn btn-error w-fit" onclick={() => sessionStore.logout()}>
                <Icon icon="lucide:log-out" class="size-4" />
                {i18n.t("settings.session.signOut")}
              </button>
            </div>
          </section>
        {/if}
      </div>
    </div>
  </div>
</main>
