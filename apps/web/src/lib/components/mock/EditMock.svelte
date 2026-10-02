<script lang="ts">
  import Logo from "@eris/ui/Logo.svelte"
  import Icon from "@iconify/svelte"
  import type { Copy } from "$lib/copy/en"
  import MockStage from "./MockStage.svelte"

  let { t }: { t: Copy } = $props()
</script>

<MockStage>
  <div
    class={[
      "absolute top-16 left-6 flex h-36 w-52 flex-col gap-2 rounded-2xl",
      "border border-base-content/10 bg-base-100 p-3 sm:left-10",
    ]}
  >
    <div class="h-1.5 w-1/3 rounded-full bg-base-content/30"></div>
    <div class="h-1 w-3/4 rounded-full bg-base-content/15"></div>
    <div class="h-1 w-2/3 rounded-full bg-base-content/15"></div>
  </div>

  <div class="absolute inset-0 bg-base-300/75"></div>

  <span
    class={[
      "relative mx-auto flex items-center gap-2 rounded-full border",
      "border-base-content/10 bg-base-100 px-4 py-2 text-xs shadow-2xl",
    ]}
  >
    <Icon icon="lucide:mouse-pointer-click" class="size-4 text-primary" />
    {t.mock.edit.hint}
  </span>

  <div class="relative mt-auto flex flex-col items-center gap-3">
    <div
      class={[
        "flex w-56 flex-col gap-3 rounded-2xl border border-base-content/10",
        "bg-base-100 p-4 text-sm shadow-2xl",
      ]}
    >
      <span class="font-semibold">{t.mock.edit.title}</span>

      <div class="flex items-center justify-between gap-3">
        <span class="text-base-content/70">{t.mock.edit.rows[0]}</span>

        <span class="flex rounded-lg bg-base-200 p-0.5 text-xs">
          <span class="px-2 py-1 text-base-content/60">Windows</span>
          <span class="rounded-md bg-primary px-2 py-1 text-primary-content">
            mac
          </span>
        </span>
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-base-content/70">{t.mock.edit.rows[1]}</span>

        <span class="flex h-5 w-9 items-center justify-end rounded-full bg-primary p-0.5">
          <span class="size-4 rounded-full bg-primary-content"></span>
        </span>
      </div>
    </div>

    <div
      class={[
        "flex items-center gap-1.5 rounded-2xl border border-base-content/10",
        "bg-base-100 p-1.5 ring-2 ring-primary ring-offset-4",
        "ring-offset-base-300",
      ]}
    >
      <span class="grid size-9 place-items-center rounded-xl bg-primary/15">
        <Logo class="size-5" />
      </span>

      {#each ["lucide:folder", "lucide:globe", "lucide:terminal"] as icon (icon)}
        <span class="grid size-9 place-items-center rounded-xl bg-base-200">
          <Icon {icon} class="size-5 text-base-content/80" />
        </span>
      {/each}
    </div>
  </div>
</MockStage>
