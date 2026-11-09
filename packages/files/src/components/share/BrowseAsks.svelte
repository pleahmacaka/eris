<script lang="ts">
  import { t } from "svelte-i18n"
  import { answerBrowse } from "./share"
  import { share } from "./share.svelte"
</script>

{#each share.state.browseAsks as ask (ask.id)}
  <div class="flex flex-col gap-2 rounded-box border border-primary/30 bg-primary/5 p-3">
    <span class="text-sm">{$t("devices.browseRequest", { values: { name: ask.name } })}</span>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="btn btn-xs btn-primary"
        onclick={() => answerBrowse(ask.id, "once").catch(() => undefined)}
      >
        {$t("devices.allowOnce")}
      </button>
      <button
        type="button"
        class="btn btn-xs btn-soft"
        onclick={() => answerBrowse(ask.id, "always").catch(() => undefined)}
      >
        {$t("devices.allowAlways")}
      </button>
      <button
        type="button"
        class="btn btn-xs btn-ghost"
        onclick={() => answerBrowse(ask.id, "deny").catch(() => undefined)}
      >
        {$t("devices.deny")}
      </button>
    </div>
  </div>
{/each}
