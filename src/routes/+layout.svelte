<script lang="ts">
import "virtual:iconify-embed"
import "../app.css"
import { Ssgoi, SsgoiLayoutBoundary } from "@ssgoi/svelte"
import { onMount, type Snippet } from "svelte"
import { logoSvg } from "#lib/brand/logo.js"
import Logo from "#lib/components/brand/Logo.svelte"
import CallPanel from "#lib/components/call/CallPanel.svelte"
import KeymapHost from "#lib/components/keymap/KeymapHost.svelte"
import ProfileCard from "#lib/components/profile/ProfileCard.svelte"
import Splash from "#lib/components/shell/Splash.svelte"
import TitleBar from "#lib/components/shell/TitleBar.svelte"
import ContextMenuHost from "#lib/components/ui/ContextMenuHost.svelte"
import PromptHost from "#lib/components/ui/PromptHost.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { motionConfig } from "#lib/motion/config.js"
import { HOME_PATH, LOGIN_PATH } from "#lib/routes.js"
import { audioStore } from "#lib/store/audio.svelte.js"
import { listPrefsStore } from "#lib/store/listPrefs.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { themeStore } from "#lib/store/theme.svelte.js"
import { titleBarStore } from "#lib/store/titleBar.svelte.js"
import { goto, onNavigate } from "$app/navigation"
import { page } from "$app/state"

let { children }: { children: Snippet } = $props()

let content = $state<HTMLDivElement>()

const favicon = $derived(
  `data:image/svg+xml,${encodeURIComponent(logoSvg(token => themeStore.palette[token]))}`,
)
const framework = {
  getRoute: () => ({ pathname: page.url.pathname }),
  onNavigate,
}

const titleBar = $derived(titleBarStore.supported && titleBarStore.custom)

onMount(() => {
  themeStore.start()
  titleBarStore.start()
  audioStore.start()
  listPrefsStore.start()
  void i18n.start()
  void sessionStore.restore()
})

$effect(() => {
  const status = sessionStore.status
  const path = page.url.pathname

  if (status === "signed-out" && !path.startsWith(LOGIN_PATH)) {
    void goto(LOGIN_PATH, { replaceState: true })
  } else if (
    status === "ready" &&
    (path === "/" || path.startsWith(LOGIN_PATH))
  ) {
    void goto(HOME_PATH, { replaceState: true })
  }
})
</script>

<svelte:head>
  <title>Eris</title>
  <link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

<ContextMenuHost boundary={content} />
<KeymapHost />

{#if sessionStore.client}
  <CallPanel />
  <ProfileCard />
  <PromptHost />
{/if}

<div class="safe-area flex h-dvh flex-col">
  {#if titleBar}
    <TitleBar />
  {/if}

  <div
    bind:this={content}
    class="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <Ssgoi config={motionConfig} {framework}>
      <SsgoiLayoutBoundary class="relative min-h-0 flex-1">
        {#if !i18n.ready || sessionStore.status === "restoring" || sessionStore.status === "connecting"}
          <Splash />
        {:else if sessionStore.status === "failed"}
          <main class="backglow flex h-full items-center justify-center p-6">
            <div
              class={[
                "flex max-w-md flex-col items-center gap-4 rounded-box border p-8 text-center",
                "border-base-content/10 bg-base-100/50",
              ]}
            >
              <Logo class="size-12" />
              <h1 class="font-black text-2xl tracking-tighter">{i18n.t("app.connectionFailed")}</h1>
              {#if sessionStore.error}
                <p class="text-muted">{i18n.text(sessionStore.error)}</p>
              {/if}
              <div class="flex gap-2">
                <button type="button" class="btn btn-primary" onclick={() => sessionStore.retry()}>
                  {i18n.t("app.retry")}
                </button>
                <button type="button" class="btn btn-ghost" onclick={() => sessionStore.logout()}>
                  {i18n.t("settings.session.signOut")}
                </button>
              </div>
            </div>
          </main>
        {:else}
          {@render children()}
        {/if}
      </SsgoiLayoutBoundary>
    </Ssgoi>
  </div>
</div>
