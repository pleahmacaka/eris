<script lang="ts">
  import {
    type DeviceSettings,
    type Profile,
    defaultDevice,
    defaultProfile,
  } from "@eris/settings"
  import { Row, Section, Segmented } from "@eris/ui"
  import { currentLocale } from "@eris/i18n"
  import { loadHolidays, regions } from "$lib/calendar"
  import { t } from "svelte-i18n"
  import FeatureGate from "../FeatureGate.svelte"
  import { reset } from "../reset"

  let {
    profile = $bindable(),
    device = $bindable(),
  }: { profile: Profile; device: DeviceSettings } = $props()

  const resetCalendar = reset(() => profile.calendar, defaultProfile.calendar)

  const resetDevice = reset(() => device, defaultDevice)

  const reminders = [0, 5, 10, 15, 30, 60]

  let regionsReady = $state(false)

  $effect(() => {
    loadHolidays().then(() => (regionsReady = true))
  })

  const regionOptions = $derived.by(() => {
    const names = new Intl.DisplayNames([currentLocale()], { type: "region" })

    return [
      { value: "system", label: $t("settings.options.system") },
      ...(regionsReady ? regions() : []).map(code => ({
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
      label={$t("settings.rows.panelStart")}
      hint={$t("settings.hints.panelStart")}
      onreset={resetDevice("panelStart")}
    >
      <Segmented
        label={$t("settings.rows.panelStart")}
        bind:value={device.panelStart}
        options={[
          { value: "compact", label: $t("panel.collapse") },
          { value: "full", label: $t("panel.expand") },
        ]}
      />
    </Row>

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
</fieldset>
