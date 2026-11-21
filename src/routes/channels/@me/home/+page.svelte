<script lang="ts">
import Icon from "@iconify/svelte"
import EmptyPane from "#lib/components/chat/EmptyPane.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { HOME_PATH } from "#lib/routes.js"
</script>

<header class="flex h-12 shrink-0 items-center px-3 md:hidden">
  <a href={HOME_PATH} class="btn btn-ghost btn-square btn-sm" aria-label={i18n.t("ui.back")} title={i18n.t("ui.back")}>
    <Icon icon="lucide:arrow-left" class="size-5 rtl:-scale-x-100" />
  </a>
</header>

<EmptyPane
  title={i18n.t("channels.home.emptyTitle")}
  body={i18n.t("channels.home.emptyBody")}
/>
