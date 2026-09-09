<script lang="ts">
  import type { Profile } from "@eris/settings"
  import { Row, Section, Segmented } from "@eris/ui"
  import { t } from "svelte-i18n"

  let { profile = $bindable() }: { profile: Profile } = $props()

  const reminders = [0, 5, 10, 15, 30, 60]
</script>

<Section title={$t("settings.groups.calendar")}>
  <Row label={$t("settings.rows.weekStartsOn")}>
    <Segmented
      label={$t("settings.rows.weekStartsOn")}
      bind:value={profile.calendar.weekStartsOn}
      options={[
        { value: 1, label: $t("settings.options.monday") },
        { value: 0, label: $t("settings.options.sunday") },
      ]}
    />
  </Row>

  <Row label={$t("settings.rows.weekNumbers")} hint={$t("settings.hints.weekNumbers")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.weekNumbers")}
      bind:checked={profile.calendar.showWeekNumbers}
    />
  </Row>

  <Row label={$t("settings.rows.defaultReminder")} hint={$t("settings.hints.defaultReminder")}>
    <select
      class="select select-sm w-40"
      aria-label={$t("settings.rows.defaultReminder")}
      bind:value={profile.calendar.reminderMinutes}
    >
      {#each reminders as minutes (minutes)}
        <option value={minutes}>
          {minutes === 0
            ? $t("common.none")
            : $t("settings.options.minBefore", { values: { minutes } })}
        </option>
      {/each}
    </select>
  </Row>
</Section>

<Section title={$t("settings.groups.todo")}>
  <Row label={$t("settings.rows.showCompleted")} hint={$t("settings.hints.showCompleted")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.showCompleted")}
      bind:checked={profile.todo.showCompleted}
    />
  </Row>

  <Row label={$t("settings.rows.sortBy")}>
    <Segmented
      label={$t("settings.rows.sortBy")}
      bind:value={profile.todo.sortBy}
      options={[
        { value: "manual", label: $t("settings.options.manual") },
        { value: "due", label: $t("settings.options.due") },
        { value: "priority", label: $t("settings.options.priority") },
      ]}
    />
  </Row>
</Section>
