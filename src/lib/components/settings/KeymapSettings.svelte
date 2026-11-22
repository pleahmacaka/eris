<script lang="ts">
import Icon from "@iconify/svelte"
import KeyCaps from "#lib/components/keymap/KeyCaps.svelte"
import SettingsCard from "#lib/components/settings/SettingsCard.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import {
  ACTION_BY_ID,
  ACTION_GROUPS,
  type ActionId,
} from "#lib/keymap/actions.js"
import { type Binding, bindingOf } from "#lib/keymap/binding.js"
import { conflictOf } from "#lib/keymap/keymap.js"
import { keymapStore } from "#lib/store/keymap.svelte.js"
import { promptStore } from "#lib/store/prompt.svelte.js"

type Clash = { id: ActionId; key: Binding; other: ActionId }

const NATIVE_KEYS = [
  "Tab",
  "Shift+Tab",
  "Enter",
  "Shift+Enter",
  "Space",
  "Shift+Space",
]

let recording = $state<ActionId | null>(null)
let clash = $state.raw<Clash | null>(null)

const record = (id: ActionId) => {
  clash = null
  recording = recording === id ? null : id
}

const stop = (id: ActionId) => {
  if (recording === id) {
    recording = null
  }
}

const assign = (id: ActionId, key: Binding) => {
  const other = conflictOf(keymapStore.keymap, id, key)

  if (other === null) {
    keymapStore.setKey(id, key)
  } else {
    clash = { id, key, other }
  }
}

const capture = (event: KeyboardEvent, id: ActionId) => {
  const key = bindingOf(event, keymapStore.mac)

  if (recording !== id || (key !== null && NATIVE_KEYS.includes(key))) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (key === null) {
    return
  }

  recording = null

  if (key === "Backspace") {
    keymapStore.setKey(id, null)
  } else if (key !== "Escape") {
    assign(id, key)
  }
}

const swap = () => {
  if (clash) {
    keymapStore.swap(clash.id, clash.other)
    clash = null
  }
}

const reset = (id: ActionId) => {
  clash = null
  keymapStore.reset(id)
}

const resetAll = () => {
  promptStore.confirming = {
    title: { key: "keymap.resetAll.title" },
    body: { key: "keymap.resetAll.body" },
    action: { key: "keymap.resetAll.action" },
    run: async () => {
      clash = null
      keymapStore.resetAll()
    },
  }
}
</script>

<SettingsCard title={i18n.t("keymap.title")}>
  <div class="flex items-center justify-between gap-4">
    <p class="text-muted text-sm">{i18n.t("keymap.hint")}</p>
    <button
      type="button"
      class="btn btn-ghost btn-sm shrink-0"
      disabled={!keymapStore.customized}
      onclick={resetAll}
    >
      {i18n.t("keymap.resetAll.button")}
    </button>
  </div>

  {#each ACTION_GROUPS as group (group.label)}
    <div>
      <h3 class="pb-1 font-semibold text-subtle text-xs">{i18n.t(group.label)}</h3>
      <ul>
        {#each group.actions as action (action.id)}
          {@const slot = keymapStore.keymap[action.id]}
          {@const pending = clash?.id === action.id ? clash : null}
          {@const twin = conflictOf(keymapStore.keymap, action.id, slot.key)}
          {@const shown = pending?.key ?? slot.key}
          <li class="flex flex-col gap-2 border-base-content/10 border-t py-2">
            <div class="flex items-center gap-2">
              <span
                class={["min-w-0 flex-1 text-sm", !slot.enabled && "text-base-content/40"]}
              >
                {i18n.t(action.label)}
              </span>
              <button
                type="button"
                class={[
                  "btn btn-sm min-w-20 sm:min-w-28",
                  recording === action.id && "btn-primary",
                  pending && "border-warning",
                ]}
                aria-pressed={recording === action.id}
                onclick={() => record(action.id)}
                onkeydown={event => capture(event, action.id)}
                onblur={() => stop(action.id)}
              >
                <span class="sr-only">{i18n.t("keymap.change", { action: i18n.t(action.label) })}</span>
                {#if recording === action.id}
                  <span class="size-1.5 animate-blink bg-current" aria-hidden="true"></span>
                  {i18n.t("keymap.recording")}
                {:else if shown === null}
                  <span class="text-subtle">{i18n.t("keymap.unassigned")}</span>
                {:else}
                  <KeyCaps binding={shown} />
                {/if}
              </button>
              <button
                type="button"
                class={["btn btn-ghost btn-square btn-sm", !slot.custom && "invisible max-sm:hidden"]}
                aria-label={i18n.t("keymap.resetNamed", { action: i18n.t(action.label) })}
                title={i18n.t("keymap.reset")}
                onclick={() => reset(action.id)}
              >
                <Icon icon="lucide:rotate-ccw" class="size-4" />
              </button>
              <input
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
                aria-label={i18n.t("keymap.enableNamed", { action: i18n.t(action.label) })}
                checked={slot.enabled}
                onchange={event =>
                  keymapStore.setEnabled(action.id, event.currentTarget.checked)}
              />
            </div>

            {#if recording === action.id}
              <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted text-xs">
                <span class="flex items-center gap-1.5">
                  <kbd class="kbd kbd-xs">Esc</kbd>
                  {i18n.t("ui.cancel")}
                </span>
                <span class="flex items-center gap-1.5">
                  <kbd class="kbd kbd-xs">Backspace</kbd>
                  {i18n.t("keymap.clear")}
                </span>
              </p>
            {:else if pending}
              <div class="flex flex-wrap items-center justify-between gap-2" role="alert">
                <p class="text-warning text-xs">
                  {i18n.t("keymap.clash", {
                    action: i18n.t(ACTION_BY_ID[pending.other].label),
                  })}
                </p>
                <div class="flex gap-1">
                  <button type="button" class="btn btn-xs" onclick={swap}>{i18n.t("keymap.swap")}</button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onclick={() => {
                      clash = null
                    }}
                  >
                    {i18n.t("ui.cancel")}
                  </button>
                </div>
              </div>
            {:else if twin}
              <p class="text-warning text-xs" role="alert">
                {i18n.t("keymap.duplicate", { action: i18n.t(ACTION_BY_ID[twin].label) })}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</SettingsCard>
