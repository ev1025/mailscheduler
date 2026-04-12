export type RepeatType = "none" | "weekly" | "monthly" | "yearly";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  color: string;
  tag: string | null;
  repeat: RepeatType | null;
  sort_order?: number;
  created_at: string;
}

export interface EventTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  type: "income" | "expense";
}

export interface Expense {
  id: string;
  amount: number;
  category_id: string;
  description: string | null;
  date: string;
  type: "income" | "expense";
  payment_method: string;
  created_at: string;
  category?: ExpenseCategory;
}

export interface Memo {
  id: string;
  title: string;
  content: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplement {
  id: string;
  name: string;
  type: string | null;
  price: number | null;
  ranking: number | null;
  link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TravelCategory = "자연" | "숙소" | "식당" | "놀거리" | "기타";

export interface TravelItem {
  id: string;
  title: string;
  in_season: boolean;
  region: string | null;
  category: TravelCategory;
  visited: boolean;
  tag: string | null;
  notes: string | null;
  month: number | null;
  color: string;
  visited_dates: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TravelTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface WeatherData {
  date: string;
  temperature_min: number;
  temperature_max: number;
  weather_icon: string;
  weather_description: string;
}
