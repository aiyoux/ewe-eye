import { describe, expect, it } from 'vitest';
import { buildSurrealStatement, buildSurrealQuery, extractQueryRows } from './surrealql.ts';

describe('surrealql helpers', () => {
  it('builds a single SurrealQL statement with LET bindings for null-safe vars', () => {
    expect(
      buildSurrealStatement('SELECT * FROM records WHERE when = $time', {
        time: null,
        year: 2026,
        label: 'work'
      })
    ).toBe(
      'LET $time = none;\nLET $year = 2026;\nLET $label = "work";\nSELECT * FROM records WHERE when = $time'
    );
  });

  it('extracts rows from HTTP /sql nested result arrays', () => {
    expect(
      extractQueryRows([
        { result: null },
        { result: [{ id: 'records:1' }, { id: 'records:2' }] }
      ])
    ).toEqual([{ id: 'records:1' }, { id: 'records:2' }]);
  });

  it('extracts rows from websocket plain row arrays', () => {
    expect(
      extractQueryRows([{ id: 'records:1' }, { id: 'records:2' }])
    ).toEqual([{ id: 'records:1' }, { id: 'records:2' }]);
  });

  it('buildSurrealQuery returns a structured query object', () => {
    const sql = 'SELECT * FROM test WHERE id = $id';
    const vars = { id: 1 };
    expect(buildSurrealQuery(sql, vars)).toEqual({ sql, vars });
  });
});
