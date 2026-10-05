import * as m from "$lib/paraglide/messages"

type Endpoint = {
  host: string
  href?: string
}

type InfraNode = {
  role: () => string
  detail?: string
  spec?: string
  endpoints?: Endpoint[]
}

export const OPERATOR = {
  handle: "pleahmacaka",
  profile: "/u/pleahmacaka",
  href: "https://github.com/pleahmacaka",
}

export const nodes: InfraNode[] = [
  {
    role: m.gear_role_main,
    detail: "Radeon RX 9070 XT",
    spec: "Ryzen 7 7800X3D, 32GB DDR5",
  },
  {
    role: m.gear_role_agents,
    detail: "GeForce RTX 2070 SUPER",
    spec: "Ryzen 7 3700X, 32GB DDR4",
  },
  {
    role: m.section_services,
    endpoints: [{ host: "arixlab.com" }],
  },
]
