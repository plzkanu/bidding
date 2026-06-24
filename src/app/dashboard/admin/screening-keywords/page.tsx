import { ScreeningKeywordManagement } from "@/components/screening-keyword-management";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function ScreeningKeywordsAdminPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">자동선별 키워드</h1>
        <p className="mt-2 text-sm text-slate-600">
          입찰공고 조회 화면의 자동선별 기능에 사용할 키워드를 등록·관리합니다.
        </p>
      </div>

      {configured ? <ScreeningKeywordManagement /> : <SupabaseConfigAlert />}
    </div>
  );
}
