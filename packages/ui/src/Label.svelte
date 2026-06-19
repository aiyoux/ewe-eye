<script lang="ts">
  import { cn } from './utils.ts';

  let {
    for: htmlFor,
    class: className = '',
    required = false,
    children
  }: {
    for?: string;
    class?: string;
    required?: boolean;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<label
  for={htmlFor}
  class={cn(
    'text-[var(--text-xsm)] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]',
    className
  )}
>
  {#if children}
    {@render children()}
  {/if}
  {#if required}
    <span class="ml-1 text-[var(--color-destructive)]">*</span>
  {/if}
</label>
