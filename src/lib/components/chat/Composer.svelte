<script lang="ts">
import Icon from "@iconify/svelte"
import { tick } from "svelte"
import { composerField } from "#lib/attachments/composerField.js"
import { keepKeyboard } from "#lib/attachments/keepKeyboard.js"
import MentionMenu from "#lib/components/chat/MentionMenu.svelte"
import PendingAttachment from "#lib/components/chat/PendingAttachment.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { attachmentKind } from "#lib/matrix/attachments.js"
import {
  findMentions,
  type MentionOption,
  type MentionPick,
  type MentionQuery,
  type MentionSpan,
  mentionQuery,
  splitByMentions,
} from "#lib/matrix/mentions.js"

type Pending = {
  id: number
  file: File
  preview: string | null
  progress: number | null
}

type MentionSource = {
  known: MentionPick[]
  suggest: (query: MentionQuery) => MentionOption[]
  resolve: (option: MentionOption) => MentionPick | null
}

type Props = {
  placeholder: string
  disabled?: boolean
  uploadLimit: number | null
  mentions: MentionSource
  onsend: (text: string, mentions: MentionSpan[]) => Promise<boolean>
  onattach: (
    file: File,
    onProgress: (fraction: number) => void,
  ) => Promise<boolean>
}

const MAX_ATTACHMENTS = 10

let {
  placeholder,
  disabled = false,
  uploadLimit,
  mentions,
  onsend,
  onattach,
}: Props = $props()

let text = $state("")
let caret = $state(0)
let sending = $state(false)
let pending = $state<Pending[]>([])
let picks = $state.raw<MentionPick[]>([])
let notice = $state<Message | null>(null)
let dragDepth = $state(0)
let menuIndex = $state(0)
let menuClosed = $state(false)
let field = $state<HTMLTextAreaElement>()
let backdrop = $state<HTMLDivElement>()
let picker = $state<HTMLInputElement>()
let nextId = 0

const canSend = $derived((text.trim() !== "" || pending.length > 0) && !sending)
const spans = $derived(findMentions(text, [...picks, ...mentions.known]))
const segments = $derived(splitByMentions(text, spans))
const query = $derived(menuClosed ? null : mentionQuery(text, caret))
const options = $derived(query ? mentions.suggest(query) : [])
const activeIndex = $derived(Math.min(menuIndex, options.length - 1))

const add = (files: Iterable<File>) => {
  notice = null

  for (const file of files) {
    if (pending.length >= MAX_ATTACHMENTS) {
      notice = {
        key: "chat.composer.tooManyFiles",
        values: { count: MAX_ATTACHMENTS },
      }
      break
    }

    if (uploadLimit !== null && file.size > uploadLimit) {
      notice = {
        key: "chat.composer.fileTooLarge",
        values: { name: file.name, limit: i18n.format.fileSize(uploadLimit) },
      }
      continue
    }

    nextId += 1
    pending.push({
      id: nextId,
      file,
      preview:
        attachmentKind(file.type) === "image"
          ? URL.createObjectURL(file)
          : null,
      progress: null,
    })
  }

  field?.focus()
}

const remove = (item: Pending) => {
  if (item.preview) {
    URL.revokeObjectURL(item.preview)
  }

  pending = pending.filter(other => other.id !== item.id)
}

const sendAttachments = async () => {
  for (const item of [...pending]) {
    item.progress = 0

    const sent = await onattach(item.file, fraction => {
      item.progress = fraction
    })

    if (!sent) {
      item.progress = null

      return
    }

    remove(item)
  }
}

const send = async () => {
  if (!canSend) {
    return
  }

  const body = text.trim()

  sending = true
  notice = null

  if (
    body === "" ||
    (await onsend(body, findMentions(body, [...picks, ...mentions.known])))
  ) {
    text = ""
    picks = []
    await sendAttachments()
  }

  sending = false
  field?.focus()
}

const syncCaret = () => {
  caret = field?.selectionStart ?? 0
}

const choose = async (option: MentionOption) => {
  const pick = mentions.resolve(option)

  if (!pick || !query) {
    return
  }

  const head = text.slice(0, query.start)
  const tail = text.slice(caret)
  const position = head.length + pick.label.length + 1

  text = `${head}${pick.label} ${tail.startsWith(" ") ? tail.slice(1) : tail}`
  picks = [...picks.filter(other => other.label !== pick.label), pick]
  menuIndex = 0
  await tick()
  field?.setSelectionRange(position, position)
  field?.focus()
  syncCaret()
}

const onMenuKey = (event: KeyboardEvent) => {
  const option = options[activeIndex]

  if (!option) {
    return false
  }

  if (event.key === "ArrowDown") {
    menuIndex = (activeIndex + 1) % options.length
  } else if (event.key === "ArrowUp") {
    menuIndex = (activeIndex - 1 + options.length) % options.length
  } else if (event.key === "Enter" || event.key === "Tab") {
    void choose(option)
  } else if (event.key === "Escape") {
    menuClosed = true
  } else {
    return false
  }

  return true
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.isComposing) {
    return
  }

  if (onMenuKey(event)) {
    event.preventDefault()
  } else if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    void send()
  }
}

