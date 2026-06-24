import { WorkResultsPanel } from "@/components/work-results-panel";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function ResultsPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">결과조회</h1>
        <p className="mt-2 text-sm text-slate-600">
          등록한 입찰·견적 결과를 한 화면에서 조회합니다.
        </p>
      </div>

      {configured ? <WorkResultsPanel /> : <SupabaseConfigAlert />}
    </div>
  );
}
