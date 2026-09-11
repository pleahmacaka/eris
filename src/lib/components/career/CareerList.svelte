<script lang="ts">
import type { Post } from "$lib/data/career"
import { scramble } from "$lib/motion/scramble"
import * as m from "$lib/paraglide/messages"

let { posts }: { posts: Post[] } = $props()

const step = 90
</script>

<ul class="flex flex-col">
  {#each posts as post, i (post.org)}
    <li
      class={[
        "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1",
        "border-base-300 border-t py-4 first:border-t-0 first:pt-0",
      ]}
    >
      <div class="flex flex-col gap-0.5">
        <p class="font-medium" use:scramble={{ delay: i * step }}>
          {post.title()}
        </p>
        <p
          class="text-base-content/70 text-sm"
          use:scramble={{ delay: i * step + 60 }}
        >
          {post.org}
        </p>
      </div>

      <div class="flex flex-col gap-0.5 sm:items-end">
        <p
          class="text-base-content/70 text-sm"
          use:scramble={{ delay: i * step + 30 }}
        >
          {post.note()}
        </p>
        <p
          class="text-base-content/55 text-sm"
          use:scramble={{ delay: i * step + 90 }}
        >
          {post.from} – {post.to ?? m.career_present()}
        </p>
      </div>
    </li>
  {/each}

  <li
    class={[
      "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1",
      "border-base-300 border-t py-4 pb-0",
    ]}
  >
    <p class="font-medium" use:scramble={{ delay: posts.length * step }}>
      {m.career_education()}
    </p>
    <p
      class="text-base-content/70 text-sm"
      use:scramble={{ delay: posts.length * step + 60 }}
    >
      {m.edu_kumoh_school()}
    </p>
  </li>
</ul>
