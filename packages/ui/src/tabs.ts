export interface TabItem {
  value: string;
  label: string;
  icon?: any;
  disabled?: boolean;
  onClose?: () => void;
}
