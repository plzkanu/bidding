import { Suspense } from "react";
import { BidAmountDecisionList } from "@/components/bid-amount-decision-list";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function BidAmountPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">입찰금액 결정</h1>
        <p className="mt-2 text-sm text-slate-600">
          발주보고가 완료된 공고를 대상으로 입찰금액을 결정합니다.
        </p>
      </div>

      {configured ? (
        <Suspense fallback={<p className="text-sm text-slate-400">불러오는 중…</p>}>
          <BidAmountDecisionList />
        </Suspense>
      ) : (
        <SupabaseConfigAlert />
      )}
    </div>
  );
}
