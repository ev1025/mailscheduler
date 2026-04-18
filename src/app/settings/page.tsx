"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Monitor, Sun, Moon, ChevronDown, ChevronRight, ExternalLink, MapPin, Search } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import {
  useWeatherLocation,
  setWeatherLocation,
  searchLocation,
  type GeoResult,
} from "@/hooks/use-weather-location";
import { useAppSetting } from "@/hooks/use-app-settings";
import { toast } from "sonner";

type Theme = "system" | "light" | "dark";

function ApiSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg">
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {title}
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t">{children}</div>}
    </div>
  );
}

// 단일 키 입력 필드 — app_settings 에 key-value 로 저장.
// secret 값은 저장 후엔 마스킹해서 보여주고, 수정하려면 "변경" 눌러 다시 입력.
function SecretKeyField({
  settingKey,
  label,
  placeholder,
  masked = false,
}: {
  settingKey: string;
  label: string;
  placeholder?: string;
  masked?: boolean;
}) {
  const { value, loading, saveValue } = useAppSetting(settingKey, "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!loading && !value) setEditing(true);
  }, [loading, value]);

  if (loading) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="h-9 rounded-md bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (!editing) {
    const display = masked && value ? value.slice(0, 4) + "••••••••" : value;
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-9 rounded-md border bg-muted/30 px-3 text-xs flex items-center font-mono truncate">
            {display || "(미설정)"}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
          >
            변경
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type={masked ? "password" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="h-9 text-xs font-mono flex-1"
        />
        <Button
          type="button"
          size="sm"
          className="h-9"
          onClick={async () => {
            await saveValue(draft.trim());
            setEditing(false);
            toast.success(`${label} 저장됨`);
          }}
          disabled={!draft.trim()}
        >
          저장
        </Button>
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9"
            onClick={() => {
              setEditing(false);
              setDraft("");
            }}
          >
            취소
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "api">("general");
  const [theme, setTheme] = useState<Theme>("system");
  const currentLocation = useWeatherLocation();
  const [locQuery, setLocQuery] = useState("");
  const [locResults, setLocResults] = useState<GeoResult[]>([]);
  const [locSearching, setLocSearching] = useState(false);

  useEffect(() => {
    if (!locQuery.trim()) {
      setLocResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLocSearching(true);
      const results = await searchLocation(locQuery);
      if (!cancelled) {
        setLocResults(results);
        setLocSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locQuery]);

  const pickLocation = (r: GeoResult) => {
    setWeatherLocation({
      name: r.name + (r.admin1 ? ` (${r.admin1})` : ""),
      lat: r.latitude,
      lon: r.longitude,
      country: r.country_code,
    });
    setLocQuery("");
    setLocResults([]);
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  const applyTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem("theme", t);
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else if (t === "light") root.classList.remove("dark");
    else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  };

  const kmaExpiry = "2028-04-12";
  const holidayExpiry = "2028-04-18";
  const daysLeft = Math.ceil((new Date(kmaExpiry).getTime() - Date.now()) / 86400000);
  const holidayDaysLeft = Math.ceil((new Date(holidayExpiry).getTime() - Date.now()) / 86400000);

  // 만료 2개월(60일) 전부터 알림
  const kmaWarning = daysLeft <= 60 && daysLeft > 0;
  const holidayWarning = holidayDaysLeft <= 60 && holidayDaysLeft > 0;

  return (
    <>
      <PageHeader title="설정" showBack />
    <div className="p-4 md:p-6 max-w-2xl">

      {/* 탭 */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "general" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("general")}
        >
          일반
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "api" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("api")}
        >
          API
        </button>
      </div>

      {tab === "general" ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">테마</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {([
                  { value: "system" as Theme, icon: Monitor, label: "시스템" },
                  { value: "light" as Theme, icon: Sun, label: "라이트" },
                  { value: "dark" as Theme, icon: Moon, label: "다크" },
                ]).map(({ value, icon: Icon, label }) => (
                  <Button
                    key={value}
                    variant={theme === value ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => applyTheme(value)}
                  >
                    <Icon className="h-4 w-4 mr-1.5" />
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />날씨 지역
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="rounded-md bg-muted/40 px-3 py-2.5 text-sm">
                <span className="font-medium">{currentLocation.name}</span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={locQuery}
                  onChange={(e) => setLocQuery(e.target.value)}
                  placeholder="지역 변경 (예: 서울, 부산, Tokyo)"
                  className="pl-8 h-9 text-sm"
                />
              </div>
              {locQuery.trim() && (
                <div className="rounded-md border max-h-60 overflow-y-auto">
                  {locSearching ? (
                    <p className="text-xs text-muted-foreground p-3">검색 중...</p>
                  ) : locResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">결과 없음</p>
                  ) : (
                    locResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => pickLocation(r)}
                        className="flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent"
                      >
                        <span className="font-medium">
                          {r.name}
                          {r.admin1 ? `, ${r.admin1}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">{r.country}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 앱 정보 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">앱 정보</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">프레임워크</span>
                <span>Next.js 16 + React</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">UI 라이브러리</span>
                <span>shadcn/ui + Tailwind CSS</span>
              </div>
            </CardContent>
          </Card>

          {/* 데이터베이스 */}
          <ApiSection title="데이터베이스 — Supabase">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">서비스</span>
                <span>Supabase (PostgreSQL)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">요금제</span>
                <Badge variant="secondary" className="text-xs">무료 티어</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">만료</span>
                <Badge variant="secondary" className="text-xs">만료 없음</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>관리 사이트</span>
                <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                  supabase.com <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </ApiSection>

          {/* 날씨 API */}
          <ApiSection title="날씨 API">
            <div className="flex flex-col gap-4 text-sm">
              {/* 기상청 단기예보 */}
              <div className="flex flex-col gap-2">
                <p className="font-medium text-xs text-muted-foreground">기상청 단기예보</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">API 이름</span>
                  <span className="text-xs">VilageFcstInfoService_2.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">만료일</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{kmaExpiry}</span>
                    <Badge variant={kmaWarning || daysLeft <= 0 ? "destructive" : "secondary"} className="text-xs">
                      {daysLeft > 0 ? `${daysLeft}일 남음` : "만료됨"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* 기상청 중기예보 */}
              <div className="flex flex-col gap-2">
                <p className="font-medium text-xs text-muted-foreground">기상청 중기예보</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">API 이름</span>
                  <span className="text-xs">MidFcstInfoService</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">만료일</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{kmaExpiry}</span>
                    <Badge variant={kmaWarning || daysLeft <= 0 ? "destructive" : "secondary"} className="text-xs">
                      {daysLeft > 0 ? `${daysLeft}일 남음` : "만료됨"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* 갱신 안내 */}
              <div className="flex flex-col gap-1.5 pt-2 border-t text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>갱신 사이트</span>
                  <a href="https://www.data.go.kr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                    공공데이터포털 (data.go.kr) <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span>로그인 방법</span>
                  <span>네이버 간편로그인</span>
                </div>
              </div>

              {/* Open-Meteo */}
              <div className="flex flex-col gap-2 pt-2 border-t">
                <p className="font-medium text-xs text-muted-foreground">Open-Meteo (과거 날씨 + 장기 예보)</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">요금</span>
                  <Badge variant="secondary" className="text-xs">무료 (키 불필요)</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">만료</span>
                  <Badge variant="secondary" className="text-xs">만료 없음</Badge>
                </div>
              </div>
            </div>
          </ApiSection>

          {/* 특일정보 API */}
          <ApiSection title="공휴일 API — 한국천문연구원">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">API 이름</span>
                <span className="text-xs">특일 정보 (SpcdeInfoService)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">만료일</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs">{holidayExpiry}</span>
                  <Badge variant={holidayWarning ? "destructive" : holidayDaysLeft <= 0 ? "destructive" : "secondary"} className="text-xs">
                    {holidayDaysLeft > 0 ? `${holidayDaysLeft}일 남음` : "만료됨"}
                  </Badge>
                </div>
              </div>
              {holidayWarning && (
                <p className="text-xs text-destructive font-medium">⚠️ 만료 2개월 이내 — 갱신이 필요합니다</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>갱신 사이트</span>
                <a href="https://www.data.go.kr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                  공공데이터포털 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </ApiSection>

          {/* 네이버 지도 / 검색 API */}
          <ApiSection title="네이버 지도 · 검색 API" defaultOpen>
            <div className="flex flex-col gap-4 text-sm">
              <p className="text-xs text-muted-foreground leading-relaxed">
                여행 탭의 위치 검색·지도 표시에 사용됩니다. 두 개의 서비스에서 각각
                키를 발급받아 입력하세요. 저장된 값은 서버에서만 사용되며 브라우저에는
                Client ID 만 노출됩니다.
              </p>

              <div className="flex flex-col gap-3 pt-2 border-t">
                <p className="font-medium text-xs">네이버 클라우드 플랫폼 — Maps</p>
                <SecretKeyField
                  settingKey="ncp_map_client_id"
                  label="Client ID"
                  placeholder="예: abcdefghij"
                />
                <SecretKeyField
                  settingKey="ncp_map_client_secret"
                  label="Client Secret"
                  placeholder="예: AbCdEf...."
                  masked
                />
                <a
                  href="https://console.ncloud.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  NCP 콘솔에서 발급 <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex flex-col gap-3 pt-3 border-t">
                <p className="font-medium text-xs">네이버 개발자센터 — 검색(Local Search)</p>
                <SecretKeyField
                  settingKey="naver_search_client_id"
                  label="Client ID"
                  placeholder="예: 9b9nZ6C1..."
                />
                <SecretKeyField
                  settingKey="naver_search_client_secret"
                  label="Client Secret"
                  placeholder="예: kJ87...."
                  masked
                />
                <a
                  href="https://developers.naver.com/apps/#/list"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  네이버 개발자센터에서 발급 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </ApiSection>

          {/* 호스팅 */}
          <ApiSection title="호스팅 — Vercel">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">요금제</span>
                <Badge variant="secondary" className="text-xs">Hobby (무료)</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">만료</span>
                <Badge variant="secondary" className="text-xs">만료 없음</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>관리 사이트</span>
                <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                  vercel.com <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </ApiSection>
        </div>
      )}
    </div>
    </>
  );
}
