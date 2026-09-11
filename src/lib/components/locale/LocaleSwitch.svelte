<script lang="ts">
import { getLocale, locales, localizeHref } from "$lib/paraglide/runtime"

const NAMES: Record<string, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
}

const current = getLocale()
</script>

<nav class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
  {#each locales as locale (locale)}
    <a
      class={[
        "link link-hover",
        locale === current ? "font-medium" : "text-base-content/55",
      ]}
      href={localizeHref("/", { locale })}
      hreflang={locale}
      aria-current={locale === current ? "true" : undefined}
      data-sveltekit-reload
    >
      {NAMES[locale]}
    </a>
  {/each}
</nav>
