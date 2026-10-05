import * as m from "$lib/paraglide/messages"

type Project = {
  name: string
  about: () => string
  path: string
}

export const projects: Project[] = [
  { name: "ArixLab Note", about: m.note_tagline, path: "/note" },
]
