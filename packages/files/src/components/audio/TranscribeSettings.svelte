<script lang="ts">
  import { currentLocale } from "@eris/i18n"
  import { Row, Section, toast } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { clearKey, type KeyStatus, keyStatus, type Provider, saveKey } from "./audio"
  import {
    LANGUAGES,
    MODELS,
    transcribeSettings,
  } from "./transcribe.svelte"

  const PROVIDERS: Provider[] = ["groq", "openai", "custom"]

  let status = $state<KeyStatus>({ saved: false, base: null })
  let key = $state("")
  let base = $state("")
  let busy = $state(false)

  const languageName = (code: string) =>
    code
      ? (new Intl.DisplayNames([currentLocale()], { type: "language" }).of(code) ??
        code)
      : $t("audio.settings.auto")

  $effect(() => {
    const provider = transcribeSettings.provider

    key = ""
    keyStatus(provider)
      .then(next => {
        status = next
        base = next.base ?? ""
      })
      .catch(() => undefined)
  })

  const pickProvider = (provider: Provider) => {
    transcribeSettings.provider = provider
    transcribeSettings.model = MODELS[provider][0] ?? ""
  }

  const store = async () => {
    busy = true

    try {
      status = await saveKey(
        transcribeSettings.provider,
        key,
        transcribeSettings.provider === "custom" ? base : null,
      )
      key = ""
    } catch (reason) {
      toast(
        String(reason) === "badUrl"
          ? $t("audio.settings.badUrl")
          : $t("audio.settings.saveFailed"),
        "error",
      )
    } finally {
      busy = false
    }
  }

  const forget = async () => {
    await clearKey(transcribeSettings.provider).catch(() => undefined)
    status = { saved: false, base: null }
  }
</script>

<Section title={$t("audio.settings.title")}>
  <Row label={$t("audio.settings.provider")}>
    <select
      class="select select-sm w-40"
      aria-label={$t("audio.settings.provider")}
      value={transcribeSettings.provider}
      onchange={e => pickProvider(e.currentTarget.value as Provider)}
    >
      {#each PROVIDERS as provider (provider)}
        <option value={provider}>{$t(`audio.providers.${provider}`)}</option>
      {/each}
    </select>
  </Row>

  {#if transcribeSettings.provider === "custom"}
    <Row label={$t("audio.settings.baseUrl")} hint={$t("audio.settings.baseUrlHint")} stacked>
      <input
        class="input input-sm w-full"
        type="url"
        placeholder="https://"
        aria-label={$t("audio.settings.baseUrl")}
        bind:value={base}
      />
    </Row>
  {/if}

  <Row label={$t("audio.settings.model")}>
    {#if MODELS[transcribeSettings.provider].length}
      <select
        class="select select-sm w-52"
        aria-label={$t("audio.settings.model")}
        bind:value={transcribeSettings.model}
      >
        {#each MODELS[transcribeSettings.provider] as model (model)}
          <option value={model}>{model}</option>
        {/each}
      </select>
    {:else}
      <input
        class="input input-sm w-52"
        aria-label={$t("audio.settings.model")}
        bind:value={transcribeSettings.model}
      />
    {/if}
  </Row>

  <Row label={$t("audio.settings.language")}>
    <select
      class="select select-sm w-40"
      aria-label={$t("audio.settings.language")}
      bind:value={transcribeSettings.language}
    >
      {#each LANGUAGES as code (code)}
        <option value={code}>{languageName(code)}</option>
      {/each}
    </select>
  </Row>

  <Row
    label={$t("audio.settings.apiKey")}
    hint={$t("audio.settings.apiKeyHint")}
    value={status.saved ? $t("audio.settings.keySaved") : $t("audio.settings.keyMissing")}
    stacked
  >
    <div class="flex gap-2">
      <input
        class="input input-sm min-w-0 grow"
        type="password"
        autocomplete="off"
        spellcheck="false"
        aria-label={$t("audio.settings.apiKey")}
        bind:value={key}
      />

      <button
        type="button"
        class="btn btn-sm btn-primary"
        disabled={!key.trim() || busy}
        onclick={store}
      >
        {$t("audio.settings.saveKey")}
      </button>

      {#if status.saved}
        <button type="button" class="btn btn-sm btn-ghost" onclick={forget}>
          {$t("audio.settings.clearKey")}
        </button>
      {/if}
    </div>
  </Row>
</Section>
