<script lang="ts">
  import type { Profile } from "@eris/settings"
  import { Row, Section } from "@eris/ui"
  import { t } from "svelte-i18n"

  let { profile = $bindable() }: { profile: Profile } = $props()
</script>

<Section title={$t("settings.groups.results")}>
  <Row
    label={$t("settings.rows.resultsPerGroup")}
    value={String(profile.launcher.maxResults)}
    stacked
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min="3"
      max="15"
      step="1"
      aria-label={$t("settings.rows.resultsPerGroup")}
      bind:value={profile.launcher.maxResults}
    />
  </Row>

  <Row label={$t("settings.rows.openWindows")} hint={$t("settings.hints.openWindows")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.openWindows")}
      bind:checked={profile.launcher.showWindows}
    />
  </Row>

  <Row label={$t("settings.rows.commands")} hint={$t("settings.hints.commands")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.commands")}
      bind:checked={profile.launcher.showCommands}
    />
  </Row>

  <Row label={$t("settings.rows.todos")} hint={$t("settings.hints.todos")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.todos")}
      bind:checked={profile.launcher.showTodos}
    />
  </Row>

  <Row label={$t("settings.rows.calculator")} hint={$t("settings.hints.calculator")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.calculator")}
      bind:checked={profile.launcher.calculator}
    />
  </Row>

  <Row label={$t("settings.rows.webSearch")} hint={$t("settings.hints.webSearch")}>
    <select
      class="select select-sm w-40"
      aria-label={$t("settings.rows.webSearch")}
      bind:value={profile.launcher.webSearch}
    >
      <option value="google">Google</option>
      <option value="duckduckgo">DuckDuckGo</option>
      <option value="bing">Bing</option>
      <option value="naver">Naver</option>
    </select>
  </Row>
</Section>
