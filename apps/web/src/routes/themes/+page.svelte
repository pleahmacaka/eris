<script lang="ts">
  import Gallery from "@eris/community/Gallery.svelte"
  import { STUDIO, THEME_SUBMIT } from "$lib/links"
</script>

<Gallery
  lang="en"
  studio={STUDIO}
  home="../"
  submit={THEME_SUBMIT}
  languages={[
    { code: "en", label: "English", href: "./" },
    { code: "ko", label: "한국어", href: "../ko/themes/" },
  ]}
/>
