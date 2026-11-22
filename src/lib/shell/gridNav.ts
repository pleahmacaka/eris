export const gridStep = (
  key: string,
  index: number,
  count: number,
  columns: number,
  rtl: boolean,
) => {
  const target = new Map([
    [rtl ? "ArrowLeft" : "ArrowRight", index + 1],
    [rtl ? "ArrowRight" : "ArrowLeft", index - 1],
    ["ArrowDown", index + columns],
    ["ArrowUp", index - columns],
    ["Home", 0],
    ["End", count - 1],
  ]).get(key)

  if (target === undefined) {
    return null
  }

  return target >= 0 && target < count ? target : index
}
