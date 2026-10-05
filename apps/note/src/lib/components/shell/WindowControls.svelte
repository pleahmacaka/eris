<script lang="ts">
  import Icon from "@iconify/svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"

  const win = getCurrentWindow()

  const buttons = [
    { label: "최소화", icon: "lucide:minus", run: () => win.minimize(), close: false },
    { label: "최대화", icon: "lucide:square", run: () => win.toggleMaximize(), close: false },
    { label: "닫기", icon: "lucide:x", run: () => win.close(), close: true },
  ]
</script>

<div class="flex self-stretch">
  {#each buttons as button (button.icon)}
    <button
      aria-label={button.label}
      title={button.label}
      onclick={button.run}
      class={[
        "grid w-11 cursor-pointer place-items-center text-base-content/70",
        "transition-colors",
        button.close
          ? "hover:bg-error hover:text-error-content"
          : "hover:bg-base-content/10 hover:text-base-content",
      ]}
    >
      <Icon
        icon={button.icon}
        class={button.icon === "lucide:square" ? "size-3" : "size-4"}
      />
    </button>
  {/each}
</div>
