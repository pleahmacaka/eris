<script lang="ts">
import Icon from "@iconify/svelte"
import AudioToggle from "#lib/components/call/AudioToggle.svelte"
import RemoteAudio from "#lib/components/call/RemoteAudio.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { callStore } from "#lib/store/call.svelte.js"
</script>

{#if callStore.phase !== null}
  <div
    class={[
      "fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md flex-col gap-3",
      "rounded-box border border-base-content/10 bg-base-100/90 p-4",
      "shadow-xl backdrop-blur-sm md:inset-x-auto md:end-6",
    ]}
    role="status"
    aria-live="polite"
  >
    <div class="flex items-center gap-3">
      <span
        class={[
          "flex size-10 shrink-0 items-center justify-center rounded-selector",
          callStore.phase === "active"
            ? "bg-success/20 text-success"
            : "bg-primary/20 text-primary",
        ]}
      >
        <Icon
          icon={callStore.phase === "incoming"
            ? "lucide:phone-incoming"
            : "lucide:phone"}
          class="size-5"
        />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate font-bold" title={callStore.peerName}>
          {callStore.peerName}
        </p>
        <p class="flex gap-2 text-muted text-sm">
          <span>{callStore.label ? i18n.t(callStore.label) : ""}</span>
          {#if callStore.phase === "active"}
            <span class="tabular-nums">{callStore.duration}</span>
          {/if}
        </p>
      </div>
      <div class="flex shrink-0 gap-2">
        {#if callStore.phase === "incoming"}
          <button
            type="button"
            class="btn btn-error btn-square btn-sm"
            aria-label={i18n.t("call.decline")}
            title={i18n.t("call.decline")}
            onclick={() => callStore.reject()}
          >
            <Icon icon="lucide:phone-off" class="size-4.5" />
          </button>
          <button
            type="button"
            class="btn btn-success btn-square btn-sm"
            aria-label={i18n.t("call.answer")}
            title={i18n.t("call.answer")}
            onclick={() => callStore.answer()}
          >
            <Icon icon="lucide:phone" class="size-4.5" />
          </button>
        {:else if callStore.phase === "ended"}
          <button
            type="button"
            class="btn btn-ghost btn-square btn-sm"
            aria-label={i18n.t("ui.close")}
            title={i18n.t("ui.close")}
            onclick={() => callStore.dismiss()}
          >
            <Icon icon="lucide:x" class="size-4.5" />
          </button>
        {:else}
          <AudioToggle
            kind="mic"
            off={callStore.muted}
            onclick={() => callStore.toggleMute()}
          />
          <button
            type="button"
            class="btn btn-error btn-square btn-sm"
            aria-label={i18n.t("call.hangup")}
            title={i18n.t("call.hangup")}
            onclick={() => callStore.hangup()}
          >
            <Icon icon="lucide:phone-off" class="size-4.5" />
          </button>
        {/if}
      </div>
    </div>

    {#if callStore.message}
      <p class={["text-sm", callStore.phase !== "ended" && "text-error"]}>
        {i18n.text(callStore.message)}
      </p>
    {/if}
  </div>

  {#each callStore.streams as stream (stream.id)}
    <RemoteAudio {stream} />
  {/each}
{/if}
