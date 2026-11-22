<script lang="ts">
import Icon from "@iconify/svelte"
import Backdrop from "#lib/components/brand/Backdrop.svelte"
import Logo from "#lib/components/brand/Logo.svelte"
import Wordmark from "#lib/components/brand/Wordmark.svelte"
import type { MockCopy } from "#lib/server/mock.js"

let { t }: { t: MockCopy } = $props()

const LABEL = "text-2xs text-base-content/70"

const FIELD = [
  "flex h-9 shrink-0 items-center rounded-field border px-3",
  "border-base-content/25 bg-base-200",
]

const PASSWORD_DOTS = [0, 1, 2, 3, 4, 5, 6, 7]
</script>

<div
  class="relative isolate flex min-w-0 flex-1 items-center justify-center p-3"
>
  <Backdrop />

  <div
    class="grid w-full max-w-2xl items-center gap-3 @2xl:grid-cols-2 @2xl:gap-8"
  >
    <div
      class={[
        "flex flex-col items-center gap-2 text-center",
        "@2xl:items-start @2xl:gap-3 @2xl:text-start",
      ]}
    >
      <Logo class="size-7 @2xl:size-16" />
      <Wordmark class="h-3.5 @2xl:h-8" />
      <p class="hidden text-base-content/70 @2xl:block">{t.login.subtitle}</p>
    </div>

    <div
      class={[
        "flex flex-col gap-1.5 rounded-box border p-3 @2xl:gap-2 @2xl:p-5",
        "border-base-content/20 bg-base-100",
      ]}
    >
      <span class={LABEL}>{t.login.user.label}</span>
      <span class={FIELD}>
        <span class="min-w-0 truncate" dir="ltr">{t.login.user.value}</span>
      </span>

      <span class={[LABEL, "mt-1"]}>{t.login.server.label}</span>
      <span class={FIELD}>
        <span class="min-w-0 truncate" dir="ltr">{t.login.server.value}</span>
      </span>
      <span class="flex items-center gap-1.5 text-2xs text-success">
        <Icon icon="lucide:circle-check" class="size-3.5 shrink-0" />
        <span class="min-w-0 truncate">{t.login.server.found}</span>
      </span>

      <span class={[LABEL, "mt-1"]}>{t.login.password}</span>
      <span class={[FIELD, "gap-1.5"]}>
        {#each PASSWORD_DOTS as dot (dot)}
          <span class="size-1.5 rounded-full bg-base-content"></span>
        {/each}
      </span>

      <span class="btn btn-primary pointer-events-none mt-2">
        {t.login.submit}
      </span>
    </div>
  </div>
</div>
