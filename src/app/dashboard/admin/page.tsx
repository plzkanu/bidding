import Link from "next/link";

const adminMenus = [
  {
    href: "/dashboard/admin/users",
    title: "사용자관리",
    description: "시스템 사용자 계정을 등록·수정·삭제합니다.",
  },
  {
    href: "/dashboard/admin/departments",
    title: "부서관리",
    description: "담당부서 지정과 사용자 계정에 사용할 부서를 등록·관리합니다.",
  },
  {
    href: "/dashboard/admin/crawl-sites",
    title: "입찰공고 조회 사이트 관리",
    description: "입찰공고 수집 대상 사이트를 조회·수정·삭제합니다.",
  },
  {
    href: "/dashboard/admin/screening-keywords",
    title: "자동선별 키워드",
    description: "입찰공고 조회 자동선별에 사용할 키워드를 등록·관리합니다.",
  },
  {
    href: "/dashboard/admin/usage",
    title: "사용 현황",
    description:
      "계정별 최종 접속시각, 사용시간, 화면별 방문 횟수를 조회합니다.",
  },
  {
    href: "/dashboard/admin/session-settings",
    title: "세션 설정",
    description:
      "미사용 타임아웃 시간을 지정하고, 연장·자동 로그아웃 동작을 관리합니다.",
  },
];

export default function AdminMenuPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#004b87]">관리자메뉴</h1>
      <p className="mt-2 text-sm text-slate-600">
        시스템 관리 기능을 선택해 주세요.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {adminMenus.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#009ada]/40 hover:shadow-md"
          >
            <h2 className="font-semibold text-[#004b87]">{menu.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{menu.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
