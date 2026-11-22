<script lang="ts">
import Icon from "@iconify/svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import CopyButton from "#lib/components/ui/CopyButton.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { errorCode, profileError } from "#lib/matrix/errors.js"
import { mediaStore } from "#lib/store/media.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"

type Saving = "picture" | "name"

const IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp"

let picker = $state<HTMLInputElement>()
let picked = $state.raw<{ file: File; url: string } | null>(null)
let name = $state(sessionStore.displayName)
let saving = $state<Saving | null>(null)
let pictureError = $state<Message | null>(null)
let nameError = $state<Message | null>(null)

const session = $derived(sessionStore.session)
const limit = $derived(mediaStore.uploadLimit)
const trimmedName = $derived(name.trim())
const nameChanged = $derived(
  trimmedName !== "" && trimmedName !== sessionStore.displayName,
)
const hint = $derived(
  limit === null
    ? i18n.t("profile.picture.hint")
    : i18n.t("profile.picture.hintLimit", {
        limit: i18n.format.fileSize(limit),
      }),
)

const clearPick = () => {
  if (picked) {
    URL.revokeObjectURL(picked.url)
  }

  picked = null
}

const pick = (event: Event & { currentTarget: HTMLInputElement }) => {
  const file = event.currentTarget.files?.[0]

  event.currentTarget.value = ""

  if (!file) {
    return
  }

  clearPick()

  if (limit !== null && file.size > limit) {
    pictureError = {
      key: "ui.image.tooLarge",
      values: { limit: i18n.format.fileSize(limit) },
    }

    return
  }

  pictureError = null
  picked = { file, url: URL.createObjectURL(file) }
}

const save = async (kind: Saving, action: () => Promise<void>) => {
  saving = kind
  pictureError = null
  nameError = null

  try {
    await action()
  } catch (cause) {
    const text = profileError(errorCode(cause))

    if (kind === "picture") {
      pictureError = text
    } else {
      nameError = text
    }
  } finally {
    saving = null
  }
}

const applyPicture = () =>
  save("picture", async () => {
    if (picked) {
      await sessionStore.changeAvatar(picked.file)
      clearPick()
    }
  })

const removePicture = () => save("picture", () => sessionStore.removeAvatar())

const saveName = (event: SubmitEvent) => {
  event.preventDefault()

  if (nameChanged && saving === null) {
    void save("name", async () => {
      await sessionStore.changeDisplayName(trimmedName)
      name = trimmedName
    })
  }
}

$effect(() => clearPick)
</script>

<section
  class="overflow-hidden rounded-box border border-base-content/10 bg-base-100/50"
  aria-label={i18n.t("profile.account")}
>
  <div class="banner h-20" aria-hidden="true"></div>

  <div class="flex flex-col gap-5 px-6 pb-6">
    <div class="flex items-end gap-4">
      <span class="relative -mt-10 shrink-0 rounded-3xl bg-base-100 ring-4 ring-base-100">
        {#if picked}
          <img src={picked.url} alt="" class="size-20 rounded-3xl object-cover" />
        {:else}
          <Avatar
            name={sessionStore.displayName}
            mxc={sessionStore.avatarUrl}
            size="xl"
            tone="primary"
          />
        {/if}
      </span>
      <div class="min-w-0 flex-1 pb-1">
        <h2 class="truncate font-bold text-xl" title={sessionStore.displayName}>
          {sessionStore.displayName}
        </h2>
        <p class="flex items-center gap-1 text-muted text-sm">
          <span class="min-w-0 truncate" title={session?.userId}>{session?.userId}</span>
          <CopyButton text={session?.userId ?? ""} label={i18n.t("menu.user.copyId")} />
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <p class="font-semibold text-sm">{i18n.t("profile.picture.title")}</p>
      <div class="flex flex-wrap items-center gap-2">
        {#if picked}
          <button
            type="button"
            class="btn btn-primary btn-sm"
            disabled={saving !== null}
            onclick={applyPicture}
          >
            {#if saving === "picture"}
              <span class="loading loading-spinner loading-xs"></span>
            {/if}
            {i18n.t("profile.picture.apply")}
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            disabled={saving !== null}
            onclick={clearPick}
          >
            {i18n.t("ui.cancel")}
          </button>
          <span class="badge badge-ghost badge-sm whitespace-nowrap">{i18n.t("profile.picture.preview")}</span>
        {:else}
          <button
            type="button"
            class="btn btn-sm"
            disabled={saving !== null}
            onclick={() => picker?.click()}
          >
            <Icon icon="lucide:image-plus" class="size-4" />
            {i18n.t("profile.picture.change")}
          </button>
          {#if sessionStore.avatarUrl}
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              disabled={saving !== null}
              onclick={removePicture}
            >
              <Icon icon="lucide:trash-2" class="size-4" />
              {i18n.t("profile.picture.remove")}
            </button>
          {/if}
        {/if}
      </div>
      <p class="text-muted text-xs">{hint}</p>
      {#if pictureError}
        <p class="text-error text-sm" role="alert">{i18n.text(pictureError)}</p>
      {/if}
      <input
        bind:this={picker}
        type="file"
        accept={IMAGE_TYPES}
        class="hidden"
        aria-label={i18n.t("profile.picture.file")}
        onchange={pick}
      />
    </div>

    <form class="flex flex-col gap-2" onsubmit={saveName}>
      <label class="font-semibold text-sm" for="display-name">{i18n.t("profile.displayName")}</label>
      <div class="flex gap-2">
        <input
          id="display-name"
          class="input min-w-0 flex-1"
          type="text"
          autocomplete="nickname"
          spellcheck="false"
          disabled={saving === "name"}
          bind:value={name}
        />
        <button type="submit" class="btn btn-primary" disabled={!nameChanged || saving !== null}>
          {#if saving === "name"}
            <span class="loading loading-spinner loading-xs"></span>
          {/if}
          {i18n.t("ui.save")}
        </button>
      </div>
      {#if nameError}
        <p class="text-error text-sm" role="alert">{i18n.text(nameError)}</p>
      {/if}
    </form>

    <dl
      class={[
        "grid grid-cols-1 gap-x-6 gap-y-2 border-base-content/10 border-t pt-4",
        "text-sm sm:grid-cols-2",
      ]}
    >
      <dt class="text-subtle">{i18n.t("profile.homeserver")}</dt>
      <dd class="min-w-0 truncate" title={session?.homeserver}>{session?.homeserver}</dd>
      <dt class="text-subtle">{i18n.t("profile.deviceId")}</dt>
      <dd class="min-w-0 truncate" title={session?.deviceId}>{session?.deviceId}</dd>
    </dl>
  </div>
</section>
