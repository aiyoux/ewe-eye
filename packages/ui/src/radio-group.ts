export interface RadioGroupOption<T extends string | number = string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}
