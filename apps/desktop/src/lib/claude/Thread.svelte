<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { Bubble } from "./bubbles.svelte"
  import type { Chat } from "./chat.svelte"
  import { claudeIcon } from "./icon"
  import Markdown from "./Markdown.svelte"
  import { summary, when } from "./text"

  let { chat, current }: { chat: Chat; current: Bubble } = $props()

  let thread = $state<HTMLElement>()

  $effect(() => {
    void chat.session?.turns.length
    void chat.session?.turns.at(-1)?.blocks.length

    if (thread) {
      thread.scrollTop = thread.scrollHeight
    }
  })
</script>

<div
  bind:this={thread}
  class="flex min-h-0 grow flex-col gap-2 overflow-y-auto px-4 py-2"
>
  {#if chat.cli === null}
    <div class="m-auto flex flex-col items-center gap-2 text-center text-sm">
      <Icon icon="lucide:terminal" class="size-7 text-base-content/50" />

      <p>{$t("chat.cliMissing")}</p>

      <code class="rounded-field bg-base-content/10 px-2 py-1 text-xs"
        >npm install -g @anthropic-ai/claude-code</code
      >
    </div>
  {:else if !chat.session || chat.session.turns.length === 0}
    <div class="m-auto flex flex-col items-center gap-3 text-center">
      <Icon icon={claudeIcon} class="size-8 text-primary/70" />

      <p class="text-sm text-base-content/50">
        {current.folder ? $t("chat.empty.code") : $t("chat.empty.ask")}
      </p>

      <p class="text-xs text-base-content/40">
        {current.folder ? $t("chat.empty.codeHint") : $t("chat.empty.askHint")}
      </p>
    </div>
  {:else}
    {#each chat.session.turns as turn (turn.id)}
      {#if turn.role === "user"}
        <div
          class="max-w-5/6 self-end rounded-box rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-primary-content"
        >
          {turn.blocks[0]?.kind === "text" ? turn.blocks[0].text : ""}
        </div>
      {:else}
        {#each turn.blocks as block, index (index)}
          {#if block.kind === "usage"}
            <div
              class="flex w-64 max-w-11/12 flex-col gap-2 self-start rounded-box border border-base-content/10 bg-base-100/60 p-3 text-xs"
            >
              {#each [[$t("chat.usage.fiveHour"), block.usage.fiveHour], [$t("chat.usage.sevenDay"), block.usage.sevenDay]] as const as [name, window] (name)}
                {#if window}
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-base-content/70">{name}</span>

                      <span class="tabular-nums">{Math.round(window.used)}%</span>
                    </div>

                    <progress
                      class="progress progress-primary mt-1 w-full"
                      value={Math.round(window.used)}
                      max="100"
                    ></progress>

                    {#if window.resetsAt}
                      <p class="mt-0.5 text-base-content/50">
                        {$t("chat.usage.resets", { values: { time: when(new Date(window.resetsAt).getTime() / 1000) } })}
                      </p>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          {:else if block.kind === "text" && block.text.trim()}
            <div
              class="max-w-11/12 self-start rounded-box rounded-bl-md bg-base-content/10 px-4 py-2.5 text-sm leading-relaxed"
            >
              <Markdown text={block.text} />
            </div>
          {:else if block.kind === "tool"}
            <details
              class="max-w-11/12 self-start rounded-field border border-base-content/10 bg-base-100/60 text-xs"
            >
              <summary
                class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-base-content/70"
              >
                <Icon
                  icon={block.error ? "lucide:circle-x" : block.result === null ? "lucide:loader" : "lucide:wrench"}
                  class={["size-3.5 shrink-0", block.error && "text-error", block.result === null && "animate-spin"]}
                />

                <span class="font-medium">{block.name}</span>

                <span class="truncate text-base-content/50">{summary(block.input)}</span>
              </summary>

              {#if block.result}
                <pre
                  class="max-h-48 overflow-auto border-t border-base-content/10 px-3 py-2 whitespace-pre-wrap">{block.result.slice(0, 4000)}</pre>
              {/if}
            </details>
          {/if}
        {/each}

        {#if turn.streaming && turn.blocks.length === 0}
          <span class="loading loading-dots loading-sm self-start text-base-content/50"></span>
        {/if}
      {/if}
    {/each}
  {/if}

  {#if chat.session?.permission}
    {@const permission = chat.session.permission}

    <div class="self-stretch rounded-box border border-warning/40 bg-warning/10 p-3 text-sm">
      <p class="flex items-center gap-2 font-medium">
        <Icon icon="lucide:shield-alert" class="size-4 text-warning" />

        {permission.tool}
      </p>

      <p class="mt-1 truncate text-xs text-base-content/70" title={summary(permission.input)}>
        {summary(permission.input)}
      </p>

      <div class="mt-2 flex justify-end gap-1">
        <button type="button" class="btn btn-ghost btn-xs" onclick={() => chat.session?.deny()}>
          {$t("chat.deny")}
        </button>

        {#if permission.suggestions}
          <button type="button" class="btn btn-ghost btn-xs" onclick={() => chat.session?.allow(true)}>
            {$t("chat.allowAlways")}
          </button>
        {/if}

        <button type="button" class="btn btn-primary btn-xs" onclick={() => chat.session?.allow(false)}>
          {$t("chat.allow")}
        </button>
      </div>
    </div>
  {/if}

  {#if chat.session?.prompt}
    <div class="flex flex-col gap-3 self-stretch rounded-box border border-primary/30 bg-primary/5 p-3 text-sm">
      {#each chat.session.prompt.questions as question (question.question)}
        <div>
          <p class="text-2xs font-medium tracking-wide text-primary uppercase">{question.header}</p>

          <p class="mt-0.5">{question.question}</p>

          <div class="mt-2 flex flex-col gap-1">
            {#each question.options as option (option.label)}
              {@const on = (chat.picked[question.question] ?? []).includes(option.label)}

              <button
                type="button"
                class={[
                  "rounded-field border px-3 py-1.5 text-left transition-colors duration-150",
                  on
                    ? "border-primary/60 bg-primary/15"
                    : "border-base-content/10 hover:bg-base-content/10",
                ]}
                onclick={() => chat.pick(question, option.label)}
              >
                <span class="block text-sm">{option.label}</span>

                {#if option.description}
                  <span class="block text-xs text-base-content/60">{option.description}</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}

      <button
        type="button"
        class="btn btn-primary btn-sm self-end"
        disabled={chat.session.prompt.questions.some(q => !(chat.picked[q.question] ?? []).length)}
        onclick={() => chat.submitAnswers()}
      >
        {$t("common.submit")}
      </button>
    </div>
  {/if}

  {#if chat.session?.error}
    <p class="self-stretch rounded-field bg-error/10 px-3 py-2 text-xs text-error whitespace-pre-wrap">
      {chat.session.error}
    </p>
  {/if}
</div>
