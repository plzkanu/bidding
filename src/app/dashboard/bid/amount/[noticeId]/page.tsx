import { Suspense } from "react";
import { BidAmountDecisionView } from "@/components/bid-amount-decision-view";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface BidAmountDecisionPageProps {
  params: Promise<{ noticeId: string }>;
}

export default async function BidAmountDecisionPage({
  params,
}: BidAmountDecisionPageProps) {
  const { noticeId } = await params;
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">투찰금액 결정</h1>
        <p className="mt-2 text-sm text-slate-600">
          기초금액·낙찰율·투찰금액을 입력하고 투찰율을 확인한 뒤 확정합니다.
        </p>
      </div>

      {configured ? (
        <Suspense
          fallback={<p className="text-sm text-slate-400">불러오는 중…</p>}
        >
          <BidAmountDecisionView noticeId={noticeId.trim()} />
        </Suspense>
      ) : (
        <SupabaseConfigAlert />
      )}
    </div>
  );
}
