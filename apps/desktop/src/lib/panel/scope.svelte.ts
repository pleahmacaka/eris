import type { Scope } from "@eris/data"

export type ScopeMode = "edit" | "delete"

export class ScopePrompt {
  asking = $state<{
    mode: ScopeMode
    scoped: boolean
    answer: (scope: Scope | null) => void
  } | null>(null)

  cancel = () => this.asking?.answer(null)

  ask = (mode: ScopeMode, scoped = true) =>
    new Promise<Scope | null>(resolve => {
      this.cancel()
      this.asking = {
        mode,
        scoped,
        answer: scope => {
          this.asking = null
          resolve(scope)
        },
      }
    })
}
