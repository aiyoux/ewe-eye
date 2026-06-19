<script lang="ts">
  import { cn } from './utils.ts';
  import { LoaderCircle } from '@lucide/svelte';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
  type Size = 'sm' | 'md' | 'lg' | 'icon';

  let {
    type = 'button',
    variant = 'primary',
    size = 'md',
    class: className = '',
    disabled = false,
    loading = false,
    onclick,
    children,
    ...rest
  }: {
    type?: 'button' | 'submit' | 'reset';
    variant?: Variant;
    size?: Size;
    class?: string;
    disabled?: boolean;
    loading?: boolean;
    onclick?: (event: MouseEvent) => void;
    children?: import('svelte').Snippet;
    [key: string]: any;
  } = $props();

  const variantClasses: Record<Variant, string> = {
    primary:
      'border border-blue-600 bg-blue-600 text-white shadow-sm hover:opacity-95',
    secondary:
      'border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-muted)]',
    ghost: 'bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-muted)]',
    danger:
      'bg-[var(--color-destructive)] text-white hover:opacity-95'
  };

  const sizeClasses: Record<Size, string> = {
    md: 'h-11 px-4 py-2 text-[var(--text-sm)]',
    sm: 'h-9 rounded-[var(--radius-sm)] px-3 text-[var(--text-xsm)]',
    lg: 'h-12 rounded-[var(--radius-md)] px-5 text-[var(--text-md)]',
    icon: 'h-11 w-11 rounded-[var(--radius-md)]'
  };
</script>


{#if rest.href}
  <a
    {...rest}
    {onclick}
    class={cn(
      'inline-flex appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-50',
      variantClasses[variant],
      sizeClasses[size],
      className
    )}
  >
    {#if children}
      {@render children()}
    {/if}
  </a>
{:else}
  <button
    {type}
    disabled={disabled || loading}
    {onclick}
    class={cn(
      'inline-flex appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-50',
      variantClasses[variant],
      sizeClasses[size],
      className
    )}
    {...rest}
  >
    {#if loading}
      <LoaderCircle class="size-4 animate-spin" />
    {/if}
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
