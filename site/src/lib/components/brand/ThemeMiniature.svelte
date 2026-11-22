<script lang="ts">
let { theme }: { theme: string } = $props()
</script>

<span data-theme={theme} class="flex size-full bg-base-100">
  <span class="flex w-1/6 flex-col items-center gap-1 bg-base-300 py-1.5">
    <span class="size-2.5 rounded-sm bg-primary"></span>
    <span class="size-2.5 rounded-full bg-base-100"></span>
    <span class="size-2.5 rounded-full bg-base-100"></span>
  </span>
  <span class="panel-surface flex w-1/3 flex-col gap-1 p-1.5">
    <span class="h-1 w-3/4 rounded-full bg-base-content/30"></span>
    <span class="h-1 w-1/2 rounded-full bg-base-content/15"></span>
    <span class="h-1 w-2/3 rounded-full bg-base-content/15"></span>
    <span class="mt-auto h-2 rounded-field bg-neutral"></span>
  </span>
  <span class="flex flex-1 flex-col justify-end gap-1 p-1.5">
    <span class="h-1 w-2/3 rounded-full bg-base-content/30"></span>
    <span class="h-1 w-1/2 rounded-full bg-base-content/15"></span>
    <span class="flex items-center gap-0.5">
      <span class="size-1.5 rounded-full bg-secondary"></span>
      <span class="size-1.5 rounded-full bg-accent"></span>
      <span class="size-1.5 rounded-full bg-success"></span>
      <span class="size-1.5 rounded-full bg-error"></span>
      <span class="ms-auto h-1.5 w-2/5 rounded-full bg-primary"></span>
    </span>
  </span>
</span>
