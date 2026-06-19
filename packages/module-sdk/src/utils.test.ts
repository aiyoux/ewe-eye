import { describe, it, expect } from 'vitest';
import { numeric_color_to_hex } from './utils.ts';

describe('numeric_color_to_hex', () => {
  it('should return undefined for undefined, null, or non-number inputs', () => {
    expect(numeric_color_to_hex(undefined)).toBeUndefined();
    expect(numeric_color_to_hex(null as any)).toBeUndefined();
    expect(numeric_color_to_hex('string' as any)).toBeUndefined();
  });

  it('should convert numeric colors to hex strings', () => {
    expect(numeric_color_to_hex(0xffffff)).toBe('#ffffff');
    expect(numeric_color_to_hex(0x000000)).toBe('#000000');
    expect(numeric_color_to_hex(0xff0000)).toBe('#ff0000');
    expect(numeric_color_to_hex(16711680)).toBe('#ff0000'); // 0xff0000 in decimal
  });

  it('should pad short hex values with leading zeros', () => {
    expect(numeric_color_to_hex(0xabc)).toBe('#000abc');
    expect(numeric_color_to_hex(0x1)).toBe('#000001');
    expect(numeric_color_to_hex(0)).toBe('#000000');
  });
});
