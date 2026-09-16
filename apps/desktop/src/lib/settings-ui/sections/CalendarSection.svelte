<script lang="ts">
  import {
    type DeviceSettings,
    type Profile,
    defaultProfile,
  } from "@eris/settings"
  import { Row, Section, Segmented } from "@eris/ui"
  import { currentLocale } from "@eris/i18n"
  import { regions } from "$lib/panel/holidays"
  import { t } from "svelte-i18n"
  import FeatureGate from "../FeatureGate.svelte"
  import { reset } from "../reset"

  let {
    profile = $bindable(),
    device = $bindable(),
  }: { profile: Profile; device: DeviceSettings } = $props()

  const resetCalendar = reset(() => profile.calendar, defaultProfile.calendar)
  const resetTodo = reset(() => profile.todo, defaultProfile.todo)

  const reminders = [0, 5, 10, 15, 30, 60]

  const regionOptions = $derived.by(() => {
    const names = new Intl.DisplayNames([currentLocale()], { type: "region" })

    return [
      { value: "system", label: $t("settings.options.system") },
      ...regions().map(code => ({
        value: code,
        label: names.of(code) ?? code,
      })),
    ]
  })
</script>

<FeatureGate bind:device feature="calendar" />

<fieldset
  class={[
    "flex flex-col gap-4 transition-opacity duration-100",
    !device.features.calendar && "opacity-40",
  ]}
  disabled={!device.features.calendar}
>
  <Section title={$t("settings.groups.calendar")}>
    <Row
      label={$t("settings.rows.weekStartsOn")}
      onreset={resetCalendar("weekStartsOn")}
    >
      <Segmented
        label={$t("settings.rows.weekStartsOn")}
        bind:value={profile.calendar.weekStartsOn}
        options={[
          { value: 0, label: $t("settings.options.sunday") },
          { value: 1, label: $t("settings.options.monday") },
        ]}
      />
    </Row>

    <Row
      label={$t("settings.rows.holidayRegion")}
      hint={$t("settings.hints.holidayRegion")}
      onreset={resetCalendar("region")}
    >
      <select
        class="select select-sm w-40"
        aria-label={$t("settings.rows.holidayRegion")}
        bind:value={profile.calendar.region}
      >
        {#each regionOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </Row>

    <Row
      label={$t("settings.rows.weekNumbers")}
      hint={$t("settings.hints.weekNumbers")}
      onreset={resetCalendar("showWeekNumbers")}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.weekNumbers")}
        bind:checked={profile.calendar.showWeekNumbers}
      />
    </Row>

    <Row
      label={$t("settings.rows.defaultReminder")}
      hint={$t("settings.hints.defaultReminder")}
      onreset={resetCalendar("reminderMinutes")}
    >
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
    <Row
      label={$t("settings.rows.showCompleted")}
      hint={$t("settings.hints.showCompleted")}
      onreset={resetTodo("showCompleted")}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.showCompleted")}
        bind:checked={profile.todo.showCompleted}
      />
    </Row>

    <Row label={$t("settings.rows.sortBy")} onreset={resetTodo("sortBy")}>
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
</fieldset>
