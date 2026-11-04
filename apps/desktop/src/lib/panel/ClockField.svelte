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

<div
  class={[
    "min-w-0 grow",
    "[--sdt-bg-main:var(--color-base-100)]",
    "[--sdt-color:var(--color-base-content)]",
    "[--sdt-header-color:var(--color-base-content)]",
    "[--sdt-bg-selected:var(--color-primary)]",
    "[--sdt-color-selected:var(--color-primary-content)]",
    "[--sdt-clock-bg:color-mix(in_oklch,var(--color-base-content)_6%,transparent)]",
    "[--sdt-clock-color:var(--color-base-content)]",
    "[--sdt-clock-color-hover:var(--color-base-content)]",
    "[--sdt-clock-selected-bg:var(--color-primary)]",
    "[--sdt-clock-time-bg:transparent]",
    "[--sdt-clock-time-bg-hover:color-mix(in_oklch,var(--color-base-content)_10%,transparent)]",
    "[--sdt-header-btn-bg-hover:color-mix(in_oklch,var(--color-base-content)_10%,transparent)]",
    "[--sdt-radius:var(--radius-box)]",
    "[--sdt-shadow-color:color-mix(in_oklch,var(--color-base-content)_20%,transparent)]",
    "[--sdt-wrap-shadow:0_0.5rem_1.5rem_var(--sdt-shadow-color)]",
  ]}
>
  <label for="time-{id}" class="sr-only">{label}</label>

  <SveltyPicker
    inputId="time-{id}"
    mode="time"
    format="hh:ii"
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

