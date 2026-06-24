export interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

export const mainNavItems: NavItem[] = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/dashboard/announcements", label: "입찰공고 조회" },
  { href: "/dashboard/order-report", label: "발주보고" },
  { href: "/dashboard/bid", label: "입찰하기" },
  { href: "/dashboard/estimate", label: "견적내기" },
  { href: "/dashboard/results", label: "결과조회" },
  { href: "/dashboard/admin", label: "관리자메뉴", adminOnly: true },
];

export const announcementsSubNavItems: NavItem[] = [
  { href: "/dashboard/announcements", label: "입찰공고 조회" },
  { href: "/dashboard/favorites", label: "관심공고" },
  { href: "/dashboard/assigned-notices", label: "부서별 공고" },
];

export const adminSubNavItems: NavItem[] = [
  { href: "/dashboard/admin/users", label: "사용자관리" },
  { href: "/dashboard/admin/departments", label: "부서관리" },
  {
    href: "/dashboard/admin/crawl-sites",
    label: "입찰공고 조회 사이트 관리",
  },
  {
    href: "/dashboard/admin/screening-keywords",
    label: "자동선별 키워드",
  },
];
