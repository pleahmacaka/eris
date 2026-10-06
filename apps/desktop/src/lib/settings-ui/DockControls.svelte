<script lang="ts">
  import { listMonitors, type MonitorInfo } from "$lib/native/windows"
  import { startEdit } from "$lib/edit"
  import {
    DOCK_STYLES,
    type DeviceSettings,
    type DockAlign,
    defaultDevice,
  } from "@eris/settings"
  import Icon from "@iconify/svelte"
  import DockPreview from "./DockPreview.svelte"
  import { reset } from "./reset"
  import { Logo, Row, Segmented, toast } from "@eris/ui"
  import { t } from "svelte-i18n"

  type Part = "style" | "size" | "behavior" | "arrange"

  const ICON_LIMIT = 512 * 1024
  const ICON_SIDE = 128

  let {
    device = $bindable(),
    part = "style",
    subset = false,
  }: { device: DeviceSettings; part?: Part; subset?: boolean } = $props()

  const resetRow = reset(() => device, defaultDevice)

  const shows = (p: Part) => part === p

  const ALIGNMENTS: { value: DockAlign; icon: string }[] = [
    { value: "start", icon: "lucide:align-start-horizontal" },
    { value: "center", icon: "lucide:align-center-horizontal" },
  ]

  type ArrangeToggle = "dockSeparators" | "showLauncherButton"

  const arrangeToggles = $derived<ArrangeToggle[]>(
    device.features.launcher
      ? ["dockSeparators", "showLauncherButton"]
      : ["dockSeparators"],
  )

  const mac = $derived(device.dockStyle === "mac")

  const alignments = $derived(
    ALIGNMENTS.map(a => ({
      ...a,
      label: $t(`settings.dock.${a.value}`),
    })),
  )

  let monitors = $state<MonitorInfo[]>([])

  const loadMonitors = () => {
    if (subset || part !== "style") {
      return
    }

    listMonitors()
      .then(list => {
        monitors = list
      })
      .catch(() => undefined)
  }

  $effect(() => {
    loadMonitors()
  })

  // stored as a small PNG because the device record is re-serialized and broadcast on every settings change
  const shrinkIcon = async (file: File) => {
    const url = URL.createObjectURL(file)

    try {
      const image = new Image()

      image.src = url
      await image.decode()

      const width = image.naturalWidth || ICON_SIDE
      const height = image.naturalHeight || ICON_SIDE
      const scale = ICON_SIDE / Math.max(width, height)
      const canvas = document.createElement("canvas")

      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)

      return canvas.toDataURL("image/png")
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const pickIcon = async (e: Event & { currentTarget: HTMLInputElement }) => {
    const input = e.currentTarget
    const file = input.files?.[0]

    input.value = ""

    if (!file) {
      return
    }

    if (file.size > ICON_LIMIT) {
      toast($t("settings.toasts.iconTooLarge"), "error")

      return
    }

    try {
      device.dockIcon = await shrinkIcon(file)
    } catch {
      toast($t("settings.toasts.iconFailed"), "error")
    }
  }

  const describe = (m: MonitorInfo) =>
    `${m.name} (${m.primary ? `${$t("settings.dock.primary")}, ` : ""}${m.width}×${m.height})`

  const unplugged = $derived(
    device.dockMonitor !== null &&
      monitors.length > 0 &&
      !monitors.some(m => m.id === device.dockMonitor),
  )
</script>

<svelte:window onfocus={loadMonitors} />

{#if shows("style")}
  <div data-row={$t("settings.rows.style")} class="group/row flex flex-col gap-3 px-4 py-3">
    <span class="flex items-center gap-1.5 text-sm font-medium">
      {$t("settings.rows.style")}

      <button
        type="button"
        class="btn btn-ghost btn-circle btn-xs opacity-0 transition-opacity duration-100 group-hover/row:opacity-60 hover:opacity-100 focus-visible:opacity-100"
        aria-label={$t("common.reset")}
        title={$t("common.reset")}
        onclick={resetRow("dockStyle")}
      >
        <Icon icon="lucide:rotate-ccw" class="size-3.5" />
      </button>
    </span>

    {#if !subset}
      <div class="mx-auto w-full max-w-sm">
        <DockPreview {device} />
      </div>
    {/if}

    <div class="grid grid-cols-2 gap-3" role="radiogroup" aria-label={$t("settings.dock.styleAria")}>
      {#each DOCK_STYLES as style (style)}
        {@const active = device.dockStyle === style}

        <button
          type="button"
          role="radio"
          aria-checked={active}
          class={[
            "flex flex-col gap-2 rounded-box border p-3 text-left outline-none transition duration-100 focus-visible:ring-2 focus-visible:ring-primary/50",
            active
              ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
              : "border-base-content/10 bg-base-100/40 hover:bg-base-content/5",
          ]}
          onclick={() => (device.dockStyle = style)}
        >
          <div
            class="relative h-14 w-full overflow-hidden rounded-field bg-linear-to-br from-primary/20 to-secondary/20 ring-1 ring-base-content/10"
          >
            {#if style === "windows"}
              <div
                class={[
                  "absolute inset-x-0 flex h-3.5 items-center justify-center gap-1 bg-base-content/25",
                  device.dockEdge === "top" ? "top-0" : "bottom-0",
                ]}
              >
                {#each [0, 1, 2, 3] as dot (dot)}
                  <span class="size-1.5 rounded-sm bg-base-100/80"></span>
                {/each}
              </div>
            {:else}
              <div
                class={[
                  "absolute left-1/2 flex h-3.5 w-1/2 -translate-x-1/2 items-center justify-center gap-1 rounded-full bg-base-content/25",
                  device.dockEdge === "top" ? "top-1" : "bottom-1",
                ]}
              >
                {#each [0, 1, 2, 3] as dot (dot)}
                  <span class="size-1.5 rounded-full bg-base-100/80"></span>
                {/each}
              </div>
            {/if}
          </div>

          <span class="text-sm font-medium">{$t(`settings.dock.styles.${style}.label`)}</span>

          <span class="text-xs text-base-content/60">{$t(`settings.dock.styles.${style}.hint`)}</span>
        </button>
      {/each}
    </div>
  </div>

  <Row
    label={$t("settings.rows.edge")}
    hint={$t("settings.hints.edge")}
    onreset={resetRow("dockEdge")}
  >
    <Segmented
      label={$t("settings.rows.edge")}
      bind:value={device.dockEdge}
      options={[
        { value: "bottom", label: $t("settings.dock.bottom"), icon: "lucide:panel-bottom" },
        { value: "top", label: $t("settings.dock.top"), icon: "lucide:panel-top" },
      ]}
    />
  </Row>

  {#if !subset}
    <Row
      label={$t("settings.rows.display")}
      hint={$t("settings.hints.display")}
      onreset={resetRow("dockMonitor")}
    >
      <select
        class="select select-sm w-56"
        aria-label={$t("settings.rows.display")}
        bind:value={device.dockMonitor}
      >
        <option value={null}>{$t("settings.dock.automatic")}</option>

        {#each monitors as m (m.id)}
          <option value={m.id}>{describe(m)}</option>
        {/each}

        {#if unplugged}
          <option value={device.dockMonitor} disabled>{$t("settings.dock.notConnected")}</option>
        {/if}
      </select>
    </Row>

    <Row
      label={$t("settings.rows.alignment")}
      hint={$t("settings.hints.alignment")}
      onreset={resetRow("dockAlign")}
    >
      <Segmented label={$t("settings.rows.alignment")} bind:value={device.dockAlign} options={alignments} />
    </Row>

    <Row
      label={$t("settings.rows.dockIslands")}
      hint={$t("settings.hints.dockIslands")}
      onreset={resetRow("dockIslands")}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.dockIslands")}
        bind:checked={device.dockIslands}
      />
    </Row>

    {#if device.dockIslands}
      <Row
        label={$t("settings.rows.islandGap")}
        hint={$t("settings.hints.islandGap")}
        value="{device.dockIslandGap} px"
        stacked
        onreset={resetRow("dockIslandGap")}
      >
        <input
          type="range"
          class="range range-primary range-xs w-full"
          min="0"
          max="48"
          step="2"
          aria-label={$t("settings.rows.islandGap")}
          bind:value={device.dockIslandGap}
        />
      </Row>
    {/if}

    <Row
      label={$t("settings.rows.dockIcon")}
      hint={$t("settings.hints.dockIcon")}
      onreset={resetRow("dockIcon")}
    >
      <div class="flex items-center gap-3">
        <span class="grid size-8 place-items-center rounded-field bg-base-content/5">
          {#if device.dockIcon}
            <img src={device.dockIcon} alt="" class="size-5 object-contain" />
          {:else}
            <Logo class="size-5" />
          {/if}
        </span>

        <label class="btn btn-ghost btn-xs">
          {$t("settings.dock.chooseImage")}

          <input
            type="file"
            class="hidden"
            accept="image/png,image/svg+xml,image/webp,image/jpeg,image/x-icon"
            onchange={pickIcon}
          />
        </label>
      </div>
    </Row>
  {/if}
{/if}

{#if shows("size")}
  <Row
    label={$t("settings.rows.height")}
    value="{device.dockHeight} px"
    stacked
    onreset={resetRow("dockHeight")}
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min="32"
      max="88"
      step="2"
      aria-label={$t("settings.rows.height")}
      bind:value={device.dockHeight}
    />
  </Row>

  {#if mac}
    <Row
      label={$t("settings.rows.width")}
      value="{device.dockWidth} px"
      stacked
      onreset={resetRow("dockWidth")}
    >
      <input
        type="range"
        class="range range-primary range-xs w-full"
        min="320"
        max="1400"
        step="20"
        aria-label={$t("settings.rows.width")}
        bind:value={device.dockWidth}
      />
    </Row>

    <Row
      label={$t("settings.rows.dockGrowth")}
      hint={$t("settings.hints.dockGrowth")}
      value="{Math.round(device.dockGrowth * 100)}%"
      stacked
      onreset={resetRow("dockGrowth")}
    >
      <input
        type="range"
        class="range range-primary range-xs w-full"
        min="0"
        max="1"
        step="0.05"
        aria-label={$t("settings.rows.dockGrowth")}
        bind:value={device.dockGrowth}
      />
    </Row>
  {/if}

  <Row
    label={$t("settings.rows.iconSize")}
    value="{device.dockIconSize} px"
    stacked
    onreset={resetRow("dockIconSize")}
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min="16"
      max="32"
      step="2"
      aria-label={$t("settings.rows.iconSize")}
      bind:value={device.dockIconSize}
    />
  </Row>
{/if}

{#if shows("behavior")}
  <Row
    label={$t("settings.rows.autoHide")}
    hint={$t("settings.hints.autoHide")}
    onreset={resetRow("dockAutoHide")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.autoHide")}
      bind:checked={device.dockAutoHide}
    />
  </Row>

  {#if device.dockAutoHide && !subset}
    <Row
      label={$t("settings.rows.hideDelay")}
      hint={$t("settings.hints.hideDelay")}
      value="{device.dockHideDelay} ms"
      stacked
      onreset={resetRow("dockHideDelay")}
    >
      <input
        type="range"
        class="range range-primary range-xs w-full"
        min="200"
        max="3000"
        step="40"
        aria-label={$t("settings.rows.hideDelay")}
        bind:value={device.dockHideDelay}
      />
    </Row>

    <Row
      label={$t("settings.rows.edgeOnly")}
      hint={$t("settings.hints.edgeOnly")}
      onreset={resetRow("dockEdgeOnly")}
    >
      <Segmented
        label={$t("settings.rows.edgeOnly")}
        bind:value={device.dockEdgeOnly}
        options={[
          { value: "never", label: $t("common.off") },
          { value: "maximized", label: $t("settings.dock.edgeOnly.maximized") },
          { value: "always", label: $t("settings.dock.edgeOnly.always") },
        ]}
      />
    </Row>

    <Row
      label={$t("settings.rows.hideAnimation")}
      hint={$t("settings.hints.hideAnimation")}
      onreset={resetRow("dockHideAnimation")}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.hideAnimation")}
        bind:checked={device.dockHideAnimation}
      />
    </Row>

    <Row
      label={$t("settings.rows.hideGather")}
      hint={$t("settings.hints.hideGather")}
      onreset={resetRow("dockHideGather")}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.hideGather")}
        disabled={!device.dockHideAnimation}
        bind:checked={device.dockHideGather}
      />
    </Row>

    {#if device.dockHideAnimation && device.dockHideGather}
      <Row
        label={$t("settings.rows.gatherHideMs")}
        hint={$t("settings.hints.gatherHideMs")}
        value="{device.dockGatherHideMs} ms"
        stacked
        onreset={resetRow("dockGatherHideMs")}
      >
        <input
          type="range"
          class="range range-primary range-xs w-full"
          min="200"
          max="1200"
          step="20"
          aria-label={$t("settings.rows.gatherHideMs")}
          bind:value={device.dockGatherHideMs}
        />
      </Row>

      <Row
        label={$t("settings.rows.gatherShowMs")}
        hint={$t("settings.hints.gatherShowMs")}
        value="{device.dockGatherShowMs} ms"
        stacked
        onreset={resetRow("dockGatherShowMs")}
      >
        <input
          type="range"
          class="range range-primary range-xs w-full"
          min="120"
          max="1200"
          step="20"
          aria-label={$t("settings.rows.gatherShowMs")}
          bind:value={device.dockGatherShowMs}
        />
      </Row>
    {/if}
  {/if}

  {#if !subset}
    <Row
      label={$t("settings.rows.fullscreenReveal")}
      hint={$t("settings.hints.fullscreenReveal")}
      onreset={resetRow("dockFullscreenReveal")}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.fullscreenReveal")}
        bind:checked={device.dockFullscreenReveal}
      />
    </Row>
  {/if}

  {#if mac}
    <Row
      label={$t("settings.rows.pinDesktop")}
      hint={$t("settings.hints.pinDesktop")}
      onreset={resetRow("dockDesktop")}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.pinDesktop")}
        bind:checked={device.dockDesktop}
      />
    </Row>
  {/if}

  <Row
    label={$t("settings.rows.hideTaskbar")}
    hint={$t("settings.hints.hideTaskbar")}
    onreset={resetRow("hideSystemTaskbar")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.hideTaskbar")}
      bind:checked={device.hideSystemTaskbar}
    />
  </Row>
{/if}

{#if shows("arrange")}
  <Row
    label={$t("settings.rows.topBar")}
    hint={$t("settings.hints.topBar")}
    onreset={resetRow("topBar")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.topBar")}
      bind:checked={device.topBar}
    />
  </Row>

  <Row
    label={$t("settings.rows.panelPosition")}
    hint={$t("settings.hints.panelPosition")}
    onreset={resetRow("panelPosition")}
  >
    <Segmented
      label={$t("settings.rows.panelPosition")}
      bind:value={device.panelPosition}
      options={[
        { value: "left", label: $t("settings.dock.alignStart"), icon: "lucide:align-left" },
        { value: "center", label: $t("settings.dock.alignCenter"), icon: "lucide:align-center-horizontal" },
        { value: "right", label: $t("settings.dock.alignEnd"), icon: "lucide:align-right" },
      ]}
    />
  </Row>

  {#each arrangeToggles as toggle (toggle)}
    <Row
      label={$t(`settings.rows.${toggle}`)}
      hint={$t(`settings.hints.${toggle}`)}
      onreset={resetRow(toggle)}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t(`settings.rows.${toggle}`)}
        bind:checked={device[toggle]}
      />
    </Row>
  {/each}

  <Row
    label={$t("settings.rows.dockLayout")}
    hint={device.editMode
      ? $t("settings.hints.dockLayout")
      : $t("settings.hints.dockLayoutLocked")}
    onreset={resetRow("dockWidgets")}
  >
    <button
      type="button"
      class="btn btn-ghost btn-xs"
      disabled={!device.editMode}
      onclick={startEdit}
    >
      {$t("settings.dock.openEditMode")}
    </button>
  </Row>
{/if}
