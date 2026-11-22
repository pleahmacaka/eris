<script lang="ts">
import Icon from "@iconify/svelte"
import Dropdown from "#lib/components/ui/Dropdown.svelte"
import { LOCALES, type LocaleInfo } from "#lib/i18n/locales.js"
import { rememberLocale } from "#lib/i18n/preference.js"

type Props = { current: LocaleInfo; label: string }

let { current, label }: Props = $props()
</script>

<Dropdown id="language-menu">
  {#snippet trigger()}
    <Icon icon="lucide:languages" class="size-4" />
    <span class="sr-only">{label}</span>
    <span lang={current.tag}>{current.name}</span>
    <Icon icon="lucide:chevron-down" class="size-3.5 opacity-60" />
  {/snippet}

  <ul
    class="menu grid w-80 max-w-full grid-cols-2 gap-x-1 p-0 font-system"
    aria-label={label}
  >
    {#each LOCALES as locale (locale.tag)}
      <li>
        <a
          href="../{locale.tag}/"
          hreflang={locale.tag}
          lang={locale.tag}
          aria-current={locale.tag === current.tag ? "page" : undefined}
          class={{ "menu-active": locale.tag === current.tag }}
          data-sveltekit-reload
          onclick={() => rememberLocale(locale.tag)}
        >
          <span class="min-w-0 wrap-break-word">{locale.name}</span>
        </a>
      </li>
    {/each}
  </ul>
</Dropdown>
