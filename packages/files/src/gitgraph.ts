import type { GitCommit } from "./native"

export type GraphEdge = {
  from: number
  to: number
  half: "top" | "bottom" | "through"
}

export type GraphRow = {
  lane: number
  width: number
  edges: GraphEdge[]
}

const place = (lanes: (string | null)[], hash: string) => {
  const free = lanes.indexOf(null)

  if (free < 0) {
    lanes.push(hash)

    return lanes.length - 1
  }

  lanes[free] = hash

  return free
}

const trim = (lanes: (string | null)[]) => {
  while (lanes.length && lanes.at(-1) === null) {
    lanes.pop()
  }
}

export const commitGraph = (commits: GitCommit[]): GraphRow[] => {
  const lanes: (string | null)[] = []

  return commits.map(commit => {
    const before = [...lanes]
    const found = lanes.indexOf(commit.hash)
    const lane = found < 0 ? place(lanes, commit.hash) : found

    for (const [index, hash] of lanes.entries()) {
      if (hash === commit.hash) {
        lanes[index] = null
      }
    }

    const [first, ...rest] = commit.parents
    lanes[lane] = first ?? null

    for (const parent of rest) {
      if (!lanes.includes(parent)) {
        place(lanes, parent)
      }
    }

    trim(lanes)

    const edges: GraphEdge[] = []

    for (const [index, hash] of before.entries()) {
      if (hash === commit.hash) {
        edges.push({ from: index, to: lane, half: "top" })
      } else if (hash !== null) {
        edges.push({ from: index, to: index, half: "through" })
      }
    }

    for (const parent of commit.parents) {
      edges.push({ from: lane, to: lanes.indexOf(parent), half: "bottom" })
    }

    return {
      lane,
      width: Math.max(before.length, lanes.length, lane + 1),
      edges,
    }
  })
}
