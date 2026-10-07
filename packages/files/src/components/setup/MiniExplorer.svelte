<script lang="ts">
  let {
    compact,
    preview,
    class: className = "",
  }: { compact: boolean; preview: boolean; class?: string } = $props()

  const ROWS = [72, 54, 64, 46, 58]
</script>

<div
  aria-hidden="true"
  class={[
    "flex aspect-[16/10] flex-col overflow-hidden rounded-box border border-base-content/10 bg-base-100 shadow-lg",
    className,
  ]}
>
  <div class="flex h-[8%] shrink-0 items-center gap-1 bg-base-200 px-2">
    <span class="h-1/2 w-1/5 rounded-sm bg-base-content/15"></span>
    <span class="grow"></span>
    <span class="size-1.5 rounded-full bg-base-content/25"></span>
    <span class="size-1.5 rounded-full bg-base-content/25"></span>
    <span class="size-1.5 rounded-full bg-base-content/25"></span>
  </div>

  <div class="flex h-[9%] shrink-0 items-center gap-1.5 px-2">
    <span class="size-2 rounded-sm bg-base-content/25"></span>
    <span class="size-2 rounded-sm bg-base-content/25"></span>
    <span class="h-1/2 grow rounded-field bg-base-content/10"></span>
    <span class="h-1/2 w-1/5 rounded-field bg-base-content/10"></span>
    <span class="size-2 rounded-sm bg-base-content/25"></span>

    {#if compact}
      <span class="size-2 rounded-sm bg-primary/70"></span>
      <span class="size-2 rounded-sm bg-base-content/25"></span>
    {/if}
  </div>

  {#if !compact}
    <div class="flex h-[8%] shrink-0 items-center gap-1.5 border-b border-base-content/10 px-2">
      {#each [0, 1, 2, 3, 4] as index (index)}
        <span class="size-2 rounded-sm bg-base-content/20"></span>
      {/each}
      <span class="grow"></span>
      <span class="size-2 rounded-sm bg-primary/70"></span>
      <span class="size-2 rounded-sm bg-base-content/20"></span>
    </div>
  {:else}
    <div class="border-b border-base-content/10"></div>
  {/if}

  <div class="flex min-h-0 grow">
    <div class="flex w-1/4 shrink-0 flex-col gap-1.5 border-r border-base-content/10 p-2">
      <span class="h-2 w-4/5 rounded-sm bg-primary/30"></span>
      {#each ROWS as width, index (index)}
        <span class="h-1.5 rounded-sm bg-base-content/15" style:width="{width}%"></span>
      {/each}
    </div>

    <div class="grid min-w-0 grow grid-cols-4 content-start gap-2 p-2">
      {#each Array.from({ length: 12 }, (_, index) => index) as index (index)}
        <div class="flex flex-col items-center gap-1">
          <span
            class={[
              "aspect-square w-3/5 rounded-sm",
              index === 1 ? "bg-primary/60" : "bg-base-content/15",
            ]}
          ></span>
          <span class="h-1 w-4/5 rounded-sm bg-base-content/10"></span>
        </div>
      {/each}
    </div>

    {#if preview}
      <div class="flex w-1/4 shrink-0 flex-col gap-1.5 border-l border-base-content/10 p-2">
        <span class="aspect-square w-full rounded-sm bg-primary/20"></span>
        <span class="h-1.5 w-4/5 rounded-sm bg-base-content/20"></span>
        <span class="h-1.5 w-3/5 rounded-sm bg-base-content/10"></span>
      </div>
    {/if}
  </div>
</div>
