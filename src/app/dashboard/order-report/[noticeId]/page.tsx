import { Suspense } from "react";
import { OrderReportSummaryView } from "@/components/order-report-summary-view";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface OrderReportSummaryPageProps {
  params: Promise<{ noticeId: string }>;
}

export default async function OrderReportSummaryPage({
  params,
}: OrderReportSummaryPageProps) {
  const { noticeId } = await params;
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">발주요약</h1>
        <p className="mt-2 text-sm text-slate-600">
          첨부파일 기반 발주요약을 생성하고 DOCX로 저장합니다.
        </p>
      </div>

      {configured ? (
        <Suspense
          fallback={<p className="text-sm text-slate-400">불러오는 중…</p>}
        >
          <OrderReportSummaryView noticeId={noticeId.trim()} />
        </Suspense>
      ) : (
        <SupabaseConfigAlert />
      )}
    </div>
  );
}
