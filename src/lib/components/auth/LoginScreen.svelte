<script lang="ts">
import { logoPainter } from "#lib/brand/ascii/sources.js"
import AsciiArt from "#lib/components/brand/AsciiArt.svelte"
import AsciiField from "#lib/components/brand/AsciiField.svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { type AuthOptions, probeAuth } from "#lib/matrix/auth.js"
import { discoverHomeserver } from "#lib/matrix/discovery.js"
import {
  DEFAULT_HOMESERVER,
  normalizeHomeserver,
  splitUserId,
} from "#lib/matrix/session.js"
import { sessionStore } from "#lib/store/session.svelte.js"

type Discovery = "idle" | "checking" | "found" | "missing"

const DISCOVERY_TEXT: Record<Exclude<Discovery, "idle">, MessageKey> = {
  checking: "auth.discovery.checking",
  found: "auth.discovery.found",
  missing: "auth.discovery.missing",
}

let homeserver = $state(normalizeHomeserver(DEFAULT_HOMESERVER))
let userId = $state("")
let password = $state("")
let discovery = $state<Discovery>("idle")
let methods = $state<AuthOptions | null>(null)
let probing = $state(true)
let passwordOpen = $state(false)
let discoveredDomain: string | null = null
let probedHomeserver: string | null = null
let submitting = false

const account = $derived(splitUserId(userId))
const authorizing = $derived(sessionStore.status === "authorizing")
const busy = $derived(sessionStore.status === "signing-in" || authorizing)
const ready = $derived(
  homeserver.trim() !== "" &&
    account.localpart !== "" &&
    password !== "" &&
    discovery !== "checking",
)
const serverName = $derived.by(() => {
  if (account.domain) {
    return account.domain
  }

  try {
    return new URL(normalizeHomeserver(homeserver)).host
  } catch {
    return homeserver.trim()
  }
})
const redirectable = $derived(
  methods !== null && (methods.oauth !== null || methods.sso !== null),
)
const providers = $derived(methods && !methods.oauth ? (methods.sso ?? []) : [])
const redirectFirst = $derived(
  probing || (redirectable && methods?.preferRedirect === true),
)
const passwordAllowed = $derived(methods?.password ?? true)
const passwordVisible = $derived(!redirectFirst || passwordOpen)

const probe = async (target: string) => {
  const base = normalizeHomeserver(target)

  if (base === probedHomeserver) {
    return
  }

  probedHomeserver = base
  probing = true

  const found = await probeAuth(base).catch(() => null)

  if (probedHomeserver !== base) {
    return
  }

  methods = found
  probing = false
}

void probe(DEFAULT_HOMESERVER)

const discover = async (domain: string) => {
  if (domain === discoveredDomain) {
    return
  }

  discoveredDomain = domain
  discovery = "checking"

  const found = await discoverHomeserver(domain)

  if (discoveredDomain !== domain) {
    return
  }

  if (found) {
    homeserver = found
    discovery = "found"
  } else {
    discovery = "missing"
  }

  await probe(homeserver)
}

const onUserIdChange = () => {
  if (account.domain) {
    void discover(account.domain)
  }
}

const onHomeserverChange = () => {
  void probe(homeserver)
}

const continueWith = async (providerId?: string) => {
  if (!methods || busy) {
    return
  }

  await sessionStore.loginWithRedirect(
    homeserver,
    methods,
    {
      title: i18n.t("auth.loopback.title"),
      body: i18n.t("auth.loopback.body"),
    },
    providerId,
  )
}

const submit = async (event: SubmitEvent) => {
  event.preventDefault()

  if (!ready || submitting) {
    return
  }

  submitting = true

  try {
    if (account.domain && account.domain !== discoveredDomain) {
      await discover(account.domain)
    }

    await sessionStore.login(homeserver, account.localpart, password)
  } finally {
    submitting = false
  }
}

const reveal = (event: FocusEvent) => {
  const field = event.currentTarget as HTMLElement

  field.scrollIntoView({ block: "center" })
}
</script>

