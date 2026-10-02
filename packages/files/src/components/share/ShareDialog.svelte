<script lang="ts">
  import Icon from "@iconify/svelte"
  import { toast } from "@eris/ui"
  import { writeText } from "@tauri-apps/plugin-clipboard-manager"
  import { t } from "svelte-i18n"
  import { baseName } from "../../locations"
  import { prefs } from "../../store/prefs.svelte"
  import { shareError } from "./errors"
  import { type ExpiryPreset, expiryFrom } from "./expiry"
  import ExpiryPicker from "./ExpiryPicker.svelte"
  import Qr from "./Qr.svelte"
  import {
    createShare,
    type Outgoing,
    offer,
    revoke,
    setExpiry,
    setPublic,
  } from "./share"
  import { share } from "./share.svelte"

  let dialog = $state<HTMLDialogElement>()
  let made = $state<Outgoing | null>(null)
  let linked = $state(false)
  let working = $state<string | null>(null)
  let sent = $state<string[]>([])
  let choice = $state<ExpiryPreset | "custom">(prefs.shareExpiry)
  let picked = $state<number | null>(null)

  const expiresAt = () =>
    choice === "custom" ? picked : expiryFrom(choice)

  const paths = $derived(share.paths ?? [])

  const subject = $derived(
    paths.length === 1
      ? baseName(paths[0])
      : $t("share.items", { values: { count: paths.length } }),
  )

  $effect(() => {
    if (!dialog) {
      return
    }

    if (share.paths && !dialog.open) {
      made = null
      linked = false
      sent = []
      choice = prefs.shareExpiry
      picked = null
      dialog.showModal()
    } else if (!share.paths && dialog.open) {
      dialog.close()
    }
  })

  const run = async (task: string, action: () => Promise<void>) => {
    working = task

    try {
      await action()
    } catch (reason) {
      toast(shareError(reason), "error")
    } finally {
      working = null
    }
  }

  const ensure = async () => {
    made ??= await createShare(paths, expiresAt())

    return made
  }

  const makeLink = () =>
    run("link", async () => {
      const current = await ensure()

      await setPublic(current.id, true)
      linked = true
    })

  const send = (device: string) =>
    run(device, async () => {
      const current = await ensure()

      await offer(current.id, device)
      sent = [...sent, device]
    })

  const stopLink = () =>
    run("link", async () => {
      if (!made) {
        return
      }

      await setPublic(made.id, false)
      linked = false

      if (sent.length === 0) {
        made = null
      }
    })

  const changeExpiry = (value: number | null) => {
    if (made) {
      setExpiry(made.id, value).catch(reason =>
        toast(shareError(reason), "error"),
      )
    }
  }

  const copy = async () => {
    if (!made) {
      return
    }

    await writeText(made.link)
    toast($t("share.copied"), "success")
  }

  const closed = () => {
    if (made && !linked && sent.length === 0 && working === null) {
      revoke(made.id).catch(() => undefined)
    }

    made = null
    share.paths = null
  }
</script>

<dialog bind:this={dialog} class="modal" onclose={closed}>
  <div
    class={[
      "modal-box flex max-w-md flex-col gap-4 border border-base-content/10",
      "bg-base-100",
    ]}
  >
    <div class="flex flex-col gap-0.5">
      <h3 class="text-base font-semibold">{$t("share.title")}</h3>
      <p class="truncate text-sm text-base-content/60">{subject}</p>
    </div>

    <section class="flex flex-col gap-2">
      <h4 class="text-xs font-medium text-base-content/60">{$t("share.expiry")}</h4>

      <ExpiryPicker bind:choice bind:value={picked} onchange={changeExpiry} />
    </section>

    <section class="flex flex-col gap-2">
      <h4 class="text-xs font-medium text-base-content/60">{$t("share.link")}</h4>

      {#if made && linked}
        <div class="flex items-start gap-3">
          <Qr text={made.link} label={$t("share.qr")} />

          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <input
              class="input input-sm w-full"
              readonly
              aria-label={$t("share.link")}
              value={made.link}
              onfocus={e => e.currentTarget.select()}
            />

            <button type="button" class="btn btn-sm btn-primary" onclick={copy}>
              <Icon icon="lucide:copy" class="size-4" />
              {$t("share.copyLink")}
            </button>

            <button
              type="button"
              class="btn btn-sm btn-ghost"
              disabled={working !== null}
              onclick={stopLink}
            >
              <Icon icon="lucide:link-2-off" class="size-4" />
              {$t("share.stop")}
            </button>
          </div>
        </div>
      {:else}
        <button
          type="button"
          class="btn btn-sm btn-soft justify-start"
          disabled={working !== null}
          onclick={makeLink}
        >
          {#if working === "link"}
            <span class="loading loading-spinner loading-xs"></span>
            {$t("share.preparing")}
          {:else}
            <Icon icon="lucide:link" class="size-4" />
            {$t("share.makeLink")}
          {/if}
        </button>
      {/if}
    </section>

    <section class="flex flex-col gap-2">
      <h4 class="text-xs font-medium text-base-content/60">{$t("share.toDevice")}</h4>

      {#if share.state.devices.length === 0}
        <p class="text-sm text-base-content/60">{$t("share.noDevices")}</p>
      {:else}
        <ul class="flex flex-col gap-1">
          {#each share.state.devices as device (device.id)}
            <li class="flex items-center gap-3 rounded-field px-2 py-1.5 hover:bg-base-content/5">
              <Icon icon="lucide:monitor-smartphone" class="size-4 shrink-0 text-base-content/60" />
              <span class="min-w-0 flex-1 truncate text-sm">{device.name}</span>

              {#if sent.includes(device.id)}
                <span class="text-xs text-success">{$t("share.sent")}</span>
              {:else}
                <button
                  type="button"
                  class="btn btn-xs btn-soft"
                  disabled={working !== null}
                  onclick={() => send(device.id)}
                >
                  {#if working === device.id}
                    <span class="loading loading-spinner loading-xs"></span>
                  {/if}
                  {$t("share.send")}
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <div class="modal-action mt-0">
      <button type="button" class="btn btn-sm" onclick={() => (share.paths = null)}>
        {$t("common.close")}
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">{$t("common.close")}</button>
  </form>
</dialog>
