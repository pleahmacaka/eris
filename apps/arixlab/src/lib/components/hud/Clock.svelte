<script lang="ts">
let now = $state<Date | null>(null)

$effect(() => {
  now = new Date()

  const timer = setInterval(() => {
    now = new Date()
  }, 1000)

  return () => clearInterval(timer)
})

const time = $derived(now ? now.toISOString().slice(11, 19) : "--:--:--")
</script>

<time class="tabular-nums" datetime={now?.toISOString()}>{time} UTC</time>
