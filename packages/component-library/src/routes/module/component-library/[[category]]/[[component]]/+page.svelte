<script lang="ts">
  import { page } from '$app/state';
  import ComponentLibraryPage from '../../../../ComponentLibraryPage.svelte';

  const segments = $derived(
    page.url.pathname
      .replace(/^\/module\/component-library/, '')
      .split('/')
      .filter(Boolean)
  );

  const pageData = $derived({
    id: 'component-library',
    title: 'Component Library',
    description: 'Standalone component library app.',
    summary: 'Showcase custom app components layered on top of the default UI primitives.',
    segments
  });
</script>

<ComponentLibraryPage data={pageData} />
