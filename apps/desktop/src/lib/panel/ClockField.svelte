<script lang="ts">
  import SveltyPicker from "svelty-picker"

  let {
    value,
    label,
    onchange,
  }: {
    value: string
    label: string
    onchange: (value: string) => void
  } = $props()

  const id = $props.id()
</script>

<div class="min-w-0 grow">
  <label for="time-{id}" class="sr-only">{label}</label>

  <SveltyPicker
    inputId="time-{id}"
    mode="time"
    format="hh:ii"
    theme="eris-time"
    {value}
    minuteIncrement={5}
    clearBtn={false}
    todayBtn={false}
    autocommit
    inputClasses="w-full cursor-pointer bg-transparent tabular-nums outline-none"
    onChange={next => {
      if (typeof next === "string" && next) {
        onchange(next)
      }
    }}
  />
</div>

<style>
  :global(.eris-time) {
    --sdt-bg-main: var(--color-base-100);
    --sdt-color: var(--color-base-content);
    --sdt-header-color: var(--color-base-content);
    --sdt-bg-selected: var(--color-primary);
    --sdt-color-selected: var(--color-primary-content);
    --sdt-clock-bg: color-mix(in oklch, var(--color-base-content) 6%, transparent);
    --sdt-clock-color: var(--color-base-content);
    --sdt-clock-color-hover: var(--color-base-content);
    --sdt-clock-selected-bg: var(--color-primary);
    --sdt-clock-time-bg: transparent;
    --sdt-clock-time-bg-hover: color-mix(in oklch, var(--color-base-content) 10%, transparent);
    --sdt-clock-size: 11rem;
    --sdt-header-btn-bg-hover: color-mix(in oklch, var(--color-base-content) 10%, transparent);
    --sdt-radius: var(--radius-box);
    --sdt-shadow-color: color-mix(in oklch, var(--color-base-content) 20%, transparent);
    --sdt-wrap-shadow: 0 0.5rem 1.5rem var(--sdt-shadow-color);
  }
</style>
