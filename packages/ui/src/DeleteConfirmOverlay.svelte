<script lang="ts">
  import Button from './Button.svelte';

  let { text, onConfirm, onCancel, title = "Delete this record?" } = $props<{
    text: string;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
  }>();
</script>

<div
  class="w-full max-w-sm rounded-[var(--radius-lg)] border bg-[var(--color-background)] p-5 shadow-2xl space-y-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-dialog-title"
>
  <div class="space-y-1">
    <div id="delete-dialog-title" class="text-base font-semibold">{title}</div>
    <div class="text-sm text-muted-foreground">
      "{text}" will be removed from the database entirely — this affects every view it appears in.
    </div>
  </div>
  <div class="flex justify-end gap-2">
    <Button
      variant="secondary"
      onclick={onCancel}
    >
      Cancel
    </Button>
    <Button
      variant="danger"
      onclick={onConfirm}
    >
      Delete record
    </Button>
  </div>
</div>
