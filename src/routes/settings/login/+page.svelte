<script lang="ts">
  import Icon from "@iconify/svelte"
  import { goto } from "$app/navigation"
  import TopBar from "$lib/components/ui/TopBar.svelte"
  import { device } from "$lib/settings.svelte"
  import { signIn } from "$lib/sync/session"

  let url = $state("")
  let token = $state("")
  let label = $state("")
  let deviceName = $state("")
  let busy = $state(false)
  let error = $state<string | null>(null)

  $effect(() => {
    if (device.ready && deviceName === "") {
      deviceName = device.value.deviceName
    }
  })

  const ready = $derived(url.trim() !== "" && token.trim() !== "")

  const submit = async () => {
    busy = true
    error = null

    try {
      await signIn({ url, token, label, deviceName })
      await goto("/settings")
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      busy = false
    }
  }
</script>

<TopBar
  title="로그인"
  back={() => goto("/settings")}
  showSettings={false}
/>

<main class="mx-auto w-full max-w-md min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-6">
  <div class="mb-6 flex flex-col items-center gap-3 text-center">
    <div
      class={[
        "flex size-16 items-center justify-center",
        "rounded-box bg-primary/15 text-primary",
      ]}
    >
      <Icon icon="lucide:cloud" class="size-8" />
    </div>

    <p class="text-sm text-base-content/60">
      노드 주소와 토큰으로 이 기기를 등록합니다.
    </p>
  </div>

  <div class="flex flex-col gap-3">
    <label class="floating-label">
      <span>노드 주소</span>
      <input
        class="input w-full"
        placeholder="http://pmc-desktop.daeeun.vpn:47821"
        inputmode="url"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        bind:value={url}
      />
    </label>

    <label class="floating-label">
      <span>토큰</span>
      <input
        class="input w-full"
        type="password"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        bind:value={token}
      />
    </label>

    <label class="floating-label">
      <span>노드 이름</span>
      <input class="input w-full" placeholder="집 서버" bind:value={label} />
    </label>

    <label class="floating-label">
      <span>기기 이름</span>
      <input class="input w-full" bind:value={deviceName} />
    </label>

    {#if error}
      <p class="break-all text-sm text-error">{error}</p>
    {/if}

    <button
      class="btn btn-primary mt-2"
      disabled={!ready || busy}
      onclick={submit}
    >
      {#if busy}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      로그인
    </button>
  </div>
</main>
