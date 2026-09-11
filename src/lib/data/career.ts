import * as m from "$lib/paraglide/messages"

export type Post = {
  title: () => string
  org: string
  note: () => string
  from: string
  to?: string
}

export const posts: Post[] = [
  {
    title: m.job_daeeun_title,
    org: "Daeeun Electrical Co., Ltd.",
    note: m.job_daeeun_note,
    from: "2026.01",
  },
  {
    title: m.job_freshtech_title,
    org: "FreshTech",
    note: m.job_freshtech_note,
    from: "2024.02",
    to: "2025.12",
  },
]
