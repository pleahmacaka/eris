<script lang="ts">
  import { currentLocale } from "@eris/i18n"
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { formatDate } from "../../format"
  import { type ChangeGroup, changeGroups } from "../../git"
  import {
    type GitCommit,
    type GitSync,
    gitCommit,
    gitLog,
    gitStage,
    gitSync,
    gitUnstage,
  } from "../../native"
  import { fail } from "../../store/command-errors"
  import type { Insight } from "../../store/insight.svelte"
  import { trustRepo } from "../../store/trust"
  import { GIT_TONES } from "../items/decor"
  import RepoChip from "../items/RepoChip.svelte"

  type Action = {
    one: string
    all: string
    icon: string
    apply: (root: string, paths: string[]) => Promise<void>
  }

  let { insight }: { insight: Insight } = $props()

  let commits = $state<GitCommit[]>([])
  let message = $state("")
  let busy = $state<string | null>(null)

  const STAGE: Action = {
    one: "stage",
    all: "stageAll",
    icon: "lucide:plus",
    apply: gitStage,
  }

  const ACTIONS: Record<ChangeGroup["id"], Action> = {
    staged: {
      one: "unstage",
      all: "unstageAll",
      icon: "lucide:minus",
      apply: gitUnstage,
    },
    changes: STAGE,
    untracked: STAGE,
  }

  const SYNC: [GitSync, string][] = [
    ["fetch", "lucide:refresh-cw"],
    ["pull", "lucide:arrow-down-to-line"],
    ["push", "lucide:arrow-up-from-line"],
  ]

  const repo = $derived(insight.view.repo)

  const status = $derived(insight.view.git)

  const groups = $derived(
    status ? changeGroups(status).filter(group => group.rows.length) : [],
  )

  const staged = $derived(groups.some(group => group.id === "staged"))

  const ready = $derived(busy === null && staged && message.trim() !== "")

  $effect(() => {
    const owner = insight

    owner.whole = true

    return () => {
      owner.whole = false
    }
  })

  $effect(() => {
    const root = status?.root
    let live = true

    if (!root) {
      return
    }

    gitLog(root)
      .catch(() => [])
      .then(list => {
        if (live) {
          commits = list
        }
      })

    return () => {
      live = false
    }
  })

  const run = async (id: string, work: (root: string) => Promise<void>) => {
    const owner = insight
    const root = owner.view.git?.root

    if (!root) {
      return false
    }

    busy = id

    try {
      await work(root)

      return true
    } catch (reason) {
      fail(reason)

      return false
    } finally {
      busy = null
      owner.refreshGit()
    }
  }

  const commit = async () => {
    const text = message.trim()

    if (await run("commit", root => gitCommit(root, text))) {
      message = ""
    }
  }

  const split = (path: string) => {
    const trimmed = path.endsWith("/") ? path.slice(0, -1) : path
    const cut = trimmed.lastIndexOf("/")

    return { name: trimmed.slice(cut + 1), dir: trimmed.slice(0, cut + 1) }
  }
</script>

