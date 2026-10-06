<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Confirm, Segmented, toast } from "@eris/ui"
  import { open } from "@tauri-apps/plugin-dialog"
  import { writeText } from "@tauri-apps/plugin-clipboard-manager"
  import { t } from "svelte-i18n"
  import { shareError } from "./errors"
  import Qr from "./Qr.svelte"
  import RemoteBrowser from "./RemoteBrowser.svelte"
  import {
    answerBrowse,
    type Device,
    dismissPair,
    type Invite,
    invite,
    join,
    removeDevice,
    renameDevice,
    renameSelf,
    revokeBrowse,
    type Member,
    type Scope,
    setBrowseScope,
  } from "./share"
  import { share } from "./share.svelte"

  let { scan }: { scan?: () => Promise<string | null> } = $props()

  let offer = $state<Invite | null>(null)
  let inviting = $state(false)
  let code = $state("")
  let joining = $state(false)
  let editing = $state<string | null>(null)
  let draft = $state("")
  let removing = $state<Device | null>(null)
  let confirmRemove = $state(false)
  let browsing = $state<Member | null>(null)

  const browse = $derived(share.state.browse)

  const nameOf = (id: string) =>
    [...share.state.devices, ...share.state.members].find(known => known.id === id)?.name ??
    id.slice(0, 8)

  const changeScope = (scope: Scope) =>
    setBrowseScope(scope, browse.folders).catch(reason => toast(shareError(reason), "error"))

  const addFolder = async () => {
    const picked = await open({ directory: true }).catch(() => null)

    if (typeof picked === "string" && !browse.folders.includes(picked)) {
      await setBrowseScope("folders", [...browse.folders, picked]).catch(reason =>
        toast(shareError(reason), "error"),
      )
    }
  }

  const removeFolder = (folder: string) =>
    setBrowseScope(
      browse.scope,
      browse.folders.filter(known => known !== folder),
    ).catch(reason => toast(shareError(reason), "error"))

  const startInvite = async () => {
    inviting = true

    try {
      offer = await invite()
    } catch (reason) {
      toast(shareError(reason), "error")
    } finally {
      inviting = false
    }
  }

  const connect = async (value: string) => {
    if (!value.trim()) {
      return
    }

    joining = true

    try {
      await join(value)
      code = ""
      toast($t("devices.joined"), "success")
    } catch (reason) {
      toast(shareError(reason), "error")
    } finally {
      joining = false
    }
  }

  const scanCode = async () => {
    const value = await scan?.().catch(() => null)

    if (value) {
      await connect(value)
    }
  }

  const commitName = (id: string) => {
    const name = draft.trim()

    editing = null

    if (name) {
      renameDevice(id, name).catch(() => undefined)
    }
  }
</script>

