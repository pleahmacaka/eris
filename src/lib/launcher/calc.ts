type Token =
  | { type: "num"; value: number }
  | { type: "id"; name: string }
  | { type: "op"; value: string }

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
}

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E }

const OPERATORS = "+-*/%^()"
const ALIASES: Record<string, string> = { "×": "*", "÷": "/", "−": "-" }

const GROUPED = /^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/

export const parseNumber = (raw: string) => {
  const plain = raw.replace(/_/g, "")

  if (plain.includes(",") && !GROUPED.test(plain)) {
    return Number.NaN
  }

  return Number(plain.replace(/,/g, ""))
}

const isDigit = (ch: string) => ch >= "0" && ch <= "9"
const isLetter = (ch: string) => /[a-z]/i.test(ch)

const tokenize = (input: string): Token[] | null => {
  const tokens: Token[] = []
  let at = 0

  while (at < input.length) {
    const ch = ALIASES[input[at]] ?? input[at]

    if (ch === " " || ch === "\t") {
      at += 1
      continue
    }

    if (isDigit(ch) || ch === ".") {
      let end = at

      while (end < input.length && /[0-9.,_]/.test(input[end])) {
        end += 1
      }

      const value = parseNumber(input.slice(at, end))

      if (Number.isNaN(value)) {
        return null
      }

      tokens.push({ type: "num", value })
      at = end
      continue
    }

    if (isLetter(ch)) {
      let end = at

      while (end < input.length && isLetter(input[end])) {
        end += 1
      }

      tokens.push({ type: "id", name: input.slice(at, end).toLowerCase() })
      at = end
      continue
    }

    if (OPERATORS.includes(ch)) {
      tokens.push({ type: "op", value: ch })
      at += 1
      continue
    }

    return null
  }

  return tokens
}

const parse = (tokens: Token[]): number => {
  let pos = 0

  const peek = () => tokens[pos]
  const isOp = (value: string) => {
    const token = peek()

    return token?.type === "op" && token.value === value
  }
  const startsOperand = (token: Token | undefined) =>
    token !== undefined && (token.type !== "op" || token.value === "(")
  const expect = (value: string) => {
    if (!isOp(value)) {
      throw new Error(`expected ${value}`)
    }

    pos += 1
  }

  const primary = (): number => {
    const token = tokens[pos]

    if (!token) {
      throw new Error("unexpected end")
    }

    pos += 1

    if (token.type === "num") {
      return token.value
    }

    if (token.type === "id") {
      const fn = FUNCTIONS[token.name]

      if (fn) {
        expect("(")
        const inner = expression()
        expect(")")

        return fn(inner)
      }

      if (token.name in CONSTANTS) {
        return CONSTANTS[token.name]
      }

      throw new Error(`unknown ${token.name}`)
    }

    if (token.value === "(") {
      const inner = expression()
      expect(")")

      return inner
    }

    throw new Error(`unexpected ${token.value}`)
  }

  const postfix = (): number => {
    let value = primary()

    for (;;) {
      if (isOp("%") && !startsOperand(tokens[pos + 1])) {
        pos += 1
        value /= 100
        continue
      }

      const token = peek()

      if (
        token?.type === "id" ||
        (token?.type === "op" && token.value === "(")
      ) {
        value *= power()
        continue
      }

      return value
    }
  }

  const power = (): number => {
    const base = postfix()

    if (isOp("^")) {
      pos += 1

      return base ** unary()
    }

    return base
  }

  const unary = (): number => {
    if (isOp("-")) {
      pos += 1

      return -unary()
    }

    if (isOp("+")) {
      pos += 1

      return unary()
    }

    return power()
  }

  const term = (): number => {
    let value = unary()

    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = (tokens[pos] as { value: string }).value

      pos += 1

      const right = unary()

      if (op !== "*" && right === 0) {
        throw new RangeError("Division by zero")
      }

      value =
        op === "*" ? value * right : op === "/" ? value / right : value % right
    }

    return value
  }

  const expression = (): number => {
    let value = term()

    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos] as { value: string }).value

      pos += 1

      const right = term()

      value = op === "+" ? value + right : value - right
    }

    return value
  }

  const result = expression()

  if (pos !== tokens.length) {
    throw new Error("trailing input")
  }

  return result
}

export type Evaluation = { value: number } | { error: string }

export const evaluate = (input: string): Evaluation | null => {
  const tokens = tokenize(input.trim())

  if (!tokens || tokens.length === 0) {
    return null
  }

  try {
    const value = parse(tokens)

    if (Number.isNaN(value)) {
      return { error: "Undefined" }
    }

    return Number.isFinite(value) ? { value } : { error: "Out of range" }
  } catch (e) {
    return e instanceof RangeError ? { error: e.message } : null
  }
}

const PLAIN_NUMBER = /^[\d.,_\s]+$/

export const looksLikeMath = (input: string) =>
  /\d/.test(input) && !PLAIN_NUMBER.test(input) && evaluate(input) !== null

const tidy = (value: number) => Number.parseFloat(value.toPrecision(12))

export const plainNumber = (value: number) => String(tidy(value))

export const formatNumber = (value: number) =>
  tidy(value).toLocaleString("en-US", { maximumFractionDigits: 10 })
