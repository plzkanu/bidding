import { Suspense } from "react";
import { EstimateSubmissionsList } from "@/components/estimate-submissions-list";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function EstimatePage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">견적내기</h1>
        <p className="mt-2 text-sm text-slate-600">
          입찰공고 조회·관심공고의 작업 메뉴에서 등록한 견적 건을 확인하고
          취소할 수 있습니다.
        </p>
      </div>

      {configured ? (
        <Suspense fallback={<p className="text-sm text-slate-400">불러오는 중…</p>}>
          <EstimateSubmissionsList />
        </Suspense>
      ) : (
        <SupabaseConfigAlert />
      )}
    </div>
  );
}
