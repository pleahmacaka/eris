<script lang="ts">
  import { type Account, AccountPanel, webAccount } from "@eris/auth"
  import Logo from "@eris/ui/Logo.svelte"
  import { onMount } from "svelte"
  import { copy, type Lang } from "$lib/copy/languages"

  let { lang }: { lang: Lang } = $props()

  const t = $derived(copy[lang])
  const home = "../"

  let account = $state<Account | null>(null)

  onMount(() => {
    sessionStorage.setItem("eris-auth-return", location.pathname)
    account = webAccount()
  })
</script>

<svelte:head>
  <title>{t.account.title}</title>
</svelte:head>

<main class="flex min-h-dvh items-center justify-center px-6 py-16">
  <div class="flex w-full max-w-sm flex-col gap-6">
    <a href={home} aria-label={t.account.home} class="self-start">
      <Logo class="size-6" />
    </a>

    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold">{t.account.title}</h1>
      <p class="text-sm text-base-content/70">{t.account.blurb}</p>
    </div>

    <AccountPanel {account} {lang} />

    <a href={home} class="link link-hover text-sm text-base-content/70">
      {t.account.home}
    </a>
  </div>
</main>
