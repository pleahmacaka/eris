<script lang="ts">
  import Gallery from "@eris/community/Gallery.svelte"
  import { STUDIO, THEME_SUBMIT } from "$lib/links"
</script>

<Gallery
  lang="ko"
  studio={STUDIO}
  home="../"
  submit={THEME_SUBMIT}
  languages={[
    { code: "en", label: "English", href: "../../themes/" },
    { code: "ko", label: "한국어", href: "./" },
  ]}
/>
