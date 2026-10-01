<script lang="ts">
  import { getVersion } from "@tauri-apps/api/app"
  import { Logo, Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import Updater from "../Updater.svelte"

  let version = $state("")

  $effect(() => {
    getVersion()
      .then(v => (version = v))
      .catch(() => undefined)
  })
</script>

<Section title="Eris">
  <div data-row={$t("settings.rows.version")} class="flex items-center gap-4 px-4 py-4">
    <Logo class="size-12 shrink-0" />

    <div class="flex flex-col">
      <div class="flex items-center gap-2">
        <span class="text-base font-semibold">Eris</span>

        <span class="badge badge-soft badge-primary badge-sm">
          {version}
        </span>
      </div>

      <span class="text-sm text-base-content/60">
        {$t("settings.about.tagline")}
      </span>
    </div>
  </div>

  <Updater />
</Section>
