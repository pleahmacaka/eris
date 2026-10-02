<script lang="ts">
  import MockStage from "./MockStage.svelte"

  const presets = [
    { name: "Arix", base: "#131018", accent: "#ac89e8", ink: "#e8e7ed" },
    { name: "Aurora", base: "#1b1b26", accent: "#5b8def", ink: "#a9c7ff" },
    { name: "Glass", base: "#f3f5fb", accent: "#6f97f5", ink: "#2a3350" },
  ]

  const frosted = (color: string) =>
    `color-mix(in oklch, ${color} 55%, transparent)`
</script>

<MockStage>
  <div class="m-auto grid w-full max-w-2xl grid-cols-3 gap-3 sm:gap-5">
    {#each presets as preset (preset.name)}
      {@const glass = preset.name === "Glass"}

      <div class="flex flex-col items-center gap-3">
        <div
          class={[
            "relative isolate aspect-3/4 w-full overflow-hidden rounded-2xl",
            "border border-base-content/10 shadow-2xl",
          ]}
          style:background-color={glass ? "transparent" : preset.base}
        >
          {#if preset.name === "Aurora"}
            <div
              class={[
                "absolute -top-6 -left-6 -z-10 size-24 rounded-full",
                "opacity-50 blur-2xl",
              ]}
              style:background-color={preset.accent}
            ></div>
            <div
              class={[
                "absolute -right-8 bottom-4 -z-10 size-20 rounded-full",
                "opacity-40 blur-2xl",
              ]}
              style:background-color={preset.ink}
            ></div>
          {/if}

          {#if glass}
            <div class="absolute inset-0 -z-20 bg-base-300"></div>
            <div
              class="absolute top-4 left-2 -z-20 size-16 rounded-full bg-primary"
            ></div>
            <div
              class="absolute right-1 bottom-6 -z-20 size-20 rounded-full bg-accent"
            ></div>
            <div
              class="absolute inset-0 -z-10 backdrop-blur-xl"
              style:background-color={frosted(preset.base)}
            ></div>
          {/if}

          <div class="flex h-full flex-col gap-2 p-3">
            <div
              class="h-2 w-1/2 rounded-full"
              style:background-color={preset.accent}
            ></div>
            <div
              class="h-1.5 w-3/4 rounded-full opacity-60"
              style:background-color={preset.ink}
            ></div>
            <div
              class="h-1.5 w-2/3 rounded-full opacity-40"
              style:background-color={preset.ink}
            ></div>

            <div
              class="mt-auto h-6 rounded-lg opacity-20"
              style:background-color={preset.ink}
            ></div>
          </div>
        </div>

        <span class="font-semibold text-sm">{preset.name}</span>
      </div>
    {/each}
  </div>
</MockStage>
