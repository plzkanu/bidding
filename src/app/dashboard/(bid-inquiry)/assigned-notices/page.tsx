import { Suspense } from "react";
import { AssignedBidNoticesList } from "@/components/assigned-bid-notices-list";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function AssignedNoticesPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">부서별 공고</h1>
        <p className="mt-2 text-sm text-slate-600">
          담당부서가 지정된 입찰공고를 부서별·검색 조건으로 조회합니다.
        </p>
      </div>

      {configured ? (
        <Suspense
          fallback={<p className="text-sm text-slate-400">불러오는 중…</p>}
        >
          <AssignedBidNoticesList />
        </Suspense>
      ) : (
        <SupabaseConfigAlert />
      )}
    </div>
  );
}
