<script lang="ts">
import Icon from "@iconify/svelte"
import Logo from "#lib/components/brand/Logo.svelte"
import LanguageMenu from "#lib/components/i18n/LanguageMenu.svelte"
import type { LocaleInfo } from "#lib/i18n/locales.js"
import { REPO } from "#lib/landing/content.js"
import type { Copy } from "#lib/server/copy.js"

let { locale, t }: { locale: LocaleInfo; t: Copy["nav"] } = $props()
</script>

<header
  class={[
    "absolute inset-x-6 top-6 z-10 flex items-center justify-between gap-4",
    "sm:inset-x-10 sm:top-8",
  ]}
>
  <Logo class="size-6" />

  <div class="flex items-center gap-1">
    <LanguageMenu current={locale} label={t.language} />

    <a class="btn btn-ghost btn-sm btn-square" href={REPO} aria-label={t.source}>
      <Icon icon="lucide:github" class="size-4" />
    </a>
  </div>
</header>
