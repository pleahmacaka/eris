<script lang="ts">
  const ORBS = [
    { x: "18%", y: "24%", size: "46vmax", offset: 0, depth: "-9rem", glow: 0.9, travel: "16%", dur: 14, delay: "0s" },
    { x: "78%", y: "18%", size: "40vmax", offset: 65, depth: "-5.6rem", glow: 0.85, travel: "20%", dur: 18, delay: "-6s" },
    { x: "70%", y: "80%", size: "44vmax", offset: 120, depth: "-2.5rem", glow: 0.8, travel: "18%", dur: 12, delay: "-3s" },
    { x: "24%", y: "76%", size: "36vmax", offset: -180, depth: "1.25rem", glow: 0.75, travel: "14%", dur: 20, delay: "-11s" },
    { x: "50%", y: "50%", size: "28vmax", offset: -55, depth: "5rem", glow: 0.6, travel: "24%", dur: 10, delay: "-8s" },
  ]

  const pulse = (dur: number) => Math.round((dur / 2.7) * 10) / 10

  const style = (o: (typeof ORBS)[number]) =>
    [
      `--x:${o.x}`,
      `--y:${o.y}`,
      `--size:${o.size}`,
      `--offset:${o.offset}`,
      `--depth:${o.depth}`,
      `--glow:${o.glow}`,
      `--travel:${o.travel}`,
      `--dur:${o.dur}s`,
      `--steps:${o.dur * 30}`,
      `--pulse:${pulse(o.dur)}s`,
      `--pulse-steps:${Math.round(pulse(o.dur) * 30)}`,
      `--delay:${o.delay}`,
    ].join("; ")
</script>

<div aria-hidden="true" class="siri-aura">
  {#each ORBS as o (o.offset)}
    <div class="siri-orb" style={style(o)}></div>
  {/each}

  <div class="siri-veil"></div>

  <div class="siri-grain"></div>
</div>
