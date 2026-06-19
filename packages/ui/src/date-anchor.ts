import type { DateInformation } from '@modular-app/module-sdk';

export type DateDisplayStyle = 'mj' | 'mi' | 'sm' | 'n';

export interface DateAnchorAdditionalData {
  date_info: DateInformation;
  source_additional_id?: string;
  [key: string]: unknown;
}
