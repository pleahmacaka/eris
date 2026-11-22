import type { Attachment } from "svelte/attachments"
import { mentionInsertion } from "#lib/matrix/mentions.js"
import { replaceSelection } from "#lib/menu/field.js"

let field: HTMLTextAreaElement | null = null

export const composerField: Attachment<HTMLTextAreaElement> = node => {
  field = node

  return () => {
    if (field === node) {
      field = null
    }
  }
}

export const mentionInComposer = (userId: string) => {
  if (field) {
    replaceSelection(
      field,
      mentionInsertion(userId, field.value.slice(0, field.selectionStart)),
    )
  }
}
