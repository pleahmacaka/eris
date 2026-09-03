<script lang="ts">
  import Icon from "@iconify/svelte"
  import { page } from "$app/state"
  import { isActive, primaryNav, settingsNav } from "./nav"

  const items = [...primaryNav, settingsNav]
</script>

<aside
  class={[
    "hidden w-56 shrink-0 flex-col gap-1 border-r border-base-300/60",
    "bg-base-200/40 px-3 py-4 lg:flex",
  ]}
>
  <div class="flex items-center gap-2 px-2 pb-4">
    <span
      class={[
        "flex size-8 items-center justify-center",
        "rounded-field bg-primary/15 text-primary",
      ]}
    >
      <Icon icon="lucide:notebook-pen" class="size-4" />
    </span>
    <span class="text-base font-semibold tracking-tight">Note</span>
  </div>

  {#each items as item (item.href)}
    {@const active = isActive(page.url.pathname, item.href)}
    <a
      href={item.href}
      class={[
        "flex items-center gap-3 rounded-field px-3 py-2 text-sm",
        "transition-colors",
        active
          ? "bg-primary/15 font-medium text-primary"
          : "text-base-content/65 hover:bg-base-300/50",
        item === settingsNav && "mt-auto",
      ]}
    >
      <Icon icon={item.icon} class="size-4.5" />
      {item.label}
    </a>
  {/each}
</aside>
