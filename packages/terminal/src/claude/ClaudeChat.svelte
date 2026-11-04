<script lang="ts">
  import Icon from "@iconify/svelte"
  import { renderMarkdown } from "@eris/markdown"
  import "@eris/markdown/markdown.css"
  import { t } from "svelte-i18n"
  import type { ClaudeCommand } from "../pty"
  import { matchCommands } from "./commands"
  import { appear } from "./motion"
  import type { Screen } from "./screen"
  import type { Part, ToolResults, Turn } from "./transcript"

  type Props = {
    turns: Turn[]
    results: ToolResults
    screen: Screen
    commands: ClaudeCommand[]
    active: boolean
    onsend: (text: string) => void
    onstop: () => void
    onchoose: (key: string) => void
  }

  let {
    turns,
    results,
    screen,
    commands,
    active,
    onsend,
    onstop,
    onchoose,
  }: Props = $props()

  const STICK = 48
  const PENDING_LIMIT_MS = 15_000

  const TOOL_ICONS: Record<string, string> = {
    Bash: "lucide:square-terminal",
    PowerShell: "lucide:square-terminal",
    Read: "lucide:file-text",
    Edit: "lucide:file-pen",
    MultiEdit: "lucide:file-pen",
    Write: "lucide:file-plus",
    NotebookEdit: "lucide:file-pen",
    Grep: "lucide:search",
    Glob: "lucide:folder-search",
    WebFetch: "lucide:globe",
    WebSearch: "lucide:globe",
    Agent: "lucide:bot",
    Task: "lucide:bot",
    TodoWrite: "lucide:list-checks",
  }

  type Tool = Extract<Part, { kind: "tool" }>

  type Block = { kind: "text"; text: string } | { kind: "tools"; tools: Tool[] }

  let scroller = $state<HTMLElement>()
  let field = $state<HTMLTextAreaElement>()
  let draft = $state("")
  let pending = $state<string | null>(null)
  let pick = $state(0)
  let dismissed = $state<string | null>(null)
  let pinned = true

  const matches = $derived(
    dismissed === draft ? [] : matchCommands(commands, draft),
  )

  const blocksOf = (parts: Part[]) =>
    parts.reduce<Block[]>((all, part) => {
      const last = all.at(-1)

      if (part.kind === "text") {
        all.push({ kind: "text", text: part.text })
      } else if (last?.kind === "tools") {
        last.tools.push(part)
      } else {
        all.push({ kind: "tools", tools: [part] })
      }

      return all
    }, [])

  const userText = (parts: Part[]) =>
    parts
      .map(part => (part.kind === "text" ? part.text : ""))
      .filter(Boolean)
      .join("\n\n")

  const statusOf = (id: string) => results[id] ?? "running"

  const complete = (entry: ClaudeCommand) => {
    draft = `/${entry.name} `
    pick = 0
    field?.focus()
  }

  const submit = () => {
    const text = draft.trim()

    if (!text) {
      return
    }

    onsend(text)
    pending = text
    draft = ""
    pinned = true
  }

  const onkeydown = (e: KeyboardEvent) => {
    const chosen = matches[pick]

    if (chosen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault()
      pick =
        (pick + (e.key === "ArrowDown" ? 1 : -1) + matches.length) %
        matches.length

      return
    }

    if (chosen && e.key === "Tab") {
      e.preventDefault()
      complete(chosen)

      return
    }

    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault()

      if (chosen && draft.trim() !== `/${chosen.name}`) {
        complete(chosen)
      } else {
        submit()
      }

      return
    }

    if (e.key === "Escape" && matches.length > 0) {
      e.preventDefault()
      dismissed = draft

      return
    }

    if (e.key === "Escape" && screen.busy) {
      e.preventDefault()
      onstop()
    }
  }

  const onscroll = () => {
    if (scroller) {
      pinned =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <
        STICK
    }
  }

  const onlink = (e: MouseEvent) => {
    const link = (e.target as Element).closest("a")

    if (!link) {
      return
    }

    e.preventDefault()

    if (link.href.startsWith("http")) {
      window.open(link.href, "_blank", "noopener")
    }
  }

  $effect(() => {
    scroller?.addEventListener("click", onlink)

    return () => scroller?.removeEventListener("click", onlink)
  })

  $effect(() => {
    if (pick >= matches.length) {
      pick = 0
    }
  })

  $effect(() => {
    const sent = pending

    if (!sent) {
      return
    }

    const echoed = turns
      .slice(-4)
      .some(turn => turn.role === "user" && userText(turn.parts) === sent)

    if (echoed || screen.overlay || screen.prompt) {
      pending = null

      return
    }

    const timer = setTimeout(() => {
      pending = null
    }, PENDING_LIMIT_MS)

    return () => clearTimeout(timer)
  })

  $effect(() => {
    const size = turns.reduce((sum, turn) => sum + turn.parts.length, 0)
    const waiting = screen.busy || screen.prompt !== null || pending !== null

    if ((size >= 0 || waiting) && pinned && scroller) {
      scroller.scrollTop = scroller.scrollHeight
    }
  })

  $effect(() => {
    if (active) {
      field?.focus()
    }
  })
