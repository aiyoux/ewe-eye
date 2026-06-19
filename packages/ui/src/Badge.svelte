<script lang="ts">
  import { cn } from './utils.ts';

  type Variant = 'info' | 'success' | 'warn' | 'error' | 'neutral';
  type Size = 'sm' | 'md';

  let {
    variant = 'info',
    size = 'md',
    class: className = '',
    children,
    ...rest
  }: {
    variant?: Variant;
    size?: Size;
    class?: string;
    children?: import('svelte').Snippet;
    [key: string]: any;
  } = $props();

  const classes: Record<Variant, string> = {
    info: 'bg-[var(--color-primary)]/12 text-[var(--color-primary)]',
    success: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
    warn: 'bg-[var(--color-warning)]/18 text-[var(--color-foreground)]',
    error: 'bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]',
    neutral: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
  };

  const sizeClasses: Record<Size, string> = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-[var(--text-xsm)]'
  };
</script>

<span
  class={cn(
    'inline-flex items-center rounded-full font-medium',
    classes[variant],
    sizeClasses[size],
    className
  )}
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
</span>
