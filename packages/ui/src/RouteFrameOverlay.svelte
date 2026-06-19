<script lang="ts">
  import { closeOverlay } from './overlay-state.svelte.ts';

  let {
    overlayId,
    src,
    title = 'Settings',
    subtitle = null
  }: {
    overlayId: string;
    src: string;
    title?: string;
    subtitle?: string | null;
  } = $props();
</script>

<div class="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--color-background)] text-[var(--color-foreground)]">
  <div class="flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)]/92 px-4 py-3 backdrop-blur-sm">
    <div class="min-w-0">
      <h2 class="truncate text-[var(--text-lg)] font-semibold tracking-tight">{title}</h2>
      {#if subtitle}
        <p class="mt-1 text-[var(--text-sm)] text-[var(--color-muted-foreground)]">{subtitle}</p>
      {/if}
    </div>
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      onclick={() => closeOverlay(overlayId)}
      aria-label="Close settings popup"
      title="Close"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  </div>

  <div class="min-h-0 flex-1 bg-[var(--color-background)]">
    <iframe
      {src}
      title={title}
      class="h-full w-full border-0 bg-[var(--color-background)]"
    ></iframe>
  </div>
</div>
