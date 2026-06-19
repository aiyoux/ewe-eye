import { describe, expect, it } from 'vitest';
import {
  buildScopeSurql,
  chooseScopeStrategy,
  decodeScopeFilter,
  encodeScopeFilter,
  evaluateFilter,
  type ScopeFilter
} from './scope-filter.ts';

describe('scope filter URL encoding', () => {
  it('round-trips compact all/in/not_in filters', () => {
    const filter: ScopeFilter = {
      strategy: 'bottom-up',
      root: {
        kind: 'all',
        nodes: [
          { kind: 'in', ids: ['records:a', 'b', 'b'] },
          { kind: 'not_in', ids: ['c'] }
        ]
      }
    };

    const encoded = encodeScopeFilter(filter);
    expect(encoded).toBe('s=bottom-up;in:a,b;not_in:c');
    expect(decodeScopeFilter(encoded)).toEqual({
      strategy: 'bottom-up',
      root: {
        kind: 'all',
        nodes: [
          { kind: 'in', ids: ['a', 'b'] },
          { kind: 'not_in', ids: ['c'] }
        ]
      }
    });
  });

  it('round-trips nested groups through base64 JSON', () => {
    const filter: ScopeFilter = {
      strategy: 'auto',
      root: {
        kind: 'any',
        nodes: [
          { kind: 'in', ids: ['a'] },
          {
            kind: 'all',
            nodes: [
              { kind: 'in', ids: ['b'] },
              { kind: 'not_in', ids: ['c'] }
            ]
          }
        ]
      }
    };

    const encoded = encodeScopeFilter(filter);
    expect(encoded).toMatch(/^b64=/);
    expect(decodeScopeFilter(encoded)).toEqual(filter);
  });

  it('returns an empty filter for invalid input', () => {
    expect(decodeScopeFilter('b64=not-valid')).toEqual({ strategy: 'auto', root: null });
    expect(encodeScopeFilter({ strategy: 'auto', root: { kind: 'in', ids: [] } })).toBeNull();
  });
});

describe('scope filter client evaluation', () => {
  const ancestors = (id: string) => {
    const map: Record<string, string[]> = {
      child: ['parent', 'root'],
      sibling: ['root'],
      outside: []
    };
    return map[id] ?? [];
  };

  it('evaluates nested include and exclude clauses', () => {
    const filter: ScopeFilter = {
      strategy: 'auto',
      root: {
        kind: 'all',
        nodes: [
          { kind: 'in', ids: ['root'] },
          { kind: 'not_in', ids: ['parent'] }
        ]
      }
    };

    expect(evaluateFilter(filter, 'child', { ancestors })).toBe(false);
    expect(evaluateFilter(filter, 'sibling', { ancestors })).toBe(true);
    expect(evaluateFilter(filter, 'outside', { ancestors })).toBe(false);
  });
});

describe('scope filter SurQL builder', () => {
  it('uses bound variables for top-down record IDs', () => {
    const fragment = buildScopeSurql({
      strategy: 'top-down',
      root: { kind: 'in', ids: ['safe', 'unsafe); DELETE records; --'] }
    }, 'id');

    expect(fragment.preamble).toEqual([
      'LET $scope_set_0 = fn::find_all_child_records_any_type(<array<record>>$scope_ids_0, [], {}, [], NONE, NONE);'
    ]);
    expect(fragment.whereExpr).toBe('(id INSIDE $scope_set_0 OR id INSIDE <array<record>>$scope_ids_0)');
    expect(fragment.vars).toEqual({
      scope_ids_0: ['records:safe', 'records:unsafe); DELETE records; --']
    });
    expect(fragment.selectedStrategy).toBe('top-down');
  });

  it('builds bottom-up expressions without a preamble', () => {
    const fragment = buildScopeSurql({
      strategy: 'bottom-up',
      root: { kind: 'not_in', ids: ['excluded'] }
    }, '$this.id');

    expect(fragment.preamble).toEqual([]);
    expect(fragment.whereExpr).toBe('!(fn::is_under_scope($this.id, <array<record>>$scope_ids_0))');
    expect(fragment.vars).toEqual({ scope_ids_0: ['records:excluded'] });
    expect(fragment.selectedStrategy).toBe('bottom-up');
  });

  it('auto uses top-down for simple positive scopes', () => {
    const filter: ScopeFilter = {
      strategy: 'auto',
      root: { kind: 'in', ids: ['a', 'b'] }
    };

    expect(chooseScopeStrategy(filter)).toBe('top-down');
    expect(buildScopeSurql(filter, 'id').selectedStrategy).toBe('top-down');
  });

  it('auto uses bottom-up for composite and exclusion-heavy scopes', () => {
    const composite: ScopeFilter = {
      strategy: 'auto',
      root: {
        kind: 'any',
        nodes: [
          { kind: 'in', ids: ['a'] },
          { kind: 'not_in', ids: ['b'] }
        ]
      }
    };
    const exclusionHeavy: ScopeFilter = {
      strategy: 'auto',
      root: {
        kind: 'all',
        nodes: [
          { kind: 'not_in', ids: ['a'] },
          { kind: 'not_in', ids: ['b'] },
          { kind: 'in', ids: ['c'] }
        ]
      }
    };

    expect(chooseScopeStrategy(composite)).toBe('bottom-up');
    expect(buildScopeSurql(composite, 'id').preamble).toEqual([]);
    expect(chooseScopeStrategy(exclusionHeavy)).toBe('bottom-up');
  });
});
