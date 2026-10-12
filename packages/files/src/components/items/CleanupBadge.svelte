<script lang="ts">
  import { t } from "svelte-i18n"
  import { prefs } from "../../store/prefs.svelte"
  import { cleanupBadge } from "./decor"

  let { hours, title }: { hours: number; title?: string } = $props()
</script>

<span
  class={[
    "shrink-0 rounded-field px-1.5 text-xs font-medium tabular-nums",
    cleanupBadge(prefs.cleanupColor),
  ]}
  {title}
>
  {hours > 0
    ? $t("explorer.decor.hoursLeft", { values: { hours } })
    : $t("explorer.decor.due")}
</span>
