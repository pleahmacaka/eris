<script lang="ts">
import { contextMenu } from "#lib/attachments/contextMenu.js"
import Avatar from "#lib/components/ui/Avatar.svelte"
import PresenceDot from "#lib/components/ui/PresenceDot.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { isOnline } from "#lib/matrix/members.js"
import { userSections } from "#lib/menu/actions.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { profileCardStore } from "#lib/store/profileCard.svelte.js"
</script>

<aside
  class="panel-surface flex h-full w-full flex-col overflow-y-auto border-base-content/10 border-s px-2 py-3"
  aria-label={i18n.t("chat.members.list")}
>
  {#each chatStore.memberGroups as group (group.role)}
    <p class="flex items-center gap-2 px-2 pt-4 pb-1 font-semibold text-subtle text-xs">
      <span>{i18n.t(group.label)}</span>
      <span class="tabular-nums">{i18n.format.number(group.members.length)}</span>
    </p>
    <ul class="flex flex-col">
      {#each group.members as member (member.userId)}
        <li>
          <button
            type="button"
            class={[
              "flex h-10.5 w-full cursor-pointer items-center gap-3 rounded-field px-2 text-start",
              "hover:bg-base-content/5",
              !isOnline(member.presence) && "opacity-50",
            ]}
            title={member.userId}
            onclick={event => profileCardStore.open(member.userId, event.currentTarget)}
            {@attach contextMenu(() => userSections(member, true))}
          >
            <span class="relative shrink-0">
              <Avatar name={member.name} mxc={member.avatarUrl} size="sm" />
              <PresenceDot presence={member.presence} class="border-base-200" />
            </span>
            <span class="min-w-0 flex-1 truncate font-medium text-md">{member.name}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/each}
</aside>
