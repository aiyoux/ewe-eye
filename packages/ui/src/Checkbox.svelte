<script lang="ts">
  import { Minus } from '@lucide/svelte';
  import { cn } from './utils.ts';

  let {
    checked = $bindable(false),
    indeterminate = $bindable(false),
    disabled = false,
    class: className = '',
    labelClass = '',
    hint = '',
    children,
    onchange
  }: {
    checked?: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    class?: string;
    labelClass?: string;
    hint?: string;
    children?: import('svelte').Snippet;
    onchange?: (checked: boolean) => void;
  } = $props();

  let inputRef = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (inputRef) inputRef.indeterminate = indeterminate;
  });

  function handleChange(e: Event) {
    const target = e.target as HTMLInputElement;
    indeterminate = false;
    checked = target.checked;
    onchange?.(checked);
  }
</script>

<label class={cn('group flex items-start gap-2.5 cursor-pointer select-none', disabled && 'cursor-not-allowed opacity-60', className)}>
  <input
    bind:this={inputRef}
    type="checkbox"
    {checked}
    {disabled}
    onchange={handleChange}
    class="peer sr-only"
  />
  <span
    aria-hidden="true"
    class={cn(
      'mt-0.5 inline-flex size-[var(--text-lg)] shrink-0 items-center justify-center rounded-[2px] border border-[var(--color-border)] transition-all duration-300',
      'bg-[color-mix(in_srgb,var(--color-input),white_8%)] text-[var(--color-foreground)]',
      'group-hover:bg-[color-mix(in_srgb,var(--color-input),var(--color-primary)_10%)] group-hover:border-[color-mix(in_srgb,var(--color-border),var(--color-primary)_30%)]',
      (checked || indeterminate) && 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] group-hover:bg-[var(--color-primary)] group-hover:border-[var(--color-primary)]',
      'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-background)]',
      disabled && 'group-hover:bg-[color-mix(in_srgb,var(--color-input),white_8%)] group-hover:border-[var(--color-border)]'
    )}
  >
    {#if indeterminate}
      <span
        class={cn(
          'inline-flex items-center justify-center transition-all duration-200 ease-out',
          indeterminate ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        )}
      >
        <Minus class="size-[var(--text-md)]" strokeWidth={3} />
      </span>
    {:else}
      <span
        class={cn(
          'inline-flex items-center justify-center transition-all duration-200 ease-out',
          checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        )}
      >
        <svg class="size-[var(--text-md)]" viewBox="0 0 4.7624998 3.70893" aria-hidden="true">
          <path
            d="m 4.7625,0.33999 -2.95275,3.36894 -1.80975,-1.59227 0.34899,-0.39423 1.41313,1.23984 2.61012,-2.96227 z"
            fill="currentColor"
          />
        </svg>
      </span>
    {/if}
  </span>
  {#if children || hint}
    <span class={cn('grid gap-0.5', labelClass)}>
      {#if children}
        <span class="font-medium">
          {@render children()}
        </span>
      {/if}
      {#if hint}
        <span class="text-[var(--text-xsm)] text-muted-foreground">{hint}</span>
      {/if}
    </span>
  {/if}
</label>
