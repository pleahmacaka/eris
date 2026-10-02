<script lang="ts">
  import Logo from "@eris/ui/Logo.svelte"
  import Icon from "@iconify/svelte"
  import MockStage from "./MockStage.svelte"

  const apps = [
    { icon: "lucide:folder", open: true },
    { icon: "lucide:globe", open: true },
    { icon: "lucide:terminal", open: false },
    { icon: "lucide:message-circle", open: true },
    { icon: "lucide:music", open: false },
  ]
</script>

<MockStage>
  <div class="mx-auto mt-auto flex w-full max-w-xl flex-col items-start gap-3">
    <div
      class={[
        "ml-4 flex gap-2 rounded-2xl border border-base-content/10 bg-base-100",
        "p-2 shadow-2xl sm:ml-10",
      ]}
    >
      {#each [0.7, 0.45] as fill (fill)}
        <div
          class="flex w-24 flex-col gap-1.5 rounded-xl bg-base-200 p-2 sm:w-32"
        >
          <div class="h-1.5 w-2/3 rounded-full bg-base-content/30"></div>

          <div
            class="flex h-14 flex-col gap-1 rounded-lg bg-base-300 p-2 sm:h-16"
          >
            <div
              class="h-1 rounded-full bg-primary/60"
              style:width="{fill * 100}%"
            ></div>
            <div class="h-1 w-1/2 rounded-full bg-base-content/15"></div>
            <div class="h-1 w-3/4 rounded-full bg-base-content/15"></div>
          </div>
        </div>
      {/each}
    </div>

    <div
      class={[
        "flex w-full max-w-xl items-center gap-1 rounded-2xl border p-1.5",
        "border-base-content/10 bg-base-100/90 shadow-2xl sm:gap-1.5 sm:p-2",
      ]}
    >
      <div
        class="grid size-9 place-items-center rounded-xl bg-primary/15 sm:size-10"
      >
        <Logo class="size-5" />
      </div>

      <div class="mx-1 h-6 border-l border-base-content/10"></div>

      {#each apps as app, i (app.icon)}
        <div
          class={[
            "relative size-9 place-items-center rounded-xl sm:size-10",
            i === 0 ? "bg-base-300" : "bg-base-200",
            i > 3 ? "hidden sm:grid" : "grid",
          ]}
        >
          <Icon icon={app.icon} class="size-5 text-base-content/80" />

          {#if app.open}
            <span
              class={[
                "absolute bottom-0.5 h-0.5 rounded-full",
                i === 0 ? "w-3 bg-primary" : "w-1.5 bg-base-content/40",
              ]}
            ></span>
          {/if}
        </div>
      {/each}

      <div class="ml-auto flex items-center gap-2.5 px-2 text-base-content/70">
        <Icon icon="lucide:wifi" class="hidden size-4 sm:block" />
        <Icon icon="lucide:volume-2" class="hidden size-4 sm:block" />
        <Icon icon="lucide:battery-full" class="size-4" />
        <span class="text-xs tabular-nums">14:08</span>
      </div>
    </div>
  </div>
</MockStage>