</script>

{#snippet bubble(text: string, faded: boolean)}
  <div class="flex justify-end" in:appear>
    <p
      class={[
        "max-w-xl whitespace-pre-wrap break-words rounded-box rounded-br-md",
        "bg-base-200 px-4 py-2.5 text-sm",
        faded && "opacity-70",
      ]}
    >
      {text}
    </p>
  </div>
{/snippet}

<section class="flex size-full min-h-0 flex-col bg-base-100">
  <div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto" {onscroll}>
    <div class="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-5 py-6">
      {#if turns.length === 0 && !pending}
        <p class="m-auto text-sm text-base-content/40">
          {$t("terminal.claude.empty")}
        </p>
      {/if}

      {#each turns as turn (turn.id)}
        {#if turn.role === "user"}
          {@render bubble(userText(turn.parts), false)}
        {:else}
          <div class="flex flex-col gap-3">
            {#each blocksOf(turn.parts) as block, at (at)}
              {#if block.kind === "text"}
                <div class="markdown min-w-0 text-sm leading-relaxed" in:appear>
                  {@html renderMarkdown(block.text)}
                </div>
              {:else}
                <ul
                  class={[
                    "flex flex-col divide-y divide-base-content/10",
                    "overflow-hidden rounded-box border border-base-content/10",
                    "bg-base-200/40",
                  ]}
                  in:appear
                >
                  {#each block.tools as tool (tool.id)}
                    {@const status = statusOf(tool.id)}

                    <li
                      class="flex min-w-0 items-center gap-2.5 px-3 py-2 text-xs"
                      in:appear
                    >
                      <Icon
                        icon={TOOL_ICONS[tool.name] ?? "lucide:wrench"}
                        class="size-3.5 shrink-0 text-base-content/60"
                      />

                      <span class="shrink-0 font-semibold">{tool.name}</span>

                      <span
                        class="min-w-0 flex-1 truncate text-base-content/55"
                        title={tool.detail}
                      >
                        {tool.detail}
                      </span>

                      {#if status === "done"}
                        <Icon
                          icon="lucide:check"
                          class="size-3.5 shrink-0 text-success"
                        />
                      {:else if status === "failed"}
                        <Icon
                          icon="lucide:x"
                          class="size-3.5 shrink-0 text-error"
                        />
                      {:else if screen.busy}
                        <span
                          class={[
                            "loading loading-spinner loading-xs shrink-0",
                            "text-base-content/40",
                          ]}
                        ></span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            {/each}
          </div>
        {/if}
      {/each}

      {#if pending}
        {@render bubble(pending, true)}
      {/if}

      {#if screen.busy && !screen.prompt}
        <div class="flex items-center gap-2 text-sm text-base-content/50" in:appear>
          <span class="loading loading-dots loading-sm"></span>
          {$t("terminal.claude.working")}
        </div>
      {/if}
    </div>
  </div>

  {#if !screen.overlay}
    <footer class="relative shrink-0 px-5 pb-4">
      <div class="mx-auto flex max-w-3xl flex-col gap-2">
        {#if screen.prompt}
          <div
            class={[
              "flex flex-col gap-3 rounded-box border border-primary/40",
              "bg-primary/5 p-4",
            ]}
                      >
            <div class="flex items-start gap-2.5">
              <Icon
                icon="lucide:shield-question"
                class="mt-0.5 size-4 shrink-0 text-primary"
              />

              <div class="flex min-w-0 flex-col gap-1">
                <p class="text-sm font-semibold">
                  {screen.prompt.question || $t("terminal.claude.promptTitle")}
                </p>

                {#each screen.prompt.detail as line, at (at)}
                  <p class="truncate text-xs text-base-content/60" title={line}>
                    {line}
                  </p>
                {/each}
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              {#each screen.prompt.choices as choice, at (choice.key)}
                <button
                  class={[
                    "btn btn-sm h-auto min-h-8 max-w-full justify-start py-1.5",
                    "text-left",
                    at === 0
                      ? "btn-primary"
                      : "btn-ghost border border-base-content/15",
                  ]}
                  onclick={() => onchoose(choice.key)}
                >
                  <span class="truncate">{choice.label}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="relative">
          {#if matches.length > 0}
            <ul
              class={[
                "absolute inset-x-0 bottom-full z-10 mb-2 flex flex-col",
                "overflow-hidden rounded-box border border-base-content/15",
                "bg-base-200 p-1 shadow-lg",
              ]}
              role="listbox"
              aria-label={$t("terminal.claude.commands")}
                          >
              {#each matches as entry, at (entry.name)}
                <li role="option" aria-selected={at === pick}>
                  <button
                    type="button"
                    class={[
                      "flex w-full min-w-0 cursor-pointer items-baseline gap-3",
                      "rounded-field px-3 py-1.5 text-left text-sm",
                      at === pick ? "bg-primary/15" : "hover:bg-base-content/5",
                    ]}
                    onmouseenter={() => (pick = at)}
                    onclick={() => complete(entry)}
                  >
                    <span class="shrink-0 font-medium">/{entry.name}</span>

                    {#if entry.description}
                      <span
                        class="min-w-0 truncate text-xs text-base-content/50"
                        title={entry.description}
                      >
                        {entry.description}
                      </span>
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}

          <div
            class={[
              "flex items-end gap-2 rounded-box border border-base-content/15",
              "bg-base-200/60 p-2 pl-4 transition-colors duration-140",
              "focus-within:border-primary/60",
            ]}
          >
            <textarea
              bind:this={field}
              bind:value={draft}
              class={[
                "field-sizing-content max-h-48 min-h-6 flex-1 resize-none",
                "bg-transparent py-1.5 text-sm outline-none",
                "placeholder:text-base-content/40",
              ]}
              rows="1"
              placeholder={$t("terminal.claude.placeholder")}
              aria-label={$t("terminal.claude.placeholder")}
              {onkeydown}
            ></textarea>

            {#if screen.busy && !draft.trim()}
              <button
                class="btn btn-sm btn-square rounded-full"
                title={$t("terminal.claude.stop")}
                aria-label={$t("terminal.claude.stop")}
                onclick={onstop}
              >
                <Icon icon="lucide:square" class="size-3.5" />
              </button>
            {:else}
              <button
                class="btn btn-primary btn-sm btn-square rounded-full"
                title={$t("terminal.claude.send")}
                aria-label={$t("terminal.claude.send")}
                disabled={!draft.trim()}
                onclick={submit}
              >
                <Icon icon="lucide:arrow-up" class="size-4" />
              </button>
            {/if}
          </div>
        </div>
      </div>
    </footer>
  {/if}
</section>
