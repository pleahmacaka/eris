import type { Appearance } from "../settings"

export type Priority = 0 | 1 | 2 | 3

export type Todo = {
  id: string
  title: string
  notes: string
  done: boolean
  doneAt: number | null
  priority: Priority
  due: string | null
  tags: string[]
  order: number
  createdAt: number
  updatedAt: number
}

export type Recurrence =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "yearly"

export type CalendarEvent = {
  id: string
  title: string
  notes: string
  start: string
  end: string
  allDay: boolean
  color: string | null
  reminderMinutes: number | null
  recurrence: Recurrence
  createdAt: number
  updatedAt: number
}

export type Preset = {
  id: string
  name: string
  appearance: Appearance
  createdAt: number
  updatedAt: number
}

export type Note = {
  id: string
  title: string
  body: string
  pinned: boolean
  color: string | null
  createdAt: number
  updatedAt: number
}
