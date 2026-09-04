/** 사용량 집계용 화면 식별자 ↔ 표시명 */

export interface ScreenDefinition {
  key: string;
  label: string;
  /** pathname 매칭용 prefix (긴 것부터 매칭) */
  matchPrefixes: string[];
}

export const USAGE_SCREENS: ScreenDefinition[] = [
  {
    key: "dashboard",
    label: "대시보드",
    matchPrefixes: ["/dashboard"],
  },
  {
    key: "announcements",
    label: "입찰공고 조회",
    matchPrefixes: ["/dashboard/announcements"],
  },
  {
    key: "favorites",
    label: "관심공고",
    matchPrefixes: ["/dashboard/favorites"],
  },
  {
    key: "assigned_notices",
    label: "부서별 공고",
    matchPrefixes: ["/dashboard/assigned-notices"],
  },
  {
    key: "order_report",
    label: "발주보고",
    matchPrefixes: ["/dashboard/order-report"],
  },
  {
    key: "bid_amount",
    label: "입찰하기 · 입찰금액 결정",
    matchPrefixes: ["/dashboard/bid/amount"],
  },
  {
    key: "bid",
    label: "입찰하기",
    matchPrefixes: ["/dashboard/bid"],
  },
  {
    key: "estimate",
    label: "견적내기",
    matchPrefixes: ["/dashboard/estimate"],
  },
  {
    key: "results",
    label: "결과조회",
    matchPrefixes: ["/dashboard/results"],
  },
  {
    key: "opening_results_categories",
    label: "개찰결과 · 구분 관리",
    matchPrefixes: ["/dashboard/opening-results/categories"],
  },
  {
    key: "opening_results_competitors",
    label: "개찰결과 · 경쟁사 관리",
    matchPrefixes: ["/dashboard/opening-results/competitors"],
  },
  {
    key: "opening_results",
    label: "개찰결과 조회",
    matchPrefixes: ["/dashboard/opening-results"],
  },
  {
    key: "admin_users",
    label: "관리자 · 사용자관리",
    matchPrefixes: ["/dashboard/admin/users"],
  },
  {
    key: "admin_departments",
    label: "관리자 · 부서관리",
    matchPrefixes: ["/dashboard/admin/departments"],
  },
  {
    key: "admin_crawl_sites",
    label: "관리자 · 입찰공고 조회 사이트 관리",
    matchPrefixes: ["/dashboard/admin/crawl-sites"],
  },
  {
    key: "admin_screening_keywords",
    label: "관리자 · 자동선별 키워드",
    matchPrefixes: ["/dashboard/admin/screening-keywords"],
  },
  {
    key: "admin_usage",
    label: "관리자 · 사용 현황",
    matchPrefixes: ["/dashboard/admin/usage"],
  },
  {
    key: "admin_session_settings",
    label: "관리자 · 세션 설정",
    matchPrefixes: ["/dashboard/admin/session-settings"],
  },
  {
    key: "admin",
    label: "관리자메뉴",
    matchPrefixes: ["/dashboard/admin"],
  },
];

const SCREEN_BY_KEY = new Map(USAGE_SCREENS.map((s) => [s.key, s]));

/** 긴 prefix 우선으로 pathname → screen_key 매핑 */
const MATCHERS = [...USAGE_SCREENS]
  .flatMap((screen) =>
    screen.matchPrefixes.map((prefix) => ({ key: screen.key, prefix })),
  )
  .sort((a, b) => b.prefix.length - a.prefix.length);

export function resolveScreenKey(pathname: string): string | null {
  const path = pathname.split("?")[0]?.replace(/\/$/, "") || "/";
  if (path === "/dashboard") {
    return "dashboard";
  }
  for (const { key, prefix } of MATCHERS) {
    if (key === "dashboard") continue;
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return key;
    }
  }
  if (path.startsWith("/dashboard")) {
    return "dashboard_other";
  }
  return null;
}

export function screenLabel(screenKey: string): string {
  if (screenKey === "dashboard_other") {
    return "기타 대시보드";
  }
  return SCREEN_BY_KEY.get(screenKey)?.label ?? screenKey;
}
