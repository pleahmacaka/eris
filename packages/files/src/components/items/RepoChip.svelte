<script lang="ts" module>
  import { gitUser } from "../../native"

  const owner = $state<{ name: string | null; asked: boolean }>({
    name: null,
    asked: false,
  })

  const askUser = () => {
    if (!owner.asked) {
      owner.asked = true
      gitUser()
        .then(name => (owner.name = name))
        .catch(() => undefined)
    }
  }
</script>

<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { hostOf } from "../../hosts"
  import { type GitHead, runAddress } from "../../native"
  import { prefs } from "../../store/prefs.svelte"

  let {
    kind,
    head = null,
    folder,
    title,
  }: {
    kind: "repo" | "submodule"
    head?: GitHead | null
    folder?: string
    title?: string
  } = $props()

  askUser()

  const host = $derived(hostOf(head, prefs.gitHosts))

  const repoName = $derived.by(() => {
    if (!host.path) {
      return $t("explorer.decor.repo")
    }

    const cut = host.path.lastIndexOf("/")
    const account = host.path.slice(0, cut)
    const name = host.path.slice(cut + 1)
    const mine =
      owner.name !== null && account.toLowerCase() === owner.name.toLowerCase()
    const echoed = name.toLowerCase() === folder?.toLowerCase()

    if (echoed) {
      return mine ? null : account
    }

    return mine ? name : host.path
  })

  const parts = $derived(
    prefs.repoChip.order.filter(part => !prefs.repoChip.hidden.includes(part)),
  )

  const forkLabel = $derived(
    host.fork ? $t("explorer.decor.forkOf", { values: { upstream: host.fork } }) : "",
  )

  const CHIP = [
    "flex min-w-6 shrink-1000 items-center gap-1 overflow-hidden",
    "rounded-field px-1.5 bg-base-content/8 text-xs text-base-content/60",
  ]

  const web = $derived(kind === "repo" ? host.web : null)

  const open = (e: MouseEvent) => {
    e.stopPropagation()

    if (web) {
      runAddress(web, null).catch(() => undefined)
    }
  }
</script>

{#snippet content()}
  {#if kind === "submodule"}
    <Icon icon="lucide:folder-git-2" class="size-3 shrink-0" />
    {$t("explorer.decor.submodule")}
  {/if}

  {#each parts as part (part)}
    {#if part === "logo" && kind === "repo"}
      <Icon
        icon={host.icon}
        class="size-3 shrink-0"
        aria-label={host.name ?? host.domain ?? $t("explorer.decor.repo")}
      />
    {:else if part === "host" && kind === "repo" && (host.name || host.domain)}
      <span class="max-w-32 truncate">{host.name ?? host.domain}</span>
    {:else if part === "repo" && kind === "repo" && repoName}
      <span class="max-w-40 min-w-0 truncate">{repoName}</span>
    {:else if part === "branch" && head?.branch}
      <span class="flex min-w-0 shrink-1000 items-center gap-0.5">
        <Icon icon="lucide:git-branch" class="size-3 shrink-0" />
        <span class="max-w-24 truncate">{head.branch}</span>
      </span>
    {:else if part === "fork" && host.fork}
      <span class="flex shrink-0 items-center" title={forkLabel} aria-label={forkLabel}>
        <Icon icon="lucide:git-fork" class="size-3" />
      </span>
    {/if}
  {/each}
{/snippet}

{#if web}
  <button
    type="button"
    class={[
      CHIP,
      "cursor-pointer transition-colors duration-120 hover:bg-base-content/14",
    ]}
    title={title ?? web}
    onpointerdown={e => e.stopPropagation()}
    ondblclick={e => e.stopPropagation()}
    onclick={open}
  >
    {@render content()}
  </button>
{:else}
  <span class={CHIP} title={title ?? host.slug ?? undefined}>
    {@render content()}
  </span>
{/if}
