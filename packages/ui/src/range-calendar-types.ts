export enum RangeCalendarLayout {
  Month = 'Month'
}

export enum RangeCalendarOutlineStyle {
  None = 'None',
  Month = 'Month',
  Year = 'Year'
}

export interface RangeCalendarViewOptions {
  layout: RangeCalendarLayout;
  first_day_of_week?: number;
  grey_weekday_mask?: number;
  outline_style?: RangeCalendarOutlineStyle;
  show_week_outline?: boolean;
  show_cell_outline?: boolean;
  show_days_outside_month?: boolean;
  highlight_today?: boolean;
}

export interface RangeCalendarGridData {
  date: Date;
  event_slots: unknown[];
  minor_event_slots: unknown[];
  mini_event_slots: unknown[];
  statuses: unknown[];
  mini_statuses: unknown[];
  in_current_month: boolean;
}
