export type Folded = { chars: string[]; heads: boolean[] }

const SYLLABLE_START = 0xac00

const SYLLABLE_COUNT = 11172

const INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"

const MEDIALS = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"

const FINALS = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"

const COMPOUNDS = new Map([
  ["ㄳ", "ㄱㅅ"],
  ["ㄵ", "ㄴㅈ"],
  ["ㄶ", "ㄴㅎ"],
  ["ㄺ", "ㄹㄱ"],
  ["ㄻ", "ㄹㅁ"],
  ["ㄼ", "ㄹㅂ"],
  ["ㄽ", "ㄹㅅ"],
  ["ㄾ", "ㄹㅌ"],
  ["ㄿ", "ㄹㅍ"],
  ["ㅀ", "ㄹㅎ"],
  ["ㅄ", "ㅂㅅ"],
  ["ㅘ", "ㅗㅏ"],
  ["ㅙ", "ㅗㅐ"],
  ["ㅚ", "ㅗㅣ"],
  ["ㅝ", "ㅜㅓ"],
  ["ㅞ", "ㅜㅔ"],
  ["ㅟ", "ㅜㅣ"],
  ["ㅢ", "ㅡㅣ"],
])

const WORD_CHAR = /[\p{L}\p{N}]/u

const HEAD = 160

const START = 40

const STREAK = 200

const GAP_INNER = -2

const GAP_EDGE = -1

const syllableJamo = (char: string) => {
  const offset = char.charCodeAt(0) - SYLLABLE_START

  if (char.length !== 1 || offset < 0 || offset >= SYLLABLE_COUNT) {
    return char
  }

  return [
    INITIALS.charAt(Math.floor(offset / 588)),
    MEDIALS.charAt(Math.floor((offset % 588) / 28)),
    FINALS.charAt(offset % 28).trim(),
  ].join("")
}

const keystrokes = (char: string) =>
  [...syllableJamo(char)].flatMap(jamo => [...(COMPOUNDS.get(jamo) ?? jamo)])

export const fold = (text: string): Folded => {
  const folded: Folded = { chars: [], heads: [] }
  let wordStart = true

  for (const char of text.normalize("NFC").toLowerCase()) {
    if (!WORD_CHAR.test(char)) {
      wordStart = true
      continue
    }

    const units = keystrokes(char)

    units.forEach((unit, index) => {
      folded.chars.push(unit)
      folded.heads.push(index === 0 && (wordStart || units.length > 1))
    })
    wordStart = false
  }

  return folded
}

const bonusAt = (hay: Folded, index: number) => {
  if (!hay.heads[index]) {
    return 0
  }

  return index === 0 ? HEAD + START : HEAD
}

export const fuzzyScore = (
  needle: readonly string[],
  hay: Folded,
): number | null => {
  const width = hay.chars.length

  if (needle.length === 0 || needle.length > width) {
    return null
  }

  let ending: number[] = []
  let best: number[] = []

  for (const [row, char] of needle.entries()) {
    const gap = row === needle.length - 1 ? GAP_EDGE : GAP_INNER
    const nextEnding = new Array<number>(width).fill(Number.NEGATIVE_INFINITY)
    const nextBest = new Array<number>(width).fill(Number.NEGATIVE_INFINITY)

    for (let column = row; column < width; column += 1) {
      if (char === hay.chars[column]) {
        nextEnding[column] =
          row === 0
            ? column * GAP_EDGE + bonusAt(hay, column)
            : Math.max(
                best[column - 1] + bonusAt(hay, column),
                ending[column - 1] + STREAK,
              )
      }

      nextBest[column] = Math.max(
        nextEnding[column],
        column === 0 ? Number.NEGATIVE_INFINITY : nextBest[column - 1] + gap,
      )
    }

    ending = nextEnding
    best = nextBest
  }

  return best[width - 1] === Number.NEGATIVE_INFINITY ? null : best[width - 1]
}