{#snippet label(text: string, pending: boolean)}
  <span class="grid">
    <span
      class={[
        "col-start-1 row-start-1 flex items-center justify-center",
        pending && "invisible",
      ]}
    >
      {text}
    </span>
    <span
      class={[
        "col-start-1 row-start-1 flex items-center justify-center",
        !pending && "invisible",
      ]}
    >
      <span class="loading loading-spinner loading-sm"></span>
    </span>
  </span>
{/snippet}

{#snippet passwordButton(tone: string)}
  <button type="submit" class={["btn btn-lg", tone]} disabled={!ready || busy}>
    {@render label(i18n.t("auth.signIn"), sessionStore.status === "signing-in")}
  </button>
{/snippet}

{#snippet redirectButtons(tone: string)}
  {#if authorizing}
    <div class="flex min-h-14 items-center justify-between gap-3" aria-live="polite">
      <span class="flex items-center gap-2 text-sm">
        <span class="loading loading-spinner loading-sm"></span>
        {i18n.t("auth.redirect.waiting")}
      </span>
      <button type="button" class="btn btn-ghost" onclick={() => sessionStore.cancelRedirect()}>
        {i18n.t("ui.cancel")}
      </button>
    </div>
  {:else}
    <button
      type="button"
      class={["btn btn-lg", tone]}
      disabled={probing || discovery === "checking" || !redirectable || busy}
      onclick={() => continueWith()}
    >
      {@render label(
        i18n.t("auth.continueWith", { name: serverName }),
        probing || discovery === "checking",
      )}
    </button>
    {#each providers as provider (provider.id)}
      <button
        type="button"
        class="btn btn-outline"
        disabled={busy}
        onclick={() => continueWith(provider.id)}
      >
        {i18n.t("auth.continueWith", { name: provider.name })}
      </button>
    {/each}
  {/if}
{/snippet}

<main class="relative isolate flex h-full flex-col overflow-hidden">
  <AsciiField class="absolute inset-0 -z-10 size-full" />
  <div class="vignette absolute inset-0 -z-10" aria-hidden="true"></div>

  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
    <div
      class={[
        "mx-auto grid w-full max-w-5xl flex-1 items-center gap-x-12 gap-y-6",
        "px-6 py-6 sm:py-16 md:grid-cols-2 short:py-6",
      ]}
    >
      <div
        class={[
          "flex flex-col items-center gap-4 text-center",
          "md:items-start md:text-start",
        ]}
      >
        <AsciiArt
          paint={logoPainter}
          cols={64}
          rows={34}
          interactive
          class="w-full max-w-40 cursor-crosshair sm:max-w-3xs lg:max-w-xs short:max-w-48"
        />


        <h1
          class={[
            "font-black leading-none tracking-tighter uppercase",
            "text-6xl sm:text-7xl lg:text-8xl short:text-5xl",
          ]}
        >
          Eris
        </h1>

        <p class="font-medium text-base text-muted tracking-tight sm:text-lg">
          {i18n.t("auth.subtitle")}
        </p>
      </div>

      <form
        class={[
          "flex flex-col gap-4 rounded-box border border-base-content/10",
          "bg-base-100/50 p-6 backdrop-blur-sm sm:p-8",
        ]}
        onsubmit={submit}
      >
        <fieldset class="fieldset gap-3" disabled={busy}>
          <label class="fieldset-label" for="user-id">{i18n.t("friends.add.userId")}</label>
          <input
            id="user-id"
            class="input w-full"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            placeholder={i18n.t("friends.add.placeholder")}
            required={passwordVisible}
            onfocus={reveal}
            onchange={onUserIdChange}
            bind:value={userId}
          />

          <label class="fieldset-label" for="homeserver">{i18n.t("profile.homeserver")}</label>
          <input
            id="homeserver"
            class="input w-full"
            type="url"
            autocomplete="url"
            required
            onfocus={reveal}
            onchange={onHomeserverChange}
            bind:value={homeserver}
          />
          <p class="fieldset-label min-h-5" aria-live="polite">
            {discovery === "idle" ? "" : i18n.t(DISCOVERY_TEXT[discovery])}
          </p>

          {#if passwordVisible && passwordAllowed}
            <label class="fieldset-label" for="password">{i18n.t("auth.password")}</label>
            <input
              id="password"
              class="input w-full"
              type="password"
              autocomplete="current-password"
              required
              onfocus={reveal}
              bind:value={password}
            />
          {/if}
        </fieldset>

        <p class="min-h-10 text-error text-sm" role="alert">
          {sessionStore.error ? i18n.text(sessionStore.error) : ""}
        </p>

        {#if redirectFirst}
          {@render redirectButtons("btn-primary")}
          {#if passwordAllowed}
            {#if passwordOpen}
              {@render passwordButton("btn-outline")}
            {:else}
              <button
                type="button"
                class="btn btn-ghost"
                disabled={busy}
                onclick={() => (passwordOpen = true)}
              >
                {i18n.t("auth.usePassword")}
              </button>
            {/if}
          {/if}
        {:else}
          {@render passwordButton("btn-primary")}
          {#if redirectable}
            <div class="divider my-0 text-muted text-sm">{i18n.t("auth.or")}</div>
            {@render redirectButtons("btn-outline")}
          {/if}
        {/if}
      </form>
    </div>
  </div>
</main>
