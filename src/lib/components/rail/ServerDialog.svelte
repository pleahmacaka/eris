<script lang="ts">
import Icon from "@iconify/svelte"
import Dialog from "#lib/components/ui/Dialog.svelte"
import IconPicker from "#lib/components/ui/IconPicker.svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { errorCode, roomError } from "#lib/matrix/errors.js"
import { parseRoomAddress } from "#lib/matrix/spaces.js"
import { type ChannelsRoute, channelsPath } from "#lib/routes.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { goto } from "$app/navigation"

let { open, onclose }: { open: boolean; onclose: () => void } = $props()

type Step = "choose" | "create" | "join"

const TITLE: Record<Step, MessageKey> = {
  choose: "rail.addServer",
  create: "rail.server.createTitle",
  join: "rail.server.joinTitle",
}

const SUBTITLE: Record<Step, MessageKey> = {
  choose: "rail.server.chooseHint",
  create: "rail.server.createHint",
  join: "rail.server.joinHint",
}

const CHOICES: { step: Step; label: MessageKey; icon: string }[] = [
  { step: "create", label: "rail.server.createChoice", icon: "lucide:plus" },
  { step: "join", label: "rail.server.joinChoice", icon: "lucide:link" },
]

let step = $state<Step>("choose")
let name = $state("")
let icon = $state<File | null>(null)
let address = $state("")
let busy = $state(false)
let error = $state<Message | null>(null)

const parsed = $derived(parseRoomAddress(address))
const valid = $derived(step === "create" ? name.trim() !== "" : parsed !== null)
const hint = $derived(
  step === "join" && address.trim() !== "" && parsed === null
    ? i18n.t("rail.server.addressInvalid")
    : "",
)

const enter = (next: Step) => {
  if (next === "create" && name === "") {
    name = i18n.t("rail.server.defaultName", {
      name: sessionStore.displayName,
    })
  }

  error = null
  step = next
}

const close = () => {
  onclose()
  step = "choose"
  name = ""
  icon = null
  address = ""
  error = null
}

const create = async (): Promise<ChannelsRoute | null> => {
  const spaceId = await chatStore.createServer(name.trim(), icon)

  return spaceId ? { spaceId, roomId: null } : null
}

const join = async (): Promise<ChannelsRoute | null> => {
  const joined = parsed ? await chatStore.joinSpace(parsed) : null

  if (!joined) {
    return null
  }

  return joined.isSpace
    ? { spaceId: joined.id, roomId: null }
    : { spaceId: null, roomId: joined.id }
}

const submit = async (event: SubmitEvent) => {
  event.preventDefault()

  if (!valid || busy) {
    return
  }

  busy = true
  error = null

  try {
    const target = await (step === "create" ? create() : join())

    close()

    if (target) {
      await goto(channelsPath(target))
    }
  } catch (cause) {
    error = roomError(errorCode(cause))
  } finally {
    busy = false
  }
}
</script>

<Dialog {open} title={i18n.t(TITLE[step])} align="center" onclose={close}>
  <p class="text-center text-muted text-sm">{i18n.t(SUBTITLE[step])}</p>

  {#if step === "choose"}
    <div class="flex flex-col gap-2">
      {#each CHOICES as choice (choice.step)}
        <button
          type="button"
          class={[
            "flex cursor-pointer items-center gap-3 rounded-field border border-base-content/10",
            "px-3 py-3 text-start hover:border-primary hover:bg-primary/5",
          ]}
          onclick={() => enter(choice.step)}
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary"
          >
            <Icon icon={choice.icon} class="size-5" />
          </span>
          <span class="min-w-0 flex-1 font-semibold">{i18n.t(choice.label)}</span>
          <Icon icon="lucide:chevron-right" class="size-4 text-subtle rtl:-scale-x-100" />
        </button>
      {/each}
    </div>
  {:else}
    <form id="server-form" class="flex flex-col gap-3" onsubmit={submit}>
      {#if step === "create"}
        <IconPicker bind:file={icon} {name} label={i18n.t("rail.server.iconPick")} disabled={busy} />
      {/if}
      <fieldset class="fieldset gap-2" disabled={busy}>
        {#if step === "create"}
          <label class="fieldset-label" for="server-name">{i18n.t("rail.server.name")}</label>
          <input
            id="server-name"
            class="input w-full"
            autocomplete="off"
            required
            bind:value={name}
          />
        {:else}
          <label class="fieldset-label" for="server-address">{i18n.t("rail.server.address")}</label>
          <input
            id="server-address"
            class="input w-full"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            placeholder={i18n.t("rail.server.addressPlaceholder")}
            required
            bind:value={address}
          />
        {/if}
      </fieldset>
      <p class="min-h-5 text-error text-xs" role="alert">{error ? i18n.text(error) : hint}</p>
    </form>
  {/if}

  {#snippet actions()}
    {#if step === "choose"}
      <button type="button" class="btn btn-ghost" onclick={close}>{i18n.t("ui.close")}</button>
    {:else}
      <button
        type="button"
        class="btn btn-ghost me-auto"
        disabled={busy}
        onclick={() => enter("choose")}
      >
        {i18n.t("ui.goBack")}
      </button>
      <button type="submit" form="server-form" class="btn btn-primary" disabled={!valid || busy}>
        {#if busy}
          <span class="loading loading-spinner loading-xs"></span>
        {/if}
        {i18n.t(step === "create" ? "ui.create" : "rail.server.join")}
      </button>
    {/if}
  {/snippet}
</Dialog>
