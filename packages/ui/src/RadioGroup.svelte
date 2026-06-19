<script lang="ts">
  import { cn } from './utils.ts';
  import type { RadioGroupOption } from './radio-group.ts';

  let {
    value = $bindable<string | number>(),
    options = [],
    orientation = 'vertical',
    ariaLabel,
    class: className = ''
  }: {
    value?: string | number;
    options?: RadioGroupOption<string | number>[];
    orientation?: 'horizontal' | 'vertical';
    ariaLabel?: string;
    class?: string;
  } = $props();

  function selectOption(option: RadioGroupOption<string | number>) {
    if (option.disabled) return;
    value = option.value;
  }
</script>

<div
  role="radiogroup"
  aria-label={ariaLabel}
  class={cn(
    orientation === 'horizontal' ? 'flex flex-wrap items-stretch gap-1' : 'grid gap-1',
    className
  )}
>
  {#each options as option (String(option.value))}
    {@const selected = value === option.value}
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={option.disabled}
      class={cn(
        'appearance-none rounded px-2 py-1 text-left text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'bg-primary/15 text-primary font-semibold'
          : 'text-muted-foreground hover:text-foreground',
        orientation === 'horizontal' && 'min-w-[3.25rem] flex-1'
      )}
      onclick={() => selectOption(option)}
    >
      {option.label}
    </button>
  {/each}
</div>
