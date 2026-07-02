import { BidCompetitorManagement } from "@/components/bid-competitor-management";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function OpeningResultsCompetitorsPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">경쟁사 관리</h1>
        <p className="mt-2 text-sm text-slate-600">
          개찰결과에 투찰 정보를 등록할 경쟁사를 관리합니다.
        </p>
      </div>

      {configured ? <BidCompetitorManagement /> : <SupabaseConfigAlert />}
    </div>
  );
}
