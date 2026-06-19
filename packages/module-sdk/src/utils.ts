/**
 * Backends often map colors natively to packed u16 indices or standard DOM hexes encoded as decimal int.
 * Converts a standard integer payload into a readable DOM hex boundary.
 */
export function numeric_color_to_hex(colorVal: number | undefined): string | undefined {
  if (colorVal === undefined || colorVal === null || typeof colorVal !== 'number') return undefined;

  let hex = colorVal.toString(16);
  while (hex.length < 6) hex = '0' + hex;
  return '#' + hex;
}
