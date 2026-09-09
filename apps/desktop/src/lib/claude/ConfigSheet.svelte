<script lang="ts">
  import type { ChatEffort, ChatPermission, ChatTri } from "@eris/settings"
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { type Chat, EFFORTS, MODELS, PERMISSIONS, TRIS } from "./chat.svelte"

  let { chat }: { chat: Chat } = $props()
</script>

<div class="flex min-h-0 grow flex-col gap-3 overflow-y-auto px-4 pb-3 text-sm">
  <div class="flex items-center justify-between">
    <p class="font-medium">{$t("chat.config.title")}</p>

    <button
      type="button"
      class="btn btn-ghost btn-xs"
      onclick={() => (chat.configOpen = false)}
    >
      <Icon icon="lucide:arrow-left" class="size-3.5" />

      {$t("common.back")}
    </button>
  </div>

  <label class="flex flex-col gap-1">
    <span class="text-xs text-base-content/60">{$t("chat.config.model")}</span>

    <input
      class="input input-sm w-full"
      list="chat-models"
      placeholder={$t("chat.config.modelDefault")}
      value={chat.device.chatModel}
      onchange={e => chat.setModel((e.currentTarget as HTMLInputElement).value)}
    />

    <datalist id="chat-models">
      {#each MODELS as model (model)}
        <option value={model}></option>
      {/each}
    </datalist>
  </label>

  <label class="flex items-center justify-between gap-3">
    <span>{$t("chat.config.effort")}</span>

    <select
      class="select select-sm w-36"
      value={chat.device.chatEffort}
      onchange={e => chat.update({ chatEffort: (e.currentTarget as HTMLSelectElement).value as ChatEffort })}
    >
      {#each EFFORTS as effort (effort)}
        <option value={effort}>{$t(`chat.effort.${effort || "default"}`)}</option>
      {/each}
    </select>
  </label>

  <label class="flex items-center justify-between gap-3">
    <span>{$t("chat.config.permission")}</span>

    <select
      class="select select-sm w-36"
      value={chat.device.chatPermission}
      onchange={e => chat.setPermission((e.currentTarget as HTMLSelectElement).value as ChatPermission)}
    >
      {#each PERMISSIONS as mode (mode)}
        <option value={mode}>{$t(`chat.permission.${mode}`)}</option>
      {/each}
    </select>
  </label>

  <label class="flex items-center justify-between gap-3">
    <span>{$t("chat.config.thinking")}</span>

    <select
      class="select select-sm w-36"
      value={chat.device.chatThinking}
      onchange={e => chat.update({ chatThinking: (e.currentTarget as HTMLSelectElement).value as ChatTri })}
    >
      {#each TRIS as tri (tri)}
        <option value={tri}>{$t(`chat.tri.${tri}`)}</option>
      {/each}
    </select>
  </label>

  <label class="flex items-center justify-between gap-3">
    <span>{$t("chat.config.autoCompact")}</span>

    <select
      class="select select-sm w-36"
      value={chat.device.chatAutoCompact}
      onchange={e => chat.update({ chatAutoCompact: (e.currentTarget as HTMLSelectElement).value as ChatTri })}
    >
      {#each TRIS as tri (tri)}
        <option value={tri}>{$t(`chat.tri.${tri}`)}</option>
      {/each}
    </select>
  </label>

  <label class="flex items-center justify-between gap-3">
    <span>{$t("chat.config.language")}</span>

    <input
      class="input input-sm w-36"
      placeholder={$t("chat.config.languageDefault")}
      value={chat.device.chatLanguage}
      onchange={e => chat.update({ chatLanguage: (e.currentTarget as HTMLInputElement).value.trim() })}
    />
  </label>

  <label class="flex items-center justify-between gap-3">
    <span>{$t("chat.config.budget")}</span>

    <input
      type="number"
      min="0"
      step="0.5"
      class="input input-sm w-36"
      placeholder={$t("chat.config.budgetNone")}
      value={chat.device.chatBudget || ""}
      onchange={e => chat.update({ chatBudget: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0) })}
    />
  </label>

  <label class="flex flex-col gap-1">
    <span class="text-xs text-base-content/60">{$t("chat.config.systemPrompt")}</span>

    <textarea
      class="textarea textarea-sm w-full"
      rows="3"
      value={chat.device.chatSystemPrompt}
      onchange={e => chat.update({ chatSystemPrompt: (e.currentTarget as HTMLTextAreaElement).value })}
    ></textarea>
  </label>

  {#if chat.stale}
    <div class="flex items-center justify-between gap-3 rounded-field bg-warning/10 px-3 py-2 text-xs">
      <span>{$t("chat.config.restartHint")}</span>

      <button type="button" class="btn btn-warning btn-xs" onclick={() => chat.restart()}>
        {$t("chat.config.restart")}
      </button>
    </div>
  {/if}
</div>
