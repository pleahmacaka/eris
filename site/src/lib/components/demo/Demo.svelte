<script lang="ts">
import Icon from "@iconify/svelte"
import Logo from "#lib/components/brand/Logo.svelte"
import MockFrame from "#lib/components/landing/mock/MockFrame.svelte"
import ScreenTabs from "#lib/components/landing/mock/ScreenTabs.svelte"
import { SCREEN_VIEWS } from "#lib/components/landing/mock/views.js"
import ThemePreviewBar from "#lib/components/theme/ThemePreviewBar.svelte"
import type { Copy } from "#lib/server/copy.js"
import { provideMockDemo } from "#lib/store/mockDemo.svelte.js"

let { t }: { t: Copy } = $props()

const demo = provideMockDemo()

const Screen = $derived(SCREEN_VIEWS[demo.screen])

const screen = $derived(
  t.showcase.screens.find(item => item.id === demo.screen),
)
</script>

<div class="flex h-dvh flex-col bg-base-300">
  <header
    class={[
      "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:border-b",
      "border-base-content/10",
    ]}
  >
    <a
      class="btn btn-ghost btn-sm max-sm:btn-square"
      href="../"
      aria-label={t.demo.home}
      title={t.demo.home}
    >
      <Icon icon="lucide:house" class="size-4" />
      <span class="max-sm:hidden">{t.demo.home}</span>
    </a>

    <h1 class="flex min-w-0 items-center gap-2 font-bold">
      <span class="shrink-0" aria-hidden="true">
        <Logo class="size-5" />
      </span>
      <span class="truncate">{t.demo.title}</span>
    </h1>

    <ScreenTabs
      t={t.showcase}
      layout="scroll"
      class="w-full lg:w-auto lg:flex-1"
      bind:active={() => demo.screen, id => demo.show(id)}
    />
  </header>

  <main id="content" class="min-h-0 flex-1 sm:px-3 sm:pt-3">
    <MockFrame live fill label={screen?.alt ?? t.demo.title}>
      <Screen t={t.showcase.mock} />
    </MockFrame>
  </main>

  <p class="shrink-0 px-3 py-2 text-center text-base-content/70 text-xs">
    {t.demo.note}
  </p>

  <ThemePreviewBar t={t.themes} />
</div>
