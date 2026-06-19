<script lang="ts">
  import type { OverlayDescriptor } from './overlay-state.svelte.ts';
  import { closeOverlay } from './overlay-state.svelte.ts';

  let { overlay }: { overlay: OverlayDescriptor | null } = $props();
  let previousOverlay = $state<OverlayDescriptor | null>(null);

  $effect(() => {
    if (overlay) {
      previousOverlay = overlay;
    }
  });

  const activeOverlay = $derived(overlay ?? previousOverlay);
  const OverlayComponent = $derived(activeOverlay?.component ?? null);

  function dismissOverlay() {
    if (activeOverlay) {
      closeOverlay(activeOverlay.id);
    }
  }
</script>

{#if activeOverlay && OverlayComponent}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 [z-index:var(--z-modal)]">
  <div
    class={`absolute inset-0 ${activeOverlay.backdropClass ?? 'bg-black/40'}`}
    onclick={() => {
      if (activeOverlay.closeOnBackdrop !== false) {
        dismissOverlay();
      }
    }}
  ></div>

  <div
    class={`absolute inset-0 flex pointer-events-none ${activeOverlay.shellClass ?? 'items-center justify-center p-4'}`}
    style={activeOverlay.shellStyle}
  >
    <div class={`pointer-events-auto ${activeOverlay.panelClass ?? ''}`} style={activeOverlay.panelStyle}>
      <OverlayComponent {...(activeOverlay.props ?? {})} />
    </div>
  </div>
</div>
{/if}
