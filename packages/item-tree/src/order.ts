/**
 * Calculates a fractional order value midway between two sibling order values.
 * Used for drag-and-drop reordering and appending children without rewriting
 * every sibling's order.
 */
export function calculateMidOrder(beforeOrder: number | null, afterOrder: number | null): number {
  if (beforeOrder === null && afterOrder === null) return 0;
  if (beforeOrder === null && afterOrder !== null) return afterOrder - 16384;
  if (beforeOrder !== null && afterOrder === null) return beforeOrder + 16384;
  if (beforeOrder !== null && afterOrder !== null) {
    return (beforeOrder + afterOrder) / 2.0;
  }
  return 0;
}
