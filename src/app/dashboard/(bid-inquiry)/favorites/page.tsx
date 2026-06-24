import { Suspense } from "react";
import { BidNoticeInquiry } from "@/components/bid-notice-inquiry";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function FavoritesPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">관심공고</h1>
        <p className="mt-2 text-sm text-slate-600">
          내가 등록한 관심 입찰공고만 사이트·공고 유형별로 조회합니다.
        </p>
      </div>

      {configured ? (
        <Suspense
          fallback={<p className="text-sm text-slate-400">불러오는 중…</p>}
        >
          <BidNoticeInquiry defaultFavoritesOnly />
        </Suspense>
      ) : (
        <SupabaseConfigAlert />
      )}
    </div>
  );
}
