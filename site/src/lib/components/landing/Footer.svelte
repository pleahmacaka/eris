<script lang="ts">
import Icon from "@iconify/svelte"
import { markArt } from "#lib/brand/ascii.js"
import AsciiArt from "#lib/components/brand/AsciiArt.svelte"
import Wordmark from "#lib/components/brand/Wordmark.svelte"
import { LOCALES, type LocaleInfo } from "#lib/i18n/locales.js"
import { rememberLocale } from "#lib/i18n/preference.js"
import { REPO } from "#lib/landing/content.js"
import type { Copy } from "#lib/server/copy.js"

let { locale, t }: { locale: LocaleInfo; t: Copy } = $props()

const sections = $derived([
  { href: "#preview", label: t.nav.preview },
  { href: "#themes", label: t.nav.themes },
  { href: "#download", label: t.nav.download },
  { href: "#matrix", label: t.nav.matrix },
])
</script>

<footer class="border-base-content/10 border-t">
  <div class="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-5">
    <div class="flex flex-col gap-4 lg:col-span-2">
      <span class="flex items-center gap-3">
        <AsciiArt art={markArt} class="w-20" />
        <span class="sr-only">Eris</span>
        <Wordmark class="h-4.5" />
      </span>

      <p class="text-base-content/60 text-sm">{t.footer.note}</p>

      <a class="link link-hover flex w-fit items-center gap-2 text-sm" href={REPO}>
        <Icon icon="lucide:github" class="size-4" />
        {t.footer.source}
      </a>

      <p class="max-w-sm text-base-content/50 text-xs">{t.footer.disclaimer}</p>
    </div>

    <nav aria-label={t.footer.sections} class="flex flex-col gap-3 text-sm">
      <h2 class="text-base-content/60 text-xs">{t.footer.sections}</h2>

      <ul class="flex flex-col gap-2">
        {#each sections as section (section.href)}
          <li><a class="link link-hover" href={section.href}>{section.label}</a></li>
        {/each}
      </ul>
    </nav>

    <nav
      aria-label={t.nav.language}
      class="flex flex-col gap-3 text-sm lg:col-span-2"
    >
      <h2 class="text-base-content/60 text-xs">{t.nav.language}</h2>

      <ul class="grid grid-cols-2 gap-x-4 gap-y-2 font-system sm:grid-cols-3">
        {#each LOCALES as item (item.tag)}
          <li class="min-w-0">
            <a
              class={[
                "link link-hover wrap-break-word",
                item.tag === locale.tag
                  ? "font-medium"
                  : "text-base-content/70",
              ]}
              href="../{item.tag}/"
              hreflang={item.tag}
              lang={item.tag}
              aria-current={item.tag === locale.tag ? "page" : undefined}
              data-sveltekit-reload
              onclick={() => rememberLocale(item.tag)}
            >
              {item.name}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </div>
</footer>
