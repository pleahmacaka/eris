<script lang="ts">
  const ORBS = [
    { x: "18%", y: "24%", size: "46vmax", offset: 0, depth: "-9rem", glow: 0.85, travel: "7%", dur: 19, delay: "0s" },
    { x: "78%", y: "18%", size: "40vmax", offset: 65, depth: "-5.6rem", glow: 0.8, travel: "9%", dur: 23, delay: "-6s" },
    { x: "70%", y: "80%", size: "44vmax", offset: 120, depth: "-2.5rem", glow: 0.75, travel: "8%", dur: 17, delay: "-3s" },
    { x: "24%", y: "76%", size: "36vmax", offset: -180, depth: "1.25rem", glow: 0.7, travel: "6%", dur: 27, delay: "-11s" },
    { x: "50%", y: "50%", size: "28vmax", offset: -55, depth: "5rem", glow: 0.55, travel: "11%", dur: 13, delay: "-8s" },
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
      `--steps:${o.dur * 10}`,
      `--pulse:${pulse(o.dur)}s`,
      `--pulse-steps:${pulse(o.dur) * 10}`,
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
