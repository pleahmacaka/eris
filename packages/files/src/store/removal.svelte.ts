export const removal = $state<{ names: string[] | null }>({ names: null })

let settle: ((confirmed: boolean) => void) | null = null

export const answerRemoval = (confirmed: boolean) => {
  settle?.(confirmed)
  settle = null
  removal.names = null
}

export const confirmRemoval = (names: string[]) => {
  answerRemoval(false)

  return new Promise<boolean>(resolve => {
    settle = resolve
    removal.names = names
  })
}
