<script lang="ts">
  import ClaudeMock from "$lib/components/mock/ClaudeMock.svelte"
  import DockMock from "$lib/components/mock/DockMock.svelte"
  import EditMock from "$lib/components/mock/EditMock.svelte"
  import FilesMock from "$lib/components/mock/FilesMock.svelte"
  import LauncherMock from "$lib/components/mock/LauncherMock.svelte"
  import PanelMock from "$lib/components/mock/PanelMock.svelte"
  import SyncMock from "$lib/components/mock/SyncMock.svelte"
  import TerminalMock from "$lib/components/mock/TerminalMock.svelte"
  import ThemesMock from "$lib/components/mock/ThemesMock.svelte"
  import Eyebrow from "$lib/components/ui/Eyebrow.svelte"
  import type { Copy } from "$lib/copy/en"
  import Feature from "./Feature.svelte"

  let { t }: { t: Copy } = $props()

  const items = $derived(t.features.items)
</script>

<section
  id="features"
  aria-labelledby="features-title"
  class="mx-auto max-w-6xl px-6 py-32"
>
  <div class="flex flex-col gap-6">
    <Eyebrow>{t.features.label}</Eyebrow>

    <h2
      id="features-title"
      class="text-balance font-bold text-5xl tracking-tight sm:text-6xl"
    >
      {t.features.title}
    </h2>
  </div>

  <ol class="mt-24 flex flex-col gap-32">
    <Feature id="dock" index={1} icon="lucide:panel-bottom" {...items.dock}>
      <DockMock />
    </Feature>

    <Feature id="launcher" index={2} icon="lucide:search" {...items.launcher}>
      <LauncherMock {t} />
    </Feature>

    <Feature id="panel" index={3} icon="lucide:calendar" {...items.panel}>
      <PanelMock {t} />
    </Feature>

    <Feature
      id="files"
      index={4}
      icon="lucide:folder-open"
      badge={t.features.new}
      {...items.files}
    >
      <FilesMock {t} />
    </Feature>

    <Feature
      id="terminal"
      index={5}
      icon="lucide:terminal"
      badge={t.features.new}
      {...items.terminal}
    >
      <TerminalMock {t} />
    </Feature>

    <Feature id="themes" index={6} icon="lucide:palette" {...items.themes}>
      <ThemesMock />
    </Feature>

    <Feature
      id="edit"
      index={7}
      icon="lucide:mouse-pointer-click"
      {...items.edit}
    >
      <EditMock {t} />
    </Feature>

    <Feature id="sync" index={8} icon="lucide:refresh-cw" {...items.sync}>
      <SyncMock {t} />
    </Feature>

    <Feature id="claude" index={9} icon="lucide:sparkles" {...items.claude}>
      <ClaudeMock {t} />
    </Feature>
  </ol>
</section>
