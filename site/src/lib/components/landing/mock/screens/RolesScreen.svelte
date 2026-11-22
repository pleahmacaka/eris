<script lang="ts">
import Icon from "@iconify/svelte"
import type { MockRoleId } from "#lib/landing/mock.js"
import type { MockCopy } from "#lib/server/mock.js"
import MockDialog from "../MockDialog.svelte"
import ChatScreen from "./ChatScreen.svelte"

let { t }: { t: MockCopy } = $props()

const SELECTED: MockRoleId = "moderator"

const ROLE_TONE: Record<MockRoleId, { dot: string; text: string }> = {
  admin: { dot: "bg-error", text: "text-error" },
  moderator: { dot: "bg-info", text: "text-info" },
  member: { dot: "bg-success", text: "text-success" },
}

const TAB = "min-w-0 truncate rounded-selector px-2.5 py-1"

const ACTION = "btn btn-sm pointer-events-none"

const selected = $derived(t.settings.roles.find(role => role.id === SELECTED))
</script>

<ChatScreen {t} />

<MockDialog title={t.settings.title} close={t.close} class="max-w-xl">
  <div class="hidden shrink-0 gap-1 rounded-field bg-base-200 p-1 text-xs @lg:flex">
    <span class={[TAB, "text-base-content/70"]}>{t.settings.tabs.overview}</span>
    <span class={[TAB, "shrink-0 bg-base-100 font-medium shadow-sm"]}>
      {t.settings.tabs.roles}
    </span>
    <span class={[TAB, "text-base-content/70"]}>{t.settings.tabs.members}</span>
  </div>

  <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden @xl:flex-row">
    <ul class="hidden w-40 shrink-0 flex-col gap-0.5 @xl:flex">
      {#each t.settings.roles as role (role.id)}
        <li
          class={[
            "flex items-center gap-2 rounded-field px-2 py-1.5",
            role.id === SELECTED && "bg-base-content/10",
          ]}
        >
          <span class={["size-2.5 shrink-0 rounded-full", ROLE_TONE[role.id].dot]}>
          </span>
          <span
            class={["min-w-0 flex-1 truncate font-medium", ROLE_TONE[role.id].text]}
          >
            {role.name}
          </span>
          <span class="text-2xs text-base-content/60 tabular-nums">
            {role.members}
          </span>
        </li>
      {/each}
    </ul>

    {#if selected}
      <span
        class={[
          "flex h-8 shrink-0 items-center gap-2 rounded-field border px-2.5",
          "border-base-content/25 bg-base-200 @xl:hidden",
        ]}
      >
        <span class={["size-2.5 shrink-0 rounded-full", ROLE_TONE[SELECTED].dot]}>
        </span>
        <span
          class={["min-w-0 flex-1 truncate font-medium", ROLE_TONE[SELECTED].text]}
        >
          {selected.name}
        </span>
        <Icon icon="lucide:chevron-down" class="size-4 shrink-0 text-base-content/70" />
      </span>
    {/if}

    <ul inert class="flex min-w-0 flex-1 flex-col">
      {#each t.settings.permissions as permission (permission.id)}
        <li
          class={[
            "flex items-center gap-3 border-b py-1 last:border-b-0 @xl:py-1.5",
            "border-base-content/10",
          ]}
        >
          <span class="min-w-0 flex-1 truncate text-xs @xl:text-sm">
            {permission.label}
          </span>
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            checked={permission.allowed}
            tabindex="-1"
          />
        </li>
      {/each}
    </ul>
  </div>

  <div class="flex shrink-0 justify-end gap-2">
    <span class={[ACTION, "btn-ghost"]}>{t.settings.revert}</span>
    <span class={[ACTION, "btn-primary"]}>{t.settings.save}</span>
  </div>
</MockDialog>
