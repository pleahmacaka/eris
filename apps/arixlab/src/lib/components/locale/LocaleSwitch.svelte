<script lang="ts">
import { page } from "$app/state"
import {
  deLocalizeHref,
  getLocale,
  locales,
  localizeHref,
} from "$lib/paraglide/runtime"

const NAMES: Record<string, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
}

const current = getLocale()

const path = $derived(deLocalizeHref(page.url.pathname))
</script>

<nav
  class={[
    "flex items-center gap-x-2.5 whitespace-nowrap text-xs",
    "sm:gap-x-3 sm:text-sm",
  ]}
>
  {#each locales as locale (locale)}
    <a
      class={[
        "link link-hover",
        locale === current ? "font-medium" : "text-base-content/70",
      ]}
      href={localizeHref(path, { locale })}
      hreflang={locale}
      aria-current={locale === current ? "true" : undefined}
      data-sveltekit-reload
    >
      {NAMES[locale]}
    </a>
  {/each}
</nav>
