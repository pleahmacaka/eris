<script lang="ts">
  import { goto } from "$app/navigation"
  import CalendarView from "$lib/components/calendar/CalendarView.svelte"
  import TopBar from "$lib/components/ui/TopBar.svelte"
</script>

<TopBar title="캘린더" wide />

<main class="flex min-h-0 flex-1 flex-col">
  <CalendarView openDay={day => goto(`/todos?day=${day}`)} />
</main>
