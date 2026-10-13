<script lang="ts">
  import { t } from "svelte-i18n"
  import { prefs } from "../../store/prefs.svelte"
  import { cleanupBadge } from "./decor"

  let { hours }: { hours: number } = $props()
</script>

<span
  class={[
    "shrink-0 rounded-field px-1.5 text-xs font-medium tabular-nums",
    cleanupBadge(prefs.cleanupColor),
  ]}
>
  {hours > 0
    ? $t("explorer.decor.deleteIn", { values: { hours } })
    : $t("explorer.decor.due")}
</span>
