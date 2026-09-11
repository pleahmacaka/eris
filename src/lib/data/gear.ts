import * as m from "$lib/paraglide/messages"

export type GearItem = {
  name: string
  note?: () => string
}

export type GearGroup = {
  label: () => string
  items: GearItem[]
}

export const gear: GearGroup[] = [
  {
    label: m.gear_workstations,
    items: [
      { name: "Radeon RX 9070 XT", note: m.gear_role_main },
      { name: "GeForce RTX 2070 SUPER", note: m.gear_role_agents },
    ],
  },
  {
    label: m.gear_bench,
    items: [
      { name: "HOTO SnapBloq", note: m.gear_note_toolsystem },
      { name: "SnapBloq I-A06", note: m.gear_note_iron },
      { name: "FNIRSI HS-02A", note: m.gear_note_inserts },
    ],
  },
  {
    label: m.gear_printing,
    items: [
      { name: "Bambu Lab P1S" },
      { name: "SUNLU AMS Heater", note: m.gear_note_dryer },
    ],
  },
  {
    label: m.gear_xr,
    items: [
      { name: "Meta Quest 3" },
      { name: "SlimeVR trackers", note: m.gear_note_trackers },
    ],
  },
]