const onInput = () => {
  menuClosed = false
  menuIndex = 0
  syncCaret()
}

const onPaste = (event: ClipboardEvent) => {
  const files = [...(event.clipboardData?.files ?? [])]

  if (files.length > 0) {
    event.preventDefault()
    add(files)
  }
}

const onPick = (event: Event & { currentTarget: HTMLInputElement }) => {
  add(event.currentTarget.files ?? [])
  event.currentTarget.value = ""
}

const carriesFiles = (event: DragEvent) =>
  !disabled && (event.dataTransfer?.types.includes("Files") ?? false)

const onDragEnter = (event: DragEvent) => {
  if (carriesFiles(event)) {
    event.preventDefault()
    dragDepth += 1
  }
}

const onDragOver = (event: DragEvent) => {
  if (carriesFiles(event)) {
    event.preventDefault()
  }
}

const onDragLeave = (event: DragEvent) => {
  if (carriesFiles(event)) {
    dragDepth = Math.max(0, dragDepth - 1)
  }
}

const onDrop = (event: DragEvent) => {
  if (carriesFiles(event)) {
    event.preventDefault()
    dragDepth = 0
    add(event.dataTransfer?.files ?? [])
  }
}

$effect(() => () => {
  for (const item of pending) {
    if (item.preview) {
      URL.revokeObjectURL(item.preview)
    }
  }
})
</script>

<svelte:window
  ondragenter={onDragEnter}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
/>

{#if dragDepth > 0}
  <div
    class={[
      "pointer-events-none fixed inset-0 z-40 flex items-center justify-center",
      "bg-base-100/70 backdrop-blur-sm",
    ]}
  >
    <div
      class={[
        "flex flex-col items-center gap-3 rounded-box border-2 border-primary border-dashed",
        "bg-base-200 px-10 py-8",
      ]}
    >
      <Icon icon="lucide:upload" class="size-8 text-primary" />
      <p class="font-semibold">{i18n.t("chat.composer.dropHint")}</p>
    </div>
  </div>
{/if}

<form
  class={["relative px-4 pt-1 pb-4", disabled && "opacity-60"]}
  inert={disabled}
  onsubmit={event => {
    event.preventDefault()
    void send()
  }}
>
  <div
    class={[
      "relative flex flex-col rounded-box border border-base-content/25 bg-base-200",
      "focus-within:border-primary",
    ]}
  >
    {#if options.length > 0}
      <MentionMenu {options} active={activeIndex} onpick={choose} />
    {/if}

    {#if pending.length > 0}
      <ul
        class="flex gap-2 overflow-x-auto border-base-content/20 border-b p-2"
        aria-label={i18n.t("chat.composer.attachments")}
      >
        {#each pending as item (item.id)}
          <li>
            <PendingAttachment
              name={item.file.name}
              size={item.file.size}
              preview={item.preview}
              progress={item.progress}
              locked={sending}
              onremove={() => remove(item)}
            />
          </li>
        {/each}
      </ul>
    {/if}

    {#if notice}
      <p class="px-3 pt-2 text-error text-xs" role="alert">{i18n.text(notice)}</p>
    {/if}

    <div class="flex items-end gap-1 p-1.5">
      <button
        type="button"
        class="btn btn-ghost btn-circle btn-sm"
        aria-label={i18n.t("chat.composer.attach")}
        title={i18n.t("chat.composer.attach")}
        disabled={sending}
        onclick={() => picker?.click()}
      >
        <Icon icon="lucide:plus" class="size-5" />
      </button>
      <div class="relative flex min-w-0 flex-1">
        <div
          bind:this={backdrop}
          class={[
            "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words",
            "px-1 py-1 text-md text-transparent",
          ]}
          aria-hidden="true"
        >{#each segments as segment}{#if segment.mention}<mark class="rounded-sm bg-primary/30 text-transparent">{segment.text}</mark>{:else}{segment.text}{/if}{/each}&#8203;</div>
        <textarea
          bind:this={field}
          {@attach keepKeyboard()}
          {@attach composerField}
          class={[
            "scrollbar-none relative max-h-40 min-h-8 w-full resize-none bg-transparent px-1 py-1",
            "field-sizing-content text-md outline-none placeholder:text-base-content/40",
          ]}
          rows="1"
          {placeholder}
          aria-label={i18n.t("chat.composer.message")}
          bind:value={text}
          onkeydown={onKeydown}
          oninput={onInput}
          onkeyup={syncCaret}
          onclick={syncCaret}
          onpaste={onPaste}
          onscroll={() => {
            if (backdrop && field) {
              backdrop.scrollTop = field.scrollTop
            }
          }}
        ></textarea>
      </div>
      <button
        type="submit"
        class="btn btn-ghost btn-circle btn-sm text-primary"
        aria-label={i18n.t("chat.composer.send")}
        title={i18n.t("chat.composer.send")}
        disabled={!canSend}
      >
        <Icon icon="lucide:send" class="size-5" />
      </button>
    </div>
  </div>

  <input
    bind:this={picker}
    type="file"
    multiple
    class="hidden"
    aria-label={i18n.t("chat.composer.pickFiles")}
    onchange={onPick}
  />
</form>
