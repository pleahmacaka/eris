<script lang="ts">
  import Icon from "@iconify/svelte"
  import { page } from "$app/state"
  import { isActive, primaryNav } from "./nav"
</script>

<nav
  class={[
    "pad-bottom shrink-0 border-t border-base-300/60",
    "bg-base-100/90 backdrop-blur lg:hidden",
  ]}
>
  <div class="flex h-16 items-center justify-around px-2">
    {#each primaryNav as item (item.href)}
      {@const active = isActive(page.url.pathname, item.href)}
      <a
        href={item.href}
        class={[
          "flex h-full flex-1 flex-col items-center justify-center gap-1",
          "rounded-field transition-colors",
          active ? "text-primary" : "text-base-content/45",
        ]}
      >
        <Icon icon={item.icon} class="size-5" />
        <span class="text-xs">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>
