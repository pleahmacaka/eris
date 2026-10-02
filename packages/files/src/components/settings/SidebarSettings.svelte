<script lang="ts">
  import { Row, Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { prefs } from "../../store/prefs.svelte"
  import {
    SIDEBAR_SECTIONS,
    sectionShown,
    showPath,
    sidebarLabel,
    toggleSection,
  } from "../../store/sidebar"
</script>

<Section title={$t("explorer.sidebar.title")}>
  {#each SIDEBAR_SECTIONS as id (id)}
    <Row label={$t(`explorer.sidebar.sections.${id}`)}>
      <input
        type="checkbox"
        class="toggle toggle-sm toggle-primary"
        checked={sectionShown(id)}
        onchange={() => toggleSection(id)}
      />
    </Row>
  {/each}

  {#each prefs.sidebar.hiddenPaths as path (path)}
    <Row label={sidebarLabel(path, $t)} hint={$t("explorer.sidebar.hidden")}>
      <button
        type="button"
        class="btn btn-soft btn-sm"
        onclick={() => showPath(path)}
      >
        {$t("explorer.sidebar.show")}
      </button>
    </Row>
  {/each}
</Section>
