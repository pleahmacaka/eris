<script lang="ts">
  import { type Account, webAccount } from "@eris/auth"
  import Logo from "@eris/ui/Logo.svelte"
  import { onMount } from "svelte"
  import type { Copy } from "$lib/copy/en"
  import { hrefFor, type Lang, languages } from "$lib/copy/languages"

  let { lang, t }: { lang: Lang; t: Copy } = $props()

  let account = $state<Account | null>(null)

  onMount(() => {
    account = webAccount()
  })
</script>

<header
  class={[
    "absolute inset-x-7 top-7 z-10 flex items-center justify-between gap-4",
    "sm:inset-x-10 sm:top-9",
  ]}
>
  <Logo class="size-5" />

  <nav aria-label={t.languages} class="flex items-center gap-3 text-sm">
    {#each languages as l (l.code)}
      <a
        class={[
          "link link-hover",
          l.code === lang ? "font-medium" : "text-base-content/70",
        ]}
        href={hrefFor(lang, l.code)}
        hreflang={l.code}
        lang={l.code}
        aria-current={l.code === lang ? "page" : undefined}
        data-sveltekit-reload
        onclick={() => localStorage.setItem("lang", l.code)}
      >
        {l.label}
      </a>
    {/each}

    <span class="h-4 w-px bg-base-content/20" aria-hidden="true"></span>

    <a class="btn btn-sm btn-ghost" href="themes/">
      {t.themesLink}
    </a>

    <a class="btn btn-sm btn-ghost" href="login/">
      {account?.user ? t.account.signedIn : t.account.link}
    </a>
  </nav>
</header>
