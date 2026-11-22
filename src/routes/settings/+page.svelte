<script lang="ts">
import Icon from "@iconify/svelte"
import Backdrop from "#lib/components/chat/Backdrop.svelte"
import AppearanceSettings from "#lib/components/settings/AppearanceSettings.svelte"
import KeymapSettings from "#lib/components/settings/KeymapSettings.svelte"
import LanguageSettings from "#lib/components/settings/LanguageSettings.svelte"
import ProfileSettings from "#lib/components/settings/ProfileSettings.svelte"
import VoiceSettings from "#lib/components/settings/VoiceSettings.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { HOME_PATH } from "#lib/routes.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { titleBarStore } from "#lib/store/titleBar.svelte.js"
import { goto } from "$app/navigation"

const close = () => {
  if (history.length > 1) {
    history.back()
  } else {
    void goto(HOME_PATH)
  }
}
</script>

<main class="relative isolate flex h-full flex-col overflow-hidden bg-base-100">
  <Backdrop strength="faint" />

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

  <div class="min-h-0 flex-1 overflow-y-auto">
  <div class="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-8">

    <ProfileSettings />

    <VoiceSettings />

    <AppearanceSettings />

    <LanguageSettings />

    <KeymapSettings />

    {#if titleBarStore.supported}
  <section class="flex flex-col gap-3 rounded-box border border-base-content/10 bg-base-100/50 p-6">
    <h2 class="font-bold">{i18n.t("settings.window.title")}</h2>
    <label class="flex cursor-pointer items-center justify-between gap-4">
      <span class="min-w-0 text-sm">{i18n.t("settings.window.customTitleBar")}</span>
      <input type="checkbox" class="toggle toggle-primary" checked={titleBarStore.custom} onchange={event => titleBarStore.setCustom(event.currentTarget.checked)} />
    </label>
  </section>
{/if}


    <section class="flex flex-col gap-3 rounded-box border border-base-content/10 bg-base-100/50 p-6">
      <h2 class="font-bold">{i18n.t("settings.session.title")}</h2>
      <p class="text-muted text-sm">{i18n.t("settings.session.hint")}</p>
      <button type="button" class="btn btn-error w-fit" onclick={() => sessionStore.logout()}>
        <Icon icon="lucide:log-out" class="size-4" />
        {i18n.t("settings.session.signOut")}
      </button>
    </section>
  </div>
  </div>
</main>
