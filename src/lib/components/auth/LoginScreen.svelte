<script lang="ts">
import { logoPainter } from "#lib/brand/ascii/sources.js"
import AsciiArt from "#lib/components/brand/AsciiArt.svelte"
import AsciiField from "#lib/components/brand/AsciiField.svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { i18n } from "#lib/i18n/i18n.svelte.js"
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
let discoveredDomain: string | null = null
let submitting = false

const account = $derived(splitUserId(userId))
const busy = $derived(sessionStore.status === "signing-in")
const ready = $derived(
  homeserver.trim() !== "" &&
    account.localpart !== "" &&
    password !== "" &&
    discovery !== "checking",
)

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
}

const onUserIdChange = () => {
  if (account.domain) {
    void discover(account.domain)
  }
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
            required
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
            bind:value={homeserver}
          />
          <p class="fieldset-label min-h-5" aria-live="polite">
            {discovery === "idle" ? "" : i18n.t(DISCOVERY_TEXT[discovery])}
          </p>

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
        </fieldset>

        <p class="min-h-10 text-error text-sm" role="alert">
          {sessionStore.error ? i18n.text(sessionStore.error) : ""}
        </p>

        <button
          type="submit"
          class="btn btn-primary btn-lg"
          disabled={!ready || busy}
        >
          <span class="grid">
            <span
              class={[
                "col-start-1 row-start-1 flex items-center justify-center",
                busy && "invisible",
              ]}
            >
              {i18n.t("auth.signIn")}
            </span>
            <span
              class={[
                "col-start-1 row-start-1 flex items-center justify-center",
                !busy && "invisible",
              ]}
            >
              <span class="loading loading-spinner loading-sm"></span>
            </span>
          </span>
        </button>
      </form>
    </div>
  </div>
</main>
