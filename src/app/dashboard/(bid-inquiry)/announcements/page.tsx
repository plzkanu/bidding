import { Suspense } from "react";
import { BidNoticeInquiry } from "@/components/bid-notice-inquiry";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function AnnouncementsPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">입찰공고 조회</h1>
        <p className="mt-2 text-sm text-slate-600">
          입찰공고 사이트를 선택한 뒤, 공고 유형별로 수집된 KPOS 입찰공고를
          조회하거나 직접 등록할 수 있습니다.
        </p>
      </div>

      {configured ? (
        <Suspense
          fallback={<p className="text-sm text-slate-400">불러오는 중…</p>}
        >
          <BidNoticeInquiry />
        </Suspense>
      ) : (
        <SupabaseConfigAlert />
      )}
    </div>
  );
}
