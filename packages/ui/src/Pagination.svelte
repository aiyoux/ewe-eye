<script lang="ts">
  import Button from './Button.svelte';
  import { cn } from './utils.ts';

  type PaginationToken = number | 'ellipsis-left' | 'ellipsis-right';

  let {
    page = $bindable(1),
    totalItems,
    pageSize = 25,
    siblingCount = 1,
    ariaLabel = 'Pagination',
    class: className = ''
  }: {
    page?: number;
    totalItems: number;
    pageSize?: number;
    siblingCount?: number;
    ariaLabel?: string;
    class?: string;
  } = $props();

  let totalPages = $derived(Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize))));

  $effect(() => {
    if (page < 1) {
      page = 1;
      return;
    }
    if (page > totalPages) {
      page = totalPages;
    }
  });

  function createTokens(total: number, current: number, siblings: number): PaginationToken[] {
    if (total <= 7 + siblings * 2) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const tokens: PaginationToken[] = [1];
    const left = Math.max(2, current - siblings);
    const right = Math.min(total - 1, current + siblings);

    if (left > 2) {
      tokens.push('ellipsis-left');
    }

    for (let value = left; value <= right; value += 1) {
      tokens.push(value);
    }

    if (right < total - 1) {
      tokens.push('ellipsis-right');
    }

    tokens.push(total);
    return tokens;
  }

  let tokens = $derived(createTokens(totalPages, page, siblingCount));
  let rangeStart = $derived(totalItems === 0 ? 0 : (page - 1) * pageSize + 1);
  let rangeEnd = $derived(totalItems === 0 ? 0 : Math.min(totalItems, page * pageSize));

  function goTo(next: number) {
    if (next < 1 || next > totalPages || next === page) return;
    page = next;
  }
</script>

<div class={cn('flex flex-col gap-3 md:flex-row md:items-center md:justify-between', className)}>
  <div class="text-[var(--text-xsm)] text-[var(--color-muted-foreground)]">
    Showing {rangeStart}-{rangeEnd} of {totalItems}
  </div>

  <nav aria-label={ariaLabel} class="flex items-center gap-1">
    <Button variant="secondary" size="sm" disabled={page <= 1} onclick={() => goTo(page - 1)}>
      Previous
    </Button>

    {#each tokens as token (String(token))}
      {#if typeof token === 'number'}
        <Button
          variant={token === page ? 'primary' : 'ghost'}
          size="sm"
          onclick={() => goTo(token)}
          aria-current={token === page ? 'page' : undefined}
        >
          {token}
        </Button>
      {:else}
        <span class="px-2 text-[var(--text-xsm)] text-[var(--color-muted-foreground)]">…</span>
      {/if}
    {/each}

    <Button variant="secondary" size="sm" disabled={page >= totalPages} onclick={() => goTo(page + 1)}>
      Next
    </Button>
  </nav>
</div>
