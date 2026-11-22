export type Step = 1 | -1

export const walk = <T>(items: readonly T[], from: number, step: Step): T[] => {
  const count = items.length
  const start = from === -1 && step === -1 ? count : from
  const reach = from === -1 ? count : count - 1

  return Array.from(
    { length: Math.max(reach, 0) },
    (_, offset) => items[(start + step * (offset + 1) + count * 2) % count],
  )
}
