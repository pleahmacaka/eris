<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { imageIcon } from "../../image-icon"
  import { type GitHost, prefs } from "../../store/prefs.svelte"

  const LOGO_SIZE = 64

  const domainOf = (input: string) => {
    const text = input.trim()

    if (!text) {
      return ""
    }

    try {
      return new URL(text.includes("://") ? text : `https://${text}`).hostname
    } catch {
      return text.toLowerCase()
    }
  }

  const readLogo = async (file: File) => {
    const source = URL.createObjectURL(file)
    const image = new Image()

    try {
      image.src = source
      await image.decode()

      const canvas = document.createElement("canvas")
      const scale = LOGO_SIZE / Math.max(image.naturalWidth, image.naturalHeight, 1)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale

      canvas.width = LOGO_SIZE
      canvas.height = LOGO_SIZE
      canvas
        .getContext("2d")
        ?.drawImage(image, (LOGO_SIZE - width) / 2, (LOGO_SIZE - height) / 2, width, height)

      return canvas.toDataURL("image/png")
    } finally {
      URL.revokeObjectURL(source)
    }
  }

  const update = (index: number, patch: Partial<GitHost>) => {
    prefs.gitHosts = prefs.gitHosts.map((host, at) =>
      at === index ? { ...host, ...patch } : host,
    )
  }

  const pickLogo = async (index: number, input: HTMLInputElement) => {
    const file = input.files?.[0]

    input.value = ""

    if (file) {
      update(index, { logo: await readLogo(file).catch(() => null) })
    }
  }

  const add = () => {
    prefs.gitHosts = [...prefs.gitHosts, { domain: "", name: "", logo: null }]
  }

  const remove = (index: number) => {
    prefs.gitHosts = prefs.gitHosts.filter((_, at) => at !== index)
  }
</script>

<Section
  title={$t("explorer.settings.gitHosts.title")}
  description={$t("explorer.settings.gitHosts.hint")}
>
  {#each prefs.gitHosts as host, index (index)}
    <div class="flex items-center gap-2">
      <label
        class={[
          "flex size-8 shrink-0 cursor-pointer items-center justify-center",
          "rounded-field border border-base-content/15 hover:bg-base-content/6",
        ]}
        title={$t("explorer.settings.gitHosts.logo")}
      >
        <Icon
          icon={host.logo ? imageIcon(host.logo) : "lucide:image-plus"}
          class={["size-4", !host.logo && "text-base-content/45"]}
        />

        <input
          type="file"
          accept="image/*"
          class="hidden"
          aria-label={$t("explorer.settings.gitHosts.logo")}
          onchange={e => pickLogo(index, e.currentTarget)}
        />
      </label>

      <input
        class="input input-sm min-w-0 grow"
        placeholder="git.example.com"
        aria-label={$t("explorer.settings.gitHosts.domain")}
        value={host.domain}
        onchange={e => update(index, { domain: domainOf(e.currentTarget.value) })}
      />

      <input
        class="input input-sm w-36"
        placeholder={$t("explorer.settings.gitHosts.name")}
        aria-label={$t("explorer.settings.gitHosts.name")}
        value={host.name}
        onchange={e => update(index, { name: e.currentTarget.value.trim() })}
      />

      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square"
        aria-label={$t("explorer.settings.gitHosts.remove")}
        title={$t("explorer.settings.gitHosts.remove")}
        onclick={() => remove(index)}
      >
        <Icon icon="lucide:trash-2" class="size-4" />
      </button>
    </div>
  {/each}

  <button type="button" class="btn btn-ghost btn-sm self-start" onclick={add}>
    <Icon icon="lucide:plus" class="size-4" />
    {$t("explorer.settings.gitHosts.add")}
  </button>
</Section>
