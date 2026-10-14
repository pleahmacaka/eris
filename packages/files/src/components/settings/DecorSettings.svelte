<script lang="ts">
  import { Row, Section, Segmented } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { CLEANUP_HOURS, enableCleanup } from "../../store/cleanup.svelte"
  import { prefs } from "../../store/prefs.svelte"
  import type { GitHead } from "../../native"
  import CleanupBadge from "../items/CleanupBadge.svelte"
  import { CLEANUP_COLORS } from "../items/decor"
  import RepoChip from "../items/RepoChip.svelte"
  import GitHostSettings from "./GitHostSettings.svelte"
  import OrderList from "./OrderList.svelte"

  type Toggle = "duplicates" | "gitColors" | "emptyFolders"

  const SAMPLE: GitHead = {
    branch: "main",
    remotes: [
      { name: "origin", url: "https://github.com/octocat/hello-world" },
      { name: "upstream", url: "https://github.com/github/hello-world" },
    ],
  }

  const PART_ICONS = {
    logo: "simple-icons:github",
    host: "lucide:globe",
    repo: "lucide:book-marked",
    branch: "lucide:git-branch",
    fork: "lucide:git-fork",
  }
</script>

{#snippet switchRow(key: Toggle)}
  <Row
    label={$t(`explorer.settings.decor.${key}`)}
    hint={$t(`explorer.settings.decor.${key}Hint`)}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t(`explorer.settings.decor.${key}`)}
      bind:checked={prefs[key]}
    />
  </Row>
{/snippet}

<Section title={$t("explorer.settings.decor.title")}>
  <Row label={$t("explorer.settings.decor.iconStyle")}>
    <Segmented
      bind:value={prefs.iconStyle}
      label={$t("explorer.settings.decor.iconStyle")}
      options={[
        { value: "system", label: $t("explorer.settings.decor.iconSystem"), icon: "lucide:monitor" },
        { value: "ide", label: $t("explorer.settings.decor.iconIde"), icon: "lucide:code-xml" },
      ]}
    />
  </Row>

  {@render switchRow("duplicates")}
  {@render switchRow("gitColors")}
  {@render switchRow("emptyFolders")}
</Section>

<Section title={$t("explorer.settings.repoChip.title")}>
  <Row
    label={$t("explorer.settings.repoChip.title")}
    hint={$t("explorer.settings.order.hint")}
  >
    <span class="flex" inert>
      <RepoChip kind="repo" head={SAMPLE} />
    </span>
  </Row>

  <OrderList
    bind:arrangement={prefs.repoChip}
    label={$t("explorer.settings.repoChip.title")}
    labelOf={id => $t(`explorer.settings.repoChip.parts.${id}`)}
    iconOf={id => PART_ICONS[id]}
  />
</Section>

<GitHostSettings />

<Section title={$t("explorer.settings.cleanup.title")}>
  <Row
    label={$t("explorer.settings.cleanup.enabled")}
    hint={$t("explorer.settings.cleanup.enabledHint")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("explorer.settings.cleanup.enabled")}
      checked={prefs.cleanup}
      onchange={e => enableCleanup(e.currentTarget.checked)}
    />
  </Row>

  {#if prefs.cleanup}
    <Row label={$t("explorer.settings.cleanup.hours")}>
      <Segmented
        bind:value={prefs.cleanupHours}
        label={$t("explorer.settings.cleanup.hours")}
        options={CLEANUP_HOURS.map(hours => ({
          value: hours,
          label: $t("explorer.settings.cleanup.hoursValue", { values: { hours } }),
        }))}
      />
    </Row>

    <Row label={$t("explorer.settings.cleanup.color")}>
      <div
        role="radiogroup"
        aria-label={$t("explorer.settings.cleanup.color")}
        class="flex items-center gap-2"
      >
        {#each CLEANUP_COLORS as color (color.id)}
          {@const active = prefs.cleanupColor === color.id}
          {@const label = $t(`explorer.settings.cleanup.colors.${color.id}`)}

          <button
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            class={[
              "size-6 cursor-pointer rounded-full",
              color.swatch,
              active ? "ring-2 ring-base-content/60 ring-offset-2 ring-offset-base-100" : "opacity-70 hover:opacity-100",
            ]}
            onclick={() => (prefs.cleanupColor = color.id)}
          ></button>
        {/each}

        <span class="ml-2 flex">
          <CleanupBadge hours={prefs.cleanupHours} />
        </span>
      </div>
    </Row>
  {/if}
</Section>