<div class="flex flex-col gap-4">
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-base-content/60">{$t("devices.thisDevice")}</span>
    <input
      class="input input-sm w-full"
      value={share.state.name}
      onchange={e => renameSelf(e.currentTarget.value).catch(() => undefined)}
    />
  </label>

  {#if share.state.pendingPair}
    <div class="flex flex-col gap-2 rounded-box border border-primary/30 bg-primary/5 p-3">
      <span class="text-sm">{$t("devices.pairRequest")}</span>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-xs btn-primary"
          disabled={joining}
          onclick={() => share.state.pendingPair && connect(share.state.pendingPair)}
        >
          {$t("devices.connect")}
        </button>
        <button
          type="button"
          class="btn btn-xs btn-ghost"
          onclick={() => dismissPair().catch(() => undefined)}
        >
          {$t("devices.ignore")}
        </button>
      </div>
    </div>
  {/if}

  {#each share.state.browseAsks as ask (ask.id)}
    <div class="flex flex-col gap-2 rounded-box border border-primary/30 bg-primary/5 p-3">
      <span class="text-sm">{$t("devices.browseRequest", { values: { name: ask.name } })}</span>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-xs btn-primary"
          onclick={() => answerBrowse(ask.id, "once").catch(() => undefined)}
        >
          {$t("devices.allowOnce")}
        </button>
        <button
          type="button"
          class="btn btn-xs btn-soft"
          onclick={() => answerBrowse(ask.id, "always").catch(() => undefined)}
        >
          {$t("devices.allowAlways")}
        </button>
        <button
          type="button"
          class="btn btn-xs btn-ghost"
          onclick={() => answerBrowse(ask.id, "deny").catch(() => undefined)}
        >
          {$t("devices.deny")}
        </button>
      </div>
    </div>
  {/each}

  <div class="flex flex-col gap-1">
    <span class="text-xs font-medium text-base-content/60">{$t("devices.paired")}</span>

    {#if share.state.devices.length === 0}
      <p class="text-sm text-base-content/60">{$t("devices.none")}</p>
    {:else}
      <ul class="flex flex-col">
        {#each share.state.devices as device (device.id)}
          <li class="flex items-center gap-2 rounded-field px-1 py-1 hover:bg-base-content/5">
            <Icon icon="lucide:monitor-smartphone" class="size-4 shrink-0 text-base-content/60" />

            {#if editing === device.id}
              <input
                class="input input-xs min-w-0 flex-1"
                aria-label={$t("devices.rename")}
                bind:value={draft}
                {@attach node => node.focus()}
                onblur={() => commitName(device.id)}
                onkeydown={e => {
                  if (e.key === "Enter") {
                    commitName(device.id)
                  } else if (e.key === "Escape") {
                    e.stopPropagation()
                    editing = null
                  }
                }}
              />
            {:else}
              <span class="min-w-0 flex-1 truncate text-sm">{device.name}</span>
            {/if}

            <button
              type="button"
              class="btn btn-ghost btn-square btn-xs"
              aria-label={$t("devices.browse")}
              title={$t("devices.browse")}
              onclick={() => (browsing = device)}
            >
              <Icon icon="lucide:folder-search" class="size-3.5" />
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-square btn-xs"
              aria-label={$t("devices.rename")}
              onclick={() => {
                draft = device.name
                editing = device.id
              }}
            >
              <Icon icon="lucide:pencil" class="size-3.5" />
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-square btn-xs hover:text-error"
              aria-label={$t("devices.remove")}
              onclick={() => {
                removing = device
                confirmRemove = true
              }}
            >
              <Icon icon="lucide:trash-2" class="size-3.5" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if share.state.members.length > 0}
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-base-content/60">{$t("devices.syncDevices")}</span>

      <ul class="flex flex-col">
        {#each share.state.members as member (member.id)}
          <li class="flex items-center gap-2 rounded-field px-1 py-1 hover:bg-base-content/5">
            <Icon icon="lucide:monitor" class="size-4 shrink-0 text-base-content/60" />
            <span class="min-w-0 flex-1 truncate text-sm">{member.name}</span>
            <button
              type="button"
              class="btn btn-ghost btn-square btn-xs"
              aria-label={$t("devices.browse")}
              title={$t("devices.browse")}
              onclick={() => (browsing = member)}
            >
              <Icon icon="lucide:folder-search" class="size-3.5" />
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="flex flex-col gap-2">
    <span class="text-xs font-medium text-base-content/60">{$t("devices.browseScope")}</span>

    <Segmented
      label={$t("devices.browseScope")}
      value={browse.scope}
      onchange={changeScope}
      options={[
        { value: "drives", label: $t("devices.scopes.drives") },
        { value: "home", label: $t("devices.scopes.home") },
        { value: "folders", label: $t("devices.scopes.folders") },
      ]}
    />

    {#if browse.scope === "folders"}
      {#if browse.folders.length === 0}
        <p class="text-sm text-base-content/60">{$t("devices.noFolders")}</p>
      {:else}
        <ul class="flex flex-col">
          {#each browse.folders as folder (folder)}
            <li class="flex items-center gap-2 rounded-field px-1 py-1 hover:bg-base-content/5">
              <Icon icon="lucide:folder" class="size-4 shrink-0 text-base-content/60" />
              <span class="min-w-0 flex-1 truncate text-sm" title={folder}>{folder}</span>
              <button
                type="button"
                class="btn btn-ghost btn-square btn-xs hover:text-error"
                aria-label={$t("devices.removeFolder")}
                onclick={() => removeFolder(folder)}
              >
                <Icon icon="lucide:x" class="size-3.5" />
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <button type="button" class="btn btn-sm btn-soft justify-start" onclick={addFolder}>
        <Icon icon="lucide:folder-plus" class="size-4" />
        {$t("devices.addFolder")}
      </button>
    {/if}

    {#if browse.always.length > 0}
      <span class="text-xs font-medium text-base-content/60">{$t("devices.allowed")}</span>

      <ul class="flex flex-col">
        {#each browse.always as id (id)}
          <li class="flex items-center gap-2 rounded-field px-1 py-1 hover:bg-base-content/5">
            <Icon icon="lucide:shield-check" class="size-4 shrink-0 text-base-content/60" />
            <span class="min-w-0 flex-1 truncate text-sm">{nameOf(id)}</span>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => revokeBrowse(id).catch(() => undefined)}
            >
              {$t("devices.revoke")}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if browsing}
    <RemoteBrowser device={browsing} onclose={() => (browsing = null)} />
  {/if}

  <Confirm
    bind:open={confirmRemove}
    title={$t("devices.confirmRemove", { values: { name: removing?.name ?? "" } })}
    body={$t(share.state.senior ? "devices.removeEverywhere" : "devices.removeHere")}
    action={$t("devices.remove")}
    onconfirm={() => removing && removeDevice(removing.id).catch(() => undefined)}
  />

  <div class="flex flex-col gap-2">
    <span class="text-xs font-medium text-base-content/60">{$t("devices.add")}</span>

    {#if offer}
      <div class="flex items-start gap-3">
        <Qr text={offer.link} label={$t("devices.qr")} />

        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <p class="text-xs text-base-content/70">{$t("devices.scanHint")}</p>
          <input
            class="input input-sm w-full"
            readonly
            aria-label={$t("devices.code")}
            value={offer.code}
            onfocus={e => e.currentTarget.select()}
          />
          <button
            type="button"
            class="btn btn-xs btn-soft"
            onclick={async () => {
              if (offer) {
                await writeText(offer.code)
                toast($t("share.copied"), "success")
              }
            }}
          >
            <Icon icon="lucide:copy" class="size-3.5" />
            {$t("devices.copyCode")}
          </button>
          <p class="text-xs text-base-content/50">{$t("devices.expires")}</p>
        </div>
      </div>
    {:else}
      <button
        type="button"
        class="btn btn-sm btn-soft justify-start"
        disabled={inviting}
        onclick={startInvite}
      >
        {#if inviting}
          <span class="loading loading-spinner loading-xs"></span>
        {:else}
          <Icon icon="lucide:qr-code" class="size-4" />
        {/if}
        {$t("devices.showQr")}
      </button>
    {/if}

    <form
      class="flex gap-2"
      onsubmit={e => {
        e.preventDefault()
        connect(code)
      }}
    >
      <input
        class="input input-sm min-w-0 flex-1"
        placeholder={$t("devices.enterCode")}
        aria-label={$t("devices.enterCode")}
        autocomplete="off"
        spellcheck="false"
        bind:value={code}
      />
      <button type="submit" class="btn btn-sm btn-soft" disabled={joining || !code.trim()}>
        {$t("devices.connect")}
      </button>
    </form>

    {#if scan}
      <button type="button" class="btn btn-sm btn-primary" disabled={joining} onclick={scanCode}>
        <Icon icon="lucide:scan-qr-code" class="size-4" />
        {$t("devices.scan")}
      </button>
    {/if}
  </div>
</div>
