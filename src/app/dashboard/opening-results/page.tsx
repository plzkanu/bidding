import { Suspense } from "react";
import { BidOpeningResultsList } from "@/components/bid-opening-results-list";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function OpeningResultsPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">개찰결과 조회</h1>
        <p className="mt-2 text-sm text-slate-600">
          개찰결과를 등록하고 경쟁사별 투찰금액·투찰율을 조회합니다.
        </p>
      </div>

      {configured ? (
        <Suspense fallback={<p className="text-sm text-slate-400">불러오는 중…</p>}>
          <BidOpeningResultsList />
        </Suspense>
      ) : (
        <SupabaseConfigAlert />
      )}
    </div>
  );
}
