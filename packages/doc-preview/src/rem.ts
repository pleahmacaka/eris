const rootSize = () =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

export const rem = (px: number) => `${px / rootSize()}rem`
