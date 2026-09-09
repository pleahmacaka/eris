<script lang="ts">
  import { currentLocale } from "@eris/i18n"
  import type { ChatEffort, ChatPermission } from "@eris/settings"
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import * as native from "$lib/native"
  import { type Chat, EFFORTS, MODELS, PERMISSIONS } from "./chat.svelte"

  const MENTION_DELAY = 150

  let { chat }: { chat: Chat } = $props()

  const compose = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === "Tab") && chat.commands.length > 0 && chat.slashTerm !== null) {
      e.preventDefault()
      chat.completeCommand(chat.commands[0].name)

      return
    }

    if (e.key === "Tab" && chat.mentions.length > 0) {
      e.preventDefault()
      chat.completeMention(chat.mentions[0])

      return
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      chat.send()
    }
  }

  $effect(() => {
    if (chat.mentionTerm === null) {
      chat.mentions = []

      return
    }

    const term = chat.mentionTerm
    const timer = setTimeout(async () => {
      const root = chat.cwd ?? chat.session?.info.cwd ?? ""

      chat.mentions = root
        ? (await native.searchDir(root, term).catch(() => [])).slice(0, 8)
        : []
    }, MENTION_DELAY)

    return () => clearTimeout(timer)
  })
</script>

<div class={["relative shrink-0 p-3", (chat.historyOpen || chat.configOpen) && "hidden"]}>
  {#if chat.commands.length > 0 || chat.mentions.length > 0}
    <ul
      class="absolute inset-x-3 bottom-full mb-1 max-h-56 overflow-y-auto rounded-box border border-base-content/10 bg-base-100/95 p-1 text-sm shadow-xl"
    >
      {#each chat.commands as command (command.name)}
        <li>
          <button
            type="button"
            class="flex w-full items-baseline gap-2 rounded-field px-2 py-1 text-left hover:bg-base-content/10"
            onclick={() => chat.completeCommand(command.name)}
          >
            <span class="shrink-0">/{command.name}</span>

            <span class="truncate text-xs text-base-content/50">{command.description}</span>
          </button>
        </li>
      {/each}

      {#each chat.mentions as entry (entry.path)}
        <li>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-field px-2 py-1 text-left hover:bg-base-content/10"
            title={entry.path}
            onclick={() => chat.completeMention(entry)}
          >
            <Icon icon={entry.directory ? "lucide:folder" : "lucide:file"} class="size-3.5 shrink-0 text-base-content/60" />

            <span class="truncate">{chat.relative(entry.path)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if chat.session && chat.session.queue.length > 0}
    <ul class="mb-1.5 flex flex-col gap-1">
      {#each chat.session.queue as item (item.id)}
        <li
          class="flex items-center gap-1 rounded-field border border-base-content/10 bg-base-100/70 py-0.5 pr-0.5 pl-3 text-xs"
        >
          <Icon icon="lucide:clock" class="size-3.5 shrink-0 text-base-content/50" />

          <span class="grow truncate" title={item.text}>{item.text}</span>

          <button
            type="button"
            class="btn btn-ghost btn-xs font-normal"
            disabled={item.handed}
            title={$t("chat.queue.toggle")}
            onclick={() => chat.session?.setQueueMode(item.id, item.mode === "afterTool" ? "afterReply" : "afterTool")}
          >
            {$t(`chat.queue.${item.mode}`)}
          </button>

          {#if !item.handed}
            <button
              type="button"
              class="btn btn-circle btn-ghost btn-xs"
              aria-label={$t("common.cancel")}
              onclick={() => chat.session?.cancelQueued(item.id)}
            >
              <Icon icon="lucide:x" class="size-3" />
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div
    class="flex items-end gap-2 rounded-box border border-base-content/10 bg-base-100/70 py-1.5 pr-1.5 pl-4"
  >
    <textarea
      bind:this={chat.input}
      bind:value={chat.draft}
      onkeydown={compose}
      rows="1"
      placeholder={chat.session?.busy ? $t("chat.queuePlaceholder") : $t("chat.placeholder")}
      class="max-h-28 min-h-8 grow resize-none bg-transparent py-1 text-sm outline-none placeholder:text-base-content/35"
    ></textarea>

    {#if chat.session?.busy}
      <button
        type="button"
        class="btn btn-circle btn-ghost btn-sm"
        aria-label={$t("chat.stop")}
        title={$t("chat.stop")}
        onclick={() => chat.session?.interrupt()}
      >
        <Icon icon="lucide:square" class="size-4" />
      </button>
    {/if}

    <div
      class="relative rounded-full p-0.5"
      title={chat.session && chat.session.context > 0
        ? $t("chat.context", {
            values: {
              percent: chat.contextPercent,
              used: chat.session.context.toLocaleString(currentLocale()),
              total: chat.session.contextWindow.toLocaleString(currentLocale()),
            },
          })
        : undefined}
    >
      {#if chat.session && chat.session.context > 0}
        <span
          class="context-ring"
          style:--pct="{chat.contextPercent}%"
          style:--ring={chat.contextPercent >= 80 ? "var(--color-warning)" : "var(--color-primary)"}
          aria-hidden="true"
        ></span>
      {/if}

      <button
        type="button"
        class={["btn btn-circle btn-sm relative", chat.session?.busy ? "btn-soft btn-primary" : "btn-primary"]}
        aria-label={chat.session?.busy ? $t("chat.queueSend") : $t("chat.send")}
        disabled={!chat.draft.trim() || chat.cli === null}
        onclick={() => chat.send()}
      >
        <Icon icon={chat.session?.busy ? "lucide:clock" : "lucide:arrow-up"} class="size-4" />
      </button>
    </div>
  </div>

  <div class="mt-1 flex items-center gap-1 px-1 text-3xs text-base-content/50">
    <select
      class="select select-ghost select-xs h-6 w-auto max-w-24 pr-6 text-2xs"
      aria-label={$t("chat.config.model")}
      title={chat.session?.info.model || $t("chat.config.model")}
      value={MODELS.includes(chat.device.chatModel) || chat.device.chatModel === "" ? chat.device.chatModel : "custom"}
      onchange={e => {
        const value = (e.currentTarget as HTMLSelectElement).value

        if (value === "custom") {
          chat.configOpen = true
        } else {
          chat.setModel(value)
        }
      }}
    >
      <option value="">{$t("chat.config.modelDefault")}</option>

      {#each MODELS as model (model)}
        <option value={model}>{model}</option>
      {/each}

      <option value="custom">{$t("chat.config.modelCustom")}</option>
    </select>

    <select
      class="select select-ghost select-xs h-6 w-auto max-w-24 pr-6 text-2xs"
      aria-label={$t("chat.config.effort")}
      title={$t("chat.config.effort")}
      value={chat.device.chatEffort}
      onchange={e => chat.update({ chatEffort: (e.currentTarget as HTMLSelectElement).value as ChatEffort })}
    >
      {#each EFFORTS as effort (effort)}
        <option value={effort}>{$t(`chat.effort.${effort || "default"}`)}</option>
      {/each}
    </select>

    <select
      class="select select-ghost select-xs h-6 w-auto max-w-24 pr-6 text-2xs"
      aria-label={$t("chat.config.permission")}
      title={$t("chat.config.permission")}
      value={chat.device.chatPermission}
      onchange={e => chat.setPermission((e.currentTarget as HTMLSelectElement).value as ChatPermission)}
    >
      {#each PERMISSIONS as mode (mode)}
        <option value={mode}>{$t(`chat.permission.${mode}`)}</option>
      {/each}
    </select>

    <span class="grow"></span>

    {#if chat.stale}
      <button type="button" class="text-warning" onclick={() => chat.restart()}>
        {$t("chat.config.restart")}
      </button>
    {/if}

    {#if chat.session && chat.session.cost > 0}
      <span class="tabular-nums">${chat.session.cost.toFixed(3)}</span>
    {/if}
  </div>
</div>

<style>
  .context-ring {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: conic-gradient(var(--ring) var(--pct), transparent 0);
    mask: radial-gradient(farthest-side, transparent calc(100% - 0.1875rem), #000 calc(100% - 0.1875rem));
  }
</style>
