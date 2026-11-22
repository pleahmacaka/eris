<script lang="ts">
import Icon from "@iconify/svelte"
import type { MockCopy } from "#lib/server/mock.js"
import { useMockDemo } from "#lib/store/mockDemo.svelte.js"
import MockComposer from "../MockComposer.svelte"
import { useMockFrame } from "../MockFrame.svelte"
import MockHeader from "../MockHeader.svelte"
import MockServerLayout from "../MockServerLayout.svelte"
import MockThread from "../MockThread.svelte"

let { t }: { t: MockCopy } = $props()

const demo = useMockDemo()

const frame = useMockFrame()

const channel = $derived(demo?.channel ?? "general")
</script>

<MockServerLayout {t}>
  <MockHeader icon="lucide:hash" title={t.channels[channel]} back={t.back}>
    <span class="ms-auto flex shrink-0 items-center gap-3 text-base-content/70">
      <Icon icon="lucide:settings" class="size-4" />
      <Icon icon="lucide:users" class="size-4" />
    </span>
  </MockHeader>

  <MockThread messages={t.threads[channel]} empty={t.empty} trim={!frame.fill} />

  <MockComposer placeholder={t.placeholders[channel]} />
</MockServerLayout>
