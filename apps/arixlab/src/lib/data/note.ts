import * as m from "$lib/paraglide/messages"

export const NOTE_REPO = "pleahmacaka/eris"

export const NOTE_SOURCE = `https://github.com/${NOTE_REPO}/tree/main/apps/note`

export const NOTE_RELEASES = `https://github.com/${NOTE_REPO}/releases?q=note&expanded=true`

type Feature = {
  title: () => string
  body: () => string
}

export const features: Feature[] = [
  { title: m.note_feature_vault, body: m.note_feature_vault_body },
  { title: m.note_feature_canvas, body: m.note_feature_canvas_body },
  { title: m.note_feature_plan, body: m.note_feature_plan_body },
  { title: m.note_feature_sync, body: m.note_feature_sync_body },
  { title: m.note_feature_eris, body: m.note_feature_eris_body },
  { title: m.note_feature_workspace, body: m.note_feature_workspace_body },
]
