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
  series_id?: string | null; // 반복 일정 시리즈 묶음 ID (null이면 단일)
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

// --- Products (생필품: 영양제 포함 통합) ---
// 사용자가 임의 추가 가능 → 기본값은 '영양제/화장품/단백질/음식/생필품/구독/기타'.
export type ProductCategory = string;

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  sub_category: string | null;
  brand: string | null;
  notes: string | null;
  is_active: boolean;
  monthly_cost: number | null;
  monthly_consumption: number;
  default_payment_day: number;
  link: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductPurchase {
  id: string;
  product_id: string;
  total_price: number;
  points: number;
  quantity: number;
  quantity_unit: string;
  purchased_at: string;
  store: string | null;
  link: string | null;
  notes: string | null;
  created_at: string;
}

// 기존 Supplement 유지(fallback 호환)
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

// --- Travel (데이트 확장) ---
export type TravelCategory =
  | "자연"
  | "숙소"
  | "식당"
  | "놀거리"
  | "데이트"
  | "공연"
  | "쇼핑"
  | "기타";

export type TravelMood = "로맨틱" | "캐주얼" | "활동적" | "조용";

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
  mood: TravelMood | null;
  price_tier: number | null;
  rating: number | null;
  couple_notes: string | null;
  cover_image_url: string | null;
  // (구) 단일 위치 — 호환을 위해 유지, 새 코드에선 places 사용
  place_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  // 여러 위치 태그 — 네이버 지도 검색으로 채움
  places: PlaceInfo[];
  created_at: string;
  updated_at: string;
}

export interface PlaceInfo {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

// 여행 계획 (travel_plans + travel_plan_tasks)
// taxi 는 UI 에선 '승용차' 로 car 와 통합 표시되나 하위호환 위해 타입 유지.
export type TransportMode = "car" | "walk" | "bus" | "taxi" | "train";

export interface TravelPlan {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TravelPlanTask {
  id: string;
  plan_id: string;
  day_index: number;
  start_time: string | null;    // "HH:MM" 또는 null
  place_name: string;
  place_address: string | null;
  place_lat: number | null;
  place_lng: number | null;
  tag: string | null;       // 태그(복수, 콤마 구분)
  category?: string | null; // 분류(단일) — SQL 마이그(supabase-travel-plan-category) 후 활성
  content: string | null;
  stay_minutes: number;
  manual_order: number;
  transport_mode: TransportMode | null;
  transport_duration_sec: number | null;
  transport_manual: boolean;
  // 수단별 소요시간 캐시 (초). SQL 마이그레이션(supabase-travel-leg-durations.sql)
  // 실행 후부터 채워짐. 옵셔널 유지하여 컬럼 없는 구 DB 에서도 동작.
  // 예: { car: 3900, bus: 7200, taxi: 3900, train: null }
  transport_durations?: Partial<Record<TransportMode, number | null>> | null;
  created_at: string;
}

export interface TravelTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

// --- Knowledge Base ---
export interface KnowledgeFolder {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export type KnowledgeItemType = "note" | "link" | "snippet" | "recipe";

export interface KnowledgeItem {
  id: string;
  folder_id: string | null;
  title: string;
  content: string | null;
  excerpt: string | null;
  tags: string[] | null;
  pinned: boolean;
  type: KnowledgeItemType;
  url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeatherData {
  date: string;
  temperature_min: number;
  temperature_max: number;
  weather_icon: string;
  weather_description: string;
}
