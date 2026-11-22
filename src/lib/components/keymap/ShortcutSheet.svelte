<script lang="ts">
import KeyCaps from "#lib/components/keymap/KeyCaps.svelte"
import Dialog from "#lib/components/ui/Dialog.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { ACTION_GROUPS } from "#lib/keymap/actions.js"
import { SETTINGS_PATH } from "#lib/routes.js"
import { visit } from "#lib/shell/visit.js"
import { keymapStore } from "#lib/store/keymap.svelte.js"

let { open, onclose }: { open: boolean; onclose: () => void } = $props()

const configure = () => {
  onclose()
  visit(SETTINGS_PATH)
}
</script>

<Dialog {open} title={i18n.t("keymap.sheet.title")} size="medium" {onclose}>
  <div class="gap-8 sm:columns-2">
    {#each ACTION_GROUPS as group (group.label)}
      <section class="mb-4 break-inside-avoid">
        <h3 class="pb-1 font-semibold text-subtle text-xs">{i18n.t(group.label)}</h3>
        <ul>
          {#each group.actions as action (action.id)}
            {@const slot = keymapStore.keymap[action.id]}
            <li
              class="flex min-h-8 items-center justify-between gap-4 border-base-content/10 border-t"
            >
              <span class="min-w-0 text-sm">{i18n.t(action.label)}</span>
              {#if slot.key !== null && slot.enabled}
                <KeyCaps binding={slot.key} />
              {:else}
                <span class="whitespace-nowrap text-base-content/40 text-xs">
                  {i18n.t(slot.enabled ? "keymap.unassigned" : "keymap.disabled")}
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={configure}>{i18n.t("keymap.sheet.configure")}</button>
    <button type="button" class="btn btn-primary" onclick={onclose}>{i18n.t("ui.close")}</button>
  {/snippet}
</Dialog>
