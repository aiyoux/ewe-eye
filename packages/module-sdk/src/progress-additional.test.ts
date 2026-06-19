import { describe, expect, it } from 'vitest';
import type { AdditionalWithId } from './types.ts';
import {
  createProgressAdditional,
  getProgressAdditionalData,
  readProgressAdditional
} from './progress-additional.ts';

describe('progress-additional helpers', () => {
  it('reads flat NA check progress distinctly', () => {
    const additional = { id: 'pg1', type: 'pg', prog_type: { ch: 'na' } } as AdditionalWithId;

    expect(readProgressAdditional(additional)).toMatchObject({
      kind: 'check',
      value: 'NA'
    });
  });

  it('writes NA through the creation helper', () => {
    const additional = createProgressAdditional({ kind: 'check', value: 'NA' });

    expect((additional as any).prog_type.ch).toBe('na');
  });

  it('does not report NA as checked', () => {
    const additional = { id: 'pg1', type: 'pg', prog_type: { ch: 'na' } } as AdditionalWithId;

    expect(getProgressAdditionalData(additional)).toEqual({ checked: false });
  });

  it('reads flat WontDo check progress distinctly', () => {
    const additional = { id: 'pg1', type: 'pg', prog_type: { ch: 'wd' } } as AdditionalWithId;

    expect(readProgressAdditional(additional)).toMatchObject({
      kind: 'check',
      value: 'WontDo'
    });
  });

  it('writes WontDo through the creation helper', () => {
    const additional = createProgressAdditional({ kind: 'check', value: 'WontDo' });

    expect((additional as any).prog_type.ch).toBe('wd');
  });

  it('does not report WontDo as checked', () => {
    const additional = { id: 'pg1', type: 'pg', prog_type: { ch: 'wd' } } as AdditionalWithId;

    expect(getProgressAdditionalData(additional)).toEqual({ checked: false });
  });
});
