<script lang="ts">
  import Icon from "@iconify/svelte"
  import { page } from "$app/state"
  import { isActive, primaryNav } from "./nav"
</script>

<nav
  class={[
    "pad-bottom shrink-0 border-t border-base-content/10",
    "bg-base-100/90 backdrop-blur lg:hidden",
  ]}
>
  <div class="flex h-16 items-stretch">
    {#each primaryNav as item (item.href)}
      {@const active = isActive(page.url.pathname, item.href)}
      <a
        href={item.href}
        class={[
          "relative flex flex-1 flex-col items-center justify-center gap-1",
          "transition-colors",
          active
            ? "text-base-content"
            : "text-base-content/45 active:bg-base-content/5",
        ]}
      >
        {#if active}
          <span class="absolute inset-x-6 top-0 h-0.5 bg-primary"></span>
        {/if}

        <Icon
          icon={item.icon}
          class={["size-5", active && "text-primary"]}
        />
        <span class="text-xs">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>
