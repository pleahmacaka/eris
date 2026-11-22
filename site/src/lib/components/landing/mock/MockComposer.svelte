<script lang="ts">
import Icon from "@iconify/svelte"

let { placeholder }: { placeholder: string } = $props()
</script>

<div class="shrink-0 px-3 pt-1 pb-3 @2xl:px-4">
  <div
    class={[
      "flex items-center gap-1 rounded-box border p-1",
      "border-primary bg-base-200",
    ]}
  >
    <span class="btn btn-circle btn-sm pointer-events-none">
      <Icon icon="lucide:plus" class="size-4" />
    </span>

    <span class="min-w-0 flex-1 truncate px-1 text-base-content/60">
      {placeholder}
    </span>

    <span class="btn btn-primary btn-circle btn-sm pointer-events-none">
      <Icon icon="lucide:send" class="size-4 rtl:-scale-x-100" />
    </span>
  </div>
</div>
