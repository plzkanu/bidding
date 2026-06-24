import { Suspense } from "react";
import { OrderReportsList } from "@/components/order-reports-list";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function OrderReportPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">발주보고</h1>
        <p className="mt-2 text-sm text-slate-600">
          입찰공고 조회·관심공고에서 등록한 발주보고 건을 확인하고, 첨부파일
          기반 발주요약을 생성할 수 있습니다.
        </p>
      </div>

      {configured ? (
        <Suspense
          fallback={<p className="text-sm text-slate-400">불러오는 중…</p>}
        >
          <OrderReportsList />
        </Suspense>
      ) : (
        <SupabaseConfigAlert />
      )}
    </div>
  );
}
