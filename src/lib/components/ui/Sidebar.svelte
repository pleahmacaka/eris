<script lang="ts">
  import Icon from "@iconify/svelte"
  import { page } from "$app/state"
  import { isActive, primaryNav, settingsNav } from "./nav"

  const items = [...primaryNav, settingsNav]
</script>

<aside
  class={[
    "hidden w-60 shrink-0 flex-col border-r border-base-content/10",
    "bg-base-100 lg:flex",
  ]}
>
  <div
    class="flex items-center gap-3 border-b border-base-content/10 px-5 py-4"
  >
    <Icon icon="lucide:notebook-pen" class="size-5 text-primary" />
    <span class="font-black tracking-tighter">Note</span>
  </div>

  <nav class="flex flex-1 flex-col gap-0.5 p-3">
    {#each items as item (item.href)}
      {@const active = isActive(page.url.pathname, item.href)}
      <a
        href={item.href}
        class={[
          "relative flex items-center gap-3 px-3 py-2 text-sm transition",
          active
            ? "bg-base-content/5 text-base-content"
            : "text-base-content/60 hover:bg-base-content/3 hover:text-base-content",
          item === settingsNav && "mt-auto",
        ]}
      >
        {#if active}
          <span class="absolute inset-y-1 left-0 w-0.5 bg-primary"></span>
        {/if}

        <Icon
          icon={item.icon}
          class={["size-4", active && "text-primary"]}
        />
        {item.label}
      </a>
    {/each}
  </nav>
</aside>
