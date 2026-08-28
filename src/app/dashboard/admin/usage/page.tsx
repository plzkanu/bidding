import { UsageAnalytics } from "@/components/usage-analytics";

export default function UsageAdminPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">사용 현황</h1>
        <p className="mt-2 text-sm text-slate-600">
          계정별 최종 접속시각, 사용시간, 화면별 방문 횟수를 조회합니다.
        </p>
      </div>
      <UsageAnalytics />
    </div>
  );
}
