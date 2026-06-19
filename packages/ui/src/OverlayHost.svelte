<script lang="ts">
  import { getActiveOverlay, closeOverlay } from './overlay-state.svelte.ts';
  import { DEFAULT_PORTAL_ROOT_ID } from './portal.ts';
  import OverlayFrame from './OverlayFrame.svelte';

  const overlay = $derived(getActiveOverlay());

  function dismissOverlay() {
    if (!overlay) return;
    closeOverlay(overlay.id);
  }

  $effect(() => {
    if (typeof window === 'undefined' || !overlay || overlay.closeOnEscape === false) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissOverlay();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<div id={DEFAULT_PORTAL_ROOT_ID} class="pointer-events-none fixed inset-0 [z-index:var(--z-popover)]"></div>

{#if overlay}
  <OverlayFrame {overlay} />
{/if}
