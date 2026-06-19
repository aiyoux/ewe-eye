import type { Component } from 'svelte';

export interface SegmentedControlOption<T extends string | number = string> {
  value: T;
  label: string;
  hideLabel?: boolean;
  disabled?: boolean;
  icon?: Component<{ class?: string }>;
  href?: string;
}
