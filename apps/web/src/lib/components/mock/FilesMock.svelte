<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Copy } from "$lib/copy/en"
  import MockStage from "./MockStage.svelte"

  let { t }: { t: Copy } = $props()

  const placeIcons = [
    "lucide:house",
    "lucide:monitor",
    "lucide:download",
    "lucide:file-text",
    "lucide:share-2",
  ]

  const files = $derived([
    { icon: "lucide:folder", name: t.mock.files.folder, size: "" },
    { icon: "lucide:box", name: "apple.obj", size: "1.2 MB" },
    { icon: "lucide:file", name: "apple.mtl", size: "2 KB" },
    { icon: "lucide:image", name: "apple.png", size: "840 KB" },
    { icon: "lucide:file-text", name: "notes.md", size: "3 KB" },
  ])
</script>

<MockStage>
  <div class="relative m-auto w-full max-w-2xl pb-10 sm:pr-10">
    <div
      class={[
        "overflow-hidden rounded-2xl border border-base-content/10",
        "bg-base-100 text-xs shadow-2xl",
      ]}
    >
      <div class="flex items-center gap-1 bg-base-200 px-2 pt-2">
        {#each t.mock.files.tabs as tab, i (tab)}
          <span
            class={[
              "flex items-center gap-2 rounded-t-xl px-3 py-1.5",
              i === 0 ? "bg-base-100" : "text-base-content/60",
            ]}
          >
            <Icon icon="lucide:folder" class="size-3.5 text-primary" />
            {tab}
            <Icon icon="lucide:x" class="size-3 text-base-content/40" />
          </span>
        {/each}

        <Icon icon="lucide:plus" class="ml-1 size-3.5 text-base-content/50" />

        <span class="ml-auto flex gap-3 px-2 pb-2 text-base-content/50">
          <Icon icon="lucide:minus" class="size-3.5" />
          <Icon icon="lucide:square" class="size-3" />
          <Icon icon="lucide:x" class="size-3.5" />
        </span>
      </div>

      <div
        class={[
          "flex items-center gap-2 border-b border-base-content/10 px-3 py-2",
          "text-base-content/60",
        ]}
      >
        <Icon icon="lucide:arrow-left" class="size-3.5" />
        <Icon icon="lucide:arrow-right" class="size-3.5" />
        <Icon icon="lucide:arrow-up" class="size-3.5" />

        <span
          class={[
            "flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-base-200",
            "px-3 py-1 text-base-content/80",
          ]}
        >
          {#each t.mock.files.path as segment, i (segment)}
            {#if i > 0}
              <Icon icon="lucide:chevron-right" class="size-3 shrink-0" />
            {/if}
            <span class="truncate">{segment}</span>
          {/each}
        </span>

        <Icon icon="lucide:search" class="size-3.5" />
      </div>

      <div class="grid grid-cols-4">
        <div
          class={[
            "hidden flex-col gap-0.5 border-r border-base-content/10 p-2",
            "sm:flex",
          ]}
        >
          {#each t.mock.files.places as place, i (place)}
            <span
              class={[
                "flex items-center gap-2 rounded-lg px-2 py-1.5",
                i === 0 && "bg-base-200",
              ]}
            >
              <Icon icon={placeIcons[i]} class="size-3.5 shrink-0" />
              <span class="truncate">{place}</span>
            </span>
          {/each}
        </div>

        <div class="col-span-4 flex flex-col gap-0.5 p-2 sm:col-span-3">
          {#each files as file (file.name)}
            <span
              class={[
                "flex items-center gap-2.5 rounded-lg px-2 py-1.5",
                file.name === "apple.obj" && "bg-primary/15",
              ]}
            >
              <Icon
                icon={file.icon}
                class={[
                  "size-4 shrink-0",
                  file.size ? "text-base-content/60" : "text-primary",
                ]}
              />
              <span class="truncate">{file.name}</span>
              <span class="ml-auto text-base-content/40 tabular-nums">
                {file.size}
              </span>
            </span>
          {/each}
        </div>
      </div>
    </div>

    <div
      class={[
        "absolute right-0 bottom-0 w-44 overflow-hidden rounded-2xl border",
        "border-base-content/15 bg-base-100 shadow-2xl sm:w-56",
      ]}
    >
      <div
        class="flex items-center justify-between bg-base-200 px-3 py-2 text-xs"
      >
        <span class="size-4"></span>
        <span class="font-semibold">apple.obj</span>
        <span
          class="grid size-4 place-items-center rounded-full bg-base-content/10"
        >
          <Icon icon="lucide:x" class="size-2.5" />
        </span>
      </div>

      <div class="relative grid aspect-4/3 place-items-center">
        <div class="grid-lines absolute inset-0"></div>
        <Icon icon="lucide:apple" class="relative size-14 text-accent" />
      </div>
    </div>
  </div>
</MockStage>
