<script lang="ts">
  import AdvancedSection from "./AdvancedSection.svelte"
  import AppearanceSection from "./AppearanceSection.svelte"
  import LayoutSection from "./LayoutSection.svelte"
  import SyncSection from "./SyncSection.svelte"
  import VaultSection from "./VaultSection.svelte"

  const SECTIONS = [
    { id: "vault", label: "볼트", view: VaultSection },
    { id: "sync", label: "기기 동기화", view: SyncSection },
    { id: "appearance", label: "화면", view: AppearanceSection },
    { id: "layout", label: "레이아웃", view: LayoutSection },
    { id: "advanced", label: "고급", view: AdvancedSection },
  ]

  let scroller: HTMLDivElement
  let current = $state(SECTIONS[0].id)

  const jump = (id: string) => {
    scroller
      .querySelector(`[data-section="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  $effect(() => {
    const seen = new IntersectionObserver(
      entries => {
        const visible = entries.find(e => e.isIntersecting)

        if (visible) {
          current = (visible.target as HTMLElement).dataset.section ?? current
        }
      },
      { root: scroller, rootMargin: "0% 0% -70% 0%" },
    )

    for (const node of scroller.querySelectorAll("[data-section]")) {
      seen.observe(node)
    }

    return () => seen.disconnect()
  })
</script>

<div class="@container flex min-h-0 flex-1 bg-base-100">
  <nav
    class={[
      "hidden w-48 shrink-0 flex-col gap-0.5 border-r border-base-content/10",
      "px-2 py-6 @3xl:flex",
    ]}
    aria-label="설정 목차"
  >
    <p class="px-3 pb-3 text-xs text-base-content/45">
      <span class="text-primary/70" aria-hidden="true">//</span> 설정
    </p>
    {#each SECTIONS as section (section.id)}
      <button
        class={[
          "relative cursor-pointer px-3 py-1.5 text-left text-sm transition",
          current === section.id
            ? "bg-base-content/5 text-base-content"
            : "text-base-content/60 hover:text-base-content",
        ]}
        onclick={() => jump(section.id)}
      >
        {#if current === section.id}
          <span class="absolute inset-y-1 left-0 w-0.5 bg-primary"></span>
        {/if}
        {section.label}
      </button>
    {/each}
  </nav>

  <div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-8">
      <h1 class="mb-8 text-2xl font-bold tracking-tight">설정</h1>

      {#each SECTIONS as section (section.id)}
        <div data-section={section.id} class="scroll-mt-6">
          <section.view />
        </div>
      {/each}
    </div>
  </div>
</div>
