<script lang="ts">
  import type { AppRuntime } from '@modular-app/module-sdk';
  import { isProgressAdditional } from '@modular-app/module-sdk';

  let {
    additionals = [],
    runtime = null,
    itemId = null
  }: {
    additionals?: any[];
    runtime?: AppRuntime | null | undefined;
    itemId?: string | null;
  } = $props();

  function formatCurrency(minor: number, currency: string): string {
    const major = (minor / 100).toFixed(2);
    return `${currency} ${major}`;
  }

  function labelForAdditional(additional: any): string | null {
    if (typeof additional !== 'object' || additional === null) return null;

    const type = additional.type;

    // Progress is rendered separately in RecordTreeView
    if (type === 'pg') return null;

    // Date additional
    if (type === 'date') {
      const dateInfo = additional.date_info;
      if (dateInfo && typeof dateInfo === 'object') {
        const tr = dateInfo.value;
        if (tr && typeof tr === 'object') {
          if (typeof tr.date === 'string') return tr.date;
          if (typeof tr.start === 'string') return tr.start;
          if (typeof tr.base === 'string') return tr.base;
        }
        if (typeof dateInfo.value === 'string') return dateInfo.value;
      }
      return null;
    }

    // Distance additional
    if (type === 'distance') {
      const val = additional.value;
      const unit = additional.unit;
      if (typeof val === 'number' && typeof unit === 'string') {
        return `${val} ${unit}`;
      }
      const meters = additional.meters;
      if (typeof meters === 'number') {
        return `${meters} m`;
      }
      return null;
    }

    // Duration additional
    if (type === 'duration') {
      const val = additional.value;
      const unit = additional.unit;
      if (typeof val === 'number' && typeof unit === 'string') {
        return `${val} ${unit}`;
      }
      const seconds = additional.seconds;
      if (typeof seconds === 'number') {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        if (m > 0) return `${m}m`;
        return `${seconds}s`;
      }
      return null;
    }

    // Transaction additional
    if (type === 'transaction') {
      const amount = additional.amount_minor;
      const currency = additional.currency;
      if (typeof amount === 'number' && typeof currency === 'string') {
        const major = (amount / 100).toFixed(2);
        const sign = additional.debit_credit === 'debit' ? '-' : '+';
        return `${sign}${currency} ${major}`;
      }
      return null;
    }

    // Exercise Performance additional
    if (type === 'exercise_performance') {
      const { modality, weight, weight_unit, reps, repeat_count, distance, distance_unit, duration, duration_unit } = additional;
      if (modality === 'Strength' || modality === 'Calisthenics') {
        const parts = [];
        if (weight != null) parts.push(`${weight}${weight_unit || 'kg'}`);
        if (reps != null) parts.push(`${reps} reps`);
        if (repeat_count != null && repeat_count > 1) parts.push(`x ${repeat_count} sets`);
        return parts.length > 0 ? parts.join(' ') : 'Workout logged';
      }
      if (modality === 'Endurance') {
        const parts = [];
        if (distance != null) parts.push(`${distance}${distance_unit || 'km'}`);
        if (duration != null) parts.push(`in ${duration}${duration_unit || 'min'}`);
        return parts.length > 0 ? parts.join(' ') : 'Workout logged';
      }
      return 'Workout logged';
    }

    // Map Element additional
    if (type === 'map_element') {
      const kind = additional.kind || 'Custom';
      const geomType = additional.geometry?.type || 'Element';
      return `[${kind}: ${geomType}]`;
    }

    // Account balance additional
    if (type === 'account_balance') {
      const amount = additional.balance_minor;
      const currency = additional.currency;
      if (typeof amount === 'number' && typeof currency === 'string') {
        return formatCurrency(amount, currency);
      }
      return null;
    }

    // Fallback for generic / legacy shapes
    const value = additional.value ?? additional.name ?? additional.label ?? additional.currency;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return null;
  }
</script>

{#if additionals && additionals.length > 0}
  <div class="flex items-center gap-1 overflow-hidden shrink-0">
    {#each additionals as add (add.id ?? add.type)}
      {#if !isProgressAdditional(add)}
        {@const label = labelForAdditional(add)}
        {#if label}
          <div
            class="text-[0.65rem] px-1.5 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-foreground)] flex items-center max-w-[80px] truncate"
            title={add.type}
          >
            <span class="truncate">{label}</span>
          </div>
        {/if}
      {/if}
    {/each}
  </div>
{/if}
