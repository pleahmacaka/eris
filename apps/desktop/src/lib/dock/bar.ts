// appbar.rs reserves the same height at startup, before this code runs
export const ISLAND_INSET = 4

export const barHeightFor = (dockHeight: number, islands: boolean) =>
  dockHeight + (islands ? ISLAND_INSET * 2 : 0)
