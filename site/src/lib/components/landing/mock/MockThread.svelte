<script lang="ts">
import Icon from "@iconify/svelte"
import Wordmark from "#lib/components/brand/Wordmark.svelte"
import type { MockAttachmentKind } from "#lib/landing/mock.js"
import type { MockCopy, MockLine } from "#lib/server/mock.js"
import MockEmpty from "./MockEmpty.svelte"
import MockMessage from "./MockMessage.svelte"

type Props = { messages: MockLine[]; empty: MockCopy["empty"]; trim?: boolean }

let { messages, empty, trim = false }: Props = $props()

const ATTACHMENT_ICON: Record<MockAttachmentKind, string> = {
  file: "lucide:file-text",
  audio: "lucide:music",
}

const CARD = [
  "flex w-52 max-w-full items-center gap-2 rounded-field border p-2",
  "border-base-content/20 bg-base-200",
]

const ACTION = "size-4 shrink-0 text-base-content/70"

const PILL =
  "whitespace-nowrap rounded-sm bg-primary/20 px-0.5 font-medium text-primary"
</script>

{#if messages.length === 0}
  <MockEmpty icon="lucide:message-circle" title={empty.title} hint={empty.hint} />
{:else}
  <div
    class={[
      "flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-hidden py-3",
      "mask-t-from-90%",
    ]}
  >
    {#each messages as message, index (index)}
      <div class={{ "hidden @2xl:block": trim && index === 0 }}>
        <MockMessage name={message.name} time={message.time} mine={message.mine}>
          <p>
            {#each message.parts as part, at (at)}
              {#if part.pill}
                <span dir="auto" class={PILL}>{part.text}</span>
              {:else}
                {part.text}
              {/if}
            {/each}
          </p>

          {#if message.image}
            <span
              class={[
                "flex h-20 w-44 max-w-full items-center justify-center",
                "rounded-field bg-linear-to-br from-primary to-secondary",
                "text-primary-content",
              ]}
            >
              <Wordmark class="h-4" />
            </span>
          {/if}

          {#if message.attachments.length > 0}
            <span class="flex flex-wrap gap-2">
              {#each message.attachments as file (file.name)}
                <span class={CARD}>
                  <Icon
                    icon={ATTACHMENT_ICON[file.kind]}
                    class="size-6 shrink-0 text-base-content/70"
                  />

                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class="truncate font-medium text-xs">{file.name}</span>
                    <span class="text-2xs text-base-content/60">{file.size}</span>
                  </span>

                  {#if file.kind === "audio"}
                    <Icon icon="lucide:play" class={ACTION} />
                  {/if}

                  <Icon icon="lucide:download" class={ACTION} />
                </span>
              {/each}
            </span>
          {/if}
        </MockMessage>
      </div>
    {/each}
  </div>
{/if}
