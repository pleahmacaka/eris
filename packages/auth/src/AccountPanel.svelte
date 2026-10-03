<script lang="ts">
  import type { Account, OAuthProvider } from "./account.svelte"
  import { type Copy, copyFor } from "./copy"

  let {
    account,
    lang = "en",
  }: { account: Account | null; lang?: string | null } = $props()

  const copy = $derived(copyFor(lang))

  let email = $state("")
  let password = $state("")
  let busy = $state(false)
  let notice = $state("")
  let failure = $state("")

  const reason = (error: unknown) => {
    const code = (error as { code?: string } | null)?.code ?? ""

    return copy.errors[code as keyof Copy["errors"]] ?? copy.errors.failed
  }

  $effect(() => {
    if (account?.failure) {
      failure = reason(account.failure)
    }
  })

  const run = async (task: () => Promise<string | undefined>) => {
    busy = true
    notice = ""
    failure = ""

    try {
      notice = (await task()) ?? ""
    } catch (error) {
      failure = reason(error)
    } finally {
      busy = false
    }
  }

  const needs = (fields: string[], message: string) => {
    if (fields.every(field => field.trim())) {
      return true
    }

    failure = message

    return false
  }

  const signIn = (e: SubmitEvent) => {
    e.preventDefault()

    if (account && needs([email, password], copy.needPassword)) {
      run(async () => {
        await account.signInWithPassword(email.trim(), password)

        return undefined
      })
    }
  }

  const signUp = () => {
    if (account && needs([email, password], copy.needPassword)) {
      run(async () => {
        const { confirm } = await account.signUp(email.trim(), password)

        return confirm ? copy.confirmSent : undefined
      })
    }
  }

  const magicLink = () => {
    if (account && needs([email], copy.needEmail)) {
      run(async () => {
        await account.signInWithOtp(email.trim())

        return copy.linkSent
      })
    }
  }

  const oauth = (provider: OAuthProvider) => {
    if (account) {
      run(async () => {
        await account.signInWithOAuth(provider)

        return copy.browser
      })
    }
  }
</script>

{#if !account || !account.ready}
  <p class="text-sm text-base-content/60">{copy.loading}</p>
{:else if account.user}
  <div class="flex items-center justify-between gap-4">
    <div class="flex min-w-0 flex-col">
      <span class="text-xs text-base-content/60">{copy.signedIn}</span>
      <span class="truncate text-sm font-medium">{account.user.email}</span>
    </div>

    <button
      type="button"
      class="btn btn-sm"
      disabled={busy}
      onclick={() => run(async () => {
        await account.signOut()

        return undefined
      })}
    >
      {copy.signOut}
    </button>
  </div>
{:else}
  <form class="flex flex-col gap-3" onsubmit={signIn}>
    <label class="flex flex-col gap-1 text-sm">
      <span>{copy.email}</span>

      <input
        type="email"
        class="input input-sm w-full"
        autocomplete="email"
        bind:value={email}
      />
    </label>

    <label class="flex flex-col gap-1 text-sm">
      <span>{copy.password}</span>

      <input
        type="password"
        class="input input-sm w-full"
        autocomplete="current-password"
        bind:value={password}
      />
    </label>

    <div class="grid grid-cols-2 gap-2">
      <button type="submit" class="btn btn-sm btn-primary" disabled={busy}>
        {copy.signIn}
      </button>

      <button type="button" class="btn btn-sm" disabled={busy} onclick={signUp}>
        {copy.signUp}
      </button>
    </div>

    <button
      type="button"
      class="btn btn-sm btn-ghost"
      disabled={busy}
      onclick={magicLink}
    >
      {copy.magicLink}
    </button>

    <div class="divider my-0 text-xs text-base-content/50">{copy.divider}</div>

    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        class="btn btn-sm"
        disabled={busy}
        onclick={() => oauth("github")}
      >
        {copy.github}
      </button>

      <button
        type="button"
        class="btn btn-sm"
        disabled={busy}
        onclick={() => oauth("google")}
      >
        {copy.google}
      </button>
    </div>
  </form>
{/if}

{#if notice}
  <p class="mt-3 text-sm text-base-content/70" role="status">{notice}</p>
{/if}

{#if failure}
  <p class="mt-3 text-sm text-error" role="alert">{failure}</p>
{/if}
