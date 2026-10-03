<script lang="ts">
  import { webAccount } from "@eris/auth"
  import { onMount } from "svelte"
  import { copy } from "$lib/copy/languages"

  const RETURN = "eris-auth-return"

  let failed = $state(false)
  let lang = $state<"en" | "ko">("en")

  const t = $derived(copy[lang])
  const retry = $derived(lang === "ko" ? "/ko/login/" : "/login/")

  onMount(() => {
    const back = sessionStorage.getItem(RETURN) ?? "/"

    lang = back.startsWith("/ko/") ? "ko" : "en"

    webAccount()
      .exchangeCodeForSession(location.href)
      .then(() => {
        sessionStorage.removeItem(RETURN)
        location.replace(back)
      })
      .catch(() => {
        failed = true
      })
  })
</script>

<main class="flex min-h-dvh items-center justify-center px-6">
  {#if failed}
    <div class="flex flex-col items-center gap-3 text-center">
      <p class="text-base font-medium">{t.account.failed}</p>
      <a href={retry} class="btn btn-sm">{t.account.retry}</a>
    </div>
  {:else}
    <p class="text-sm text-base-content/70" role="status">
      {t.account.finishing}
    </p>
  {/if}
</main>
