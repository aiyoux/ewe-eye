<script lang="ts">
  import { cn } from './utils.ts';

  let {
    class: className = '',
    children
  }: {
    class?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<section
  class={cn(
    'surface-panel rounded-[calc(var(--radius-sm)-0.1rem)] p-2.5 md:p-3',
    className
  )}
>
  {#if children}
    {@render children()}
  {/if}
</section>
