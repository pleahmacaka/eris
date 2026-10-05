<script lang="ts">
  import Icon from "@iconify/svelte"
  import AsciiField from "$lib/components/ui/AsciiField.svelte"
  import { appVersion } from "$lib/platform/runtime"
  import { device } from "$lib/settings.svelte"
  import { sync } from "$lib/sync/status.svelte"
  import AboutSection from "./AboutSection.svelte"
  import AdvancedSection from "./AdvancedSection.svelte"
  import AppearanceSection from "./AppearanceSection.svelte"
  import LayoutSection from "./LayoutSection.svelte"
  import SyncSection from "./SyncSection.svelte"
  import VaultSection from "./VaultSection.svelte"

  const SECTIONS = [
    {
      id: "general",
      label: "일반",
      hint: "테마, 글자 크기, 달력과 할 일",
      icon: "lucide:sliders-horizontal",
      view: AppearanceSection,
    },
    {
      id: "vault",
      label: "볼트",
      hint: "노트를 저장하는 폴더와 템플릿",
      icon: "lucide:vault",
      view: VaultSection,
    },
    {
      id: "sync",
      label: "동기화",
      hint: "서버 없이 기기끼리 직접 연결합니다",
      icon: "lucide:radio-tower",
      view: SyncSection,
    },
    {
      id: "layout",
      label: "레이아웃",
      hint: "사이드바 패널의 위치",
      icon: "lucide:panels-top-left",
      view: LayoutSection,
    },
    {
      id: "advanced",
      label: "고급",
      hint: "노트 안의 HTML과 스크립트",
      icon: "lucide:flask-conical",
      view: AdvancedSection,
    },
    {
      id: "about",
      label: "정보",
      hint: "버전과 Eris 연동",
      icon: "lucide:info",
      view: AboutSection,
    },
  ]

  const DOTS: Partial<Record<typeof sync.state, string>> = {
    idle: "bg-success",
    syncing: "bg-info animate-pulse",
    error: "bg-error",
  }

  let current = $state(SECTIONS[0].id)
  let version = $state<string | null>(null)
  let scroller: HTMLDivElement

  const section = $derived(
    SECTIONS.find(s => s.id === current) ?? SECTIONS[0],
  )

  appVersion()
    .then(v => (version = v))
    .catch(() => {})

  const open = (id: string) => {
    current = id
    scroller.scrollTop = 0
  }
</script>

<!-- container queries can't style the container itself, so the row lives one level down -->
<div class="@container flex min-h-0 flex-1 break-keep bg-base-100">
  <div class="flex min-h-0 flex-1 flex-col @3xl:flex-row">
    <nav
      class={[
        "flex shrink-0 gap-0.5 overflow-x-auto border-b border-base-content/10",
        "px-2 py-1.5 @3xl:w-52 @3xl:flex-col @3xl:overflow-visible",
        "@3xl:border-r @3xl:border-b-0 @3xl:py-6",
      ]}
      aria-label="설정 분류"
    >
      <div class="hidden px-3 pb-4 @3xl:block">
        <p class="text-xs font-semibold text-base-content/70">
          <span class="font-bold text-primary" aria-hidden="true">//</span> 설정
        </p>
        <p class="mt-1 truncate text-sm font-medium">
          {device.value.deviceName || "이 기기"}
        </p>
        <p class="tabular text-2xs text-base-content/40">
          Note {version ?? ""}
        </p>
      </div>

      {#each SECTIONS as item (item.id)}
        <button
          class={[
            "relative flex shrink-0 cursor-pointer items-center gap-2.5 px-3 py-1.5",
            "text-left text-sm transition",
            current === item.id
              ? "bg-base-content/5 text-base-content"
              : "text-base-content/60 hover:text-base-content",
          ]}
          aria-current={current === item.id ? "page" : undefined}
          onclick={() => open(item.id)}
        >
          {#if current === item.id}
            <span
              class={[
                "absolute inset-x-1 bottom-0 h-0.5 bg-primary",
                "@3xl:inset-x-auto @3xl:inset-y-1 @3xl:left-0 @3xl:h-auto",
                "@3xl:w-0.5",
              ]}
            ></span>
          {/if}
          <Icon icon={item.icon} class="size-4 shrink-0 opacity-70" />
          {item.label}
          {#if item.id === "sync" && DOTS[sync.state]}
            <span
              class={["ml-auto size-1.5 shrink-0", DOTS[sync.state]]}
              aria-hidden="true"
            ></span>
          {/if}
        </button>
      {/each}
    </nav>

    <div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-8">
        <header
          class={[
            "relative mb-8 overflow-hidden border border-base-content/10",
            "bg-base-content/[0.02] px-5 py-6",
          ]}
        >
          <div
            class="absolute inset-y-0 right-0 w-1/2 [mask-image:linear-gradient(to_right,transparent,black_60%)]"
            aria-hidden="true"
          >
            <AsciiField count={8} />
          </div>

          <div class="relative flex items-end justify-between gap-4">
            <div class="min-w-0">
              <p class="text-xs font-medium text-base-content/65">
                <span class="font-bold text-primary" aria-hidden="true">//</span>
                설정 / {section.id}
              </p>
              <h1 class="mt-1 text-2xl font-bold tracking-tight">
                {section.label}
              </h1>
              <p class="mt-1 text-sm text-base-content/65">{section.hint}</p>
            </div>

            <Icon
              icon={section.icon}
              class="size-10 shrink-0 text-primary/25"
              aria-hidden="true"
            />
          </div>
        </header>

        {#key section.id}
          <section.view />
        {/key}
      </div>
    </div>
  </div>
</div>
