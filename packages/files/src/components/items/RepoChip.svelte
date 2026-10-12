<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"

  let { kind, title }: { kind: "repo" | "submodule"; title?: string } = $props()
</script>

<span
  class="flex shrink-0 items-center gap-1 rounded-field bg-base-content/8 px-1.5 text-xs text-base-content/60"
  {title}
>
  <Icon icon={kind === "submodule" ? "lucide:git-fork" : "lucide:git-branch"} class="size-3" />
  {$t(`explorer.decor.${kind}`)}
</span>