{#snippet spinnerOr(id: string, icon: string, size: string)}
  {#if busy === id}
    <span class="loading loading-spinner loading-xs"></span>
  {:else}
    <Icon {icon} class={size} />
  {/if}
{/snippet}

{#if repo && !status}
  <div class="flex grow flex-col items-center justify-center gap-3 px-4 text-center text-sm">
    <Icon icon="lucide:shield-question" class="size-6 text-base-content/50" />

    <p class="text-base-content/60">{$t("explorer.git.untrusted")}</p>

    <button type="button" class="btn btn-soft btn-primary btn-sm" onclick={() => trustRepo(repo.root)}>
      {$t("explorer.git.trust")}
    </button>
  </div>
{:else if status}
<div class="flex min-h-0 grow flex-col gap-3 overflow-auto text-sm">
  <div class="flex items-center gap-2">
    <Icon icon="lucide:git-branch" class="size-4 shrink-0 text-base-content/60" />

    <span class="truncate font-medium" title={status.upstream ?? undefined}>
      {status.branch}
    </span>

    {#if status.superproject}
      <RepoChip kind="submodule" title={status.superproject} />
    {/if}

    {#if status.ahead || status.behind}
      <span class="shrink-0 text-xs text-base-content/50 tabular-nums">
        ↑{status.ahead} ↓{status.behind}
      </span>
    {/if}

    <div class="ml-auto flex shrink-0 gap-0.5">
      {#each SYNC as [id, icon] (id)}
        <button
          type="button"
          class="btn btn-ghost btn-square btn-xs"
          title={$t(`explorer.git.${id}`)}
          aria-label={$t(`explorer.git.${id}`)}
          disabled={busy !== null}
          onclick={() => run(id, root => gitSync(root, id))}
        >
          {@render spinnerOr(id, icon, "size-3.5")}
        </button>
      {/each}
    </div>
  </div>

  <div class="flex flex-col gap-1.5">
    <textarea
      bind:value={message}
      rows="2"
      placeholder={$t("explorer.git.message")}
      aria-label={$t("explorer.git.message")}
      class="textarea textarea-sm w-full resize-none"
      onkeydown={e => {
        if (e.key === "Enter" && e.ctrlKey && ready) {
          e.preventDefault()
          commit()
        }
      }}
    ></textarea>

    <button type="button" class="btn btn-primary btn-sm" disabled={!ready} onclick={commit}>
      {@render spinnerOr("commit", "lucide:check", "size-4")}

      {$t("explorer.git.commit")}
    </button>
  </div>

  {#each groups as group (group.id)}
    {@const action = ACTIONS[group.id]}
    {@const tone = GIT_TONES[group.tone]}

    <section class="flex flex-col">
      <div class="group/head flex items-center gap-2 py-1 text-xs font-medium text-base-content/60">
        <span>{$t(`explorer.git.groups.${group.id}`)}</span>

        <span class="tabular-nums text-base-content/40">{group.rows.length}</span>

        <button
          type="button"
          class="btn btn-ghost btn-xs ml-auto opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100"
          disabled={busy !== null}
          onclick={() =>
            run(action.all, root =>
              action.apply(root, group.rows.map(row => row.path)),
            )}
        >
          {$t(`explorer.git.${action.all}`)}
        </button>
      </div>

      <ul class="flex flex-col">
        {#each group.rows as row (row.path)}
          {@const parts = split(row.path)}

          <li class="group/row flex items-center gap-2 rounded-field px-1.5 py-0.5 hover:bg-base-content/5">
            <span class="min-w-0 grow truncate" title={row.path}>
              <span class={tone}>{parts.name}</span>

              <span class="text-xs text-base-content/40">{parts.dir}</span>
            </span>

            <button
              type="button"
              class="btn btn-ghost btn-square btn-xs opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
              title={$t(`explorer.git.${action.one}`)}
              aria-label={$t(`explorer.git.${action.one}`)}
              disabled={busy !== null}
              onclick={() => run(action.one, root => action.apply(root, [row.path]))}
            >
              <Icon icon={action.icon} class="size-3.5" />
            </button>

            <span class={["w-3 shrink-0 text-center text-xs font-semibold", tone]}>
              {row.letter}
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="py-2 text-center text-xs text-base-content/50">{$t("explorer.git.clean")}</p>
  {/each}

  {#if commits.length}
    <section class="flex flex-col">
      <div class="py-1 text-xs font-medium text-base-content/60">
        {$t("explorer.git.history")}
      </div>

      <ul class="flex flex-col gap-1">
        {#each commits as entry (entry.hash)}
          <li class="flex flex-col rounded-field px-1.5 py-1 hover:bg-base-content/5">
            <span class="truncate" title={entry.subject}>{entry.subject}</span>

            <span class="flex gap-2 text-xs text-base-content/50">
              <span class="shrink-0 tabular-nums">{entry.hash}</span>

              <span class="min-w-0 grow truncate">{entry.author}</span>

              <span class="shrink-0 tabular-nums">
                {formatDate(entry.time, currentLocale())}
              </span>
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>
{/if}
