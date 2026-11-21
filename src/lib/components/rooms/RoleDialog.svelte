<script lang="ts">
import Dialog from "#lib/components/ui/Dialog.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { actionError, errorCode } from "#lib/matrix/errors.js"
import { type MemberRole, ROLE_LABEL } from "#lib/matrix/members.js"
import {
  canAssignLevel,
  isSelfDemotion,
  levelKind,
  levelLabel,
  ROLE_LEVEL,
  ROLE_PRESETS,
} from "#lib/matrix/power.js"
import {
  powerContent,
  setUserLevel,
  standing,
} from "#lib/matrix/roomActions.js"
import { promptStore } from "#lib/store/prompt.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"

type Choice = MemberRole | "custom"

const OPTION_CLASS = [
  "flex cursor-pointer items-center gap-3 rounded-field border border-base-content/10 px-3 py-2",
  "has-checked:border-primary has-disabled:cursor-not-allowed has-disabled:opacity-50",
]

let choice = $state<Choice>("member")
let custom = $state<number | null>(0)
let busy = $state(false)
let error = $state<Message | null>(null)

const target = $derived(promptStore.assigning)
const context = $derived.by(() => {
  const client = sessionStore.client
  const room = target && client ? client.getRoom(target.roomId) : null

  return client && room && target
    ? {
        client,
        room,
        content: powerContent(room),
        rank: standing(room, client.getUserId() ?? "", target.userId),
      }
    : null
})
const level = $derived(choice === "custom" ? custom : ROLE_LEVEL[choice])
const assignable = (value: number) =>
  context !== null && canAssignLevel(context.content, context.rank, value)
const valid = $derived(
  context !== null &&
    level !== null &&
    level !== context.rank.target &&
    assignable(level),
)
const hint = $derived.by(() => {
  if (!context || level === null || level === context.rank.target) {
    return ""
  }

  if (!Number.isSafeInteger(level)) {
    return i18n.t("rooms.role.integer")
  }

  if (level > context.rank.actor) {
    return i18n.t("rooms.role.cannotRaise", {
      role: i18n.text(levelLabel(context.rank.actor)),
    })
  }

  return isSelfDemotion(context.rank, level)
    ? i18n.t("rooms.role.selfDemotionHint")
    : ""
})

$effect(() => {
  if (context) {
    const kind = levelKind(context.rank.target)

    choice = kind === "owner" ? "custom" : kind
    custom = Number.isFinite(context.rank.target) ? context.rank.target : 0
    error = null
  }
})

const close = () => {
  promptStore.assigning = null
}

const apply = async (value: number) => {
  if (context && target) {
    await setUserLevel(context.client, context.room, target.userId, value)
    close()
  }
}

const submit = async (event: SubmitEvent) => {
  event.preventDefault()

  const chosen = level

  if (!context || chosen === null || !valid || busy) {
    return
  }

  if (isSelfDemotion(context.rank, chosen)) {
    promptStore.confirming = {
      title: { key: "rooms.role.demoteTitle" },
      body: {
        key: "rooms.role.demoteBody",
        values: { role: i18n.text(levelLabel(chosen)) },
      },
      action: { key: "rooms.role.demoteAction" },
      run: () => apply(chosen),
    }

    return
  }

  busy = true
  error = null

  try {
    await apply(chosen)
  } catch (cause) {
    error = actionError(errorCode(cause))
  } finally {
    busy = false
  }
}
</script>

<Dialog open={target !== null} title={i18n.t("menu.user.changeRole")} onclose={close}>
  <form id="role-form" class="flex flex-col gap-3" onsubmit={submit}>
    <p class="text-muted text-sm">
      {i18n.t("rooms.role.prompt", {
        room: target?.name ?? "",
        user: target?.userName ?? "",
      })}
    </p>
    <fieldset class="fieldset gap-2" disabled={busy}>
      <legend class="sr-only">{i18n.t("rooms.role.legend")}</legend>
      {#each ROLE_PRESETS as role (role)}
        <label class={OPTION_CLASS}>
          <input
            type="radio"
            class="radio radio-primary radio-sm"
            name="role"
            value={role}
            disabled={!assignable(ROLE_LEVEL[role])}
            bind:group={choice}
          />
          <span class="flex-1 font-medium text-sm">{i18n.t(ROLE_LABEL[role])}</span>
          <span class="text-subtle text-xs tabular-nums">{ROLE_LEVEL[role]}</span>
        </label>
      {/each}
      <label class={OPTION_CLASS}>
        <input
          type="radio"
          class="radio radio-primary radio-sm"
          name="role"
          value="custom"
          bind:group={choice}
        />
        <span class="flex-1 font-medium text-sm">{i18n.t("rooms.role.custom")}</span>
        <input
          type="number"
          class="input input-sm w-24"
          step="1"
          aria-label={i18n.t("rooms.role.level")}
          disabled={choice !== "custom"}
          bind:value={custom}
        />
      </label>
    </fieldset>
    <p class={["min-h-5 text-xs", error ? "text-error" : "text-warning"]} role="alert">
      {error ? i18n.text(error) : hint}
    </p>
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={close}>{i18n.t("ui.cancel")}</button>
    <button type="submit" form="role-form" class="btn btn-primary" disabled={!valid || busy}>
      {i18n.t("ui.save")}
    </button>
  {/snippet}
</Dialog>
