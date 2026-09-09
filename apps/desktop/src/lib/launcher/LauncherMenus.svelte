<script lang="ts">
  import { saveDevice } from "@eris/settings"
  import { ContextMenu, type MenuItem } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { showWindow } from "$lib/native/windows"
  import type { Launcher } from "./launcher.svelte"

  let { launcher }: { launcher: Launcher } = $props()

  const backdropItems = $derived.by((): MenuItem[] => [
    {
      label: launcher.query ? $t("launcher.backdrop.clearSearch") : $t("launcher.backdrop.focusSearch"),
      icon: launcher.query ? "lucide:eraser" : "lucide:search",
      action: () => {
        launcher.setQuery("")
        launcher.input?.focus()
      },
    },
    {
      label: launcher.device.showKeymap ? $t("launcher.backdrop.hideKeymap") : $t("launcher.backdrop.showKeymap"),
      icon: launcher.device.showKeymap ? "lucide:eye-off" : "lucide:eye",
      action: () => saveDevice({ ...launcher.device, showKeymap: !launcher.device.showKeymap }),
    },
    "separator",
    {
      label: $t("launcher.backdrop.settings"),
      icon: "lucide:settings",
      action: () => showWindow("settings"),
    },
  ])
</script>

<ContextMenu
  bind:open={launcher.backdropMenu}
  items={backdropItems}
  x={launcher.backdropMenuX}
  y={launcher.backdropMenuY}
  placement="down"
  width={224}
  label={$t("launcher.menuAria")}
/>

{#if launcher.menu}
  <ul
    data-menu
    class="menu absolute z-50 rounded-box border border-base-content/10 bg-base-100/80 p-1 shadow-xl backdrop-blur-xl"
    style={launcher.menuStyle}
  >
    {#each launcher.menuItems as action, k (action.label)}
      <li>
        <button
          type="button"
          class={["rounded-field", k === launcher.menuCursor && "menu-active"]}
          tabindex="-1"
          onmousemove={() => (launcher.menuCursor = k)}
          onclick={() => launcher.runMenu(action)}
        >
          {action.label}
        </button>
      </li>
    {/each}
  </ul>
{/if}
