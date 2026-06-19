import { describe, expect, it } from 'vitest';
import type { Item } from './types.ts';
import { optimisticCacheItemFromItem } from './optimistic-cache.ts';

describe('optimisticCacheItemFromItem', () => {
  it('creates the standard pending cache shape without dropping lineage fields', () => {
    const item: Item = {
      id: 'temp:1',
      text: 'Clone',
      show_as_header: true,
      custom_color: 4,
      copied_from_record: 'records:source',
      original_template_id: 'records:source',
      additionals: [{ id: 'd1', type: 'date', date_info: { is_status: false, value: {} } }],
      module_settings: { planner: { enabled: true } },
      permissions: [{ role: 'viewer', user_id: 'user:1' }]
    };

    expect(optimisticCacheItemFromItem(item)).toEqual({
      id: 'temp:1',
      text: 'Clone',
      show_as_header: true,
      custom_color: 4,
      copied_from_record: 'records:source',
      original_template_id: 'records:source',
      is_temp: true,
      dirty: true,
      sync_status: 'pending',
      additionals: item.additionals,
      settings: undefined,
      module_settings: item.module_settings,
      permissions: item.permissions
    });
  });

  it('allows targeted cache metadata overrides', () => {
    const item: Item = { id: 'records:1', text: 'Accepted' };

    expect(optimisticCacheItemFromItem(item, {
      is_temp: false,
      dirty: false,
      sync_status: 'accepted',
      version: 2
    })).toMatchObject({
      id: 'records:1',
      is_temp: false,
      dirty: false,
      sync_status: 'accepted',
      version: 2
    });
  });
});
