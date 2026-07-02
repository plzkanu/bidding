import { BidOpeningCategoryManagement } from "@/components/bid-opening-category-management";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function OpeningResultsCategoriesPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">구분 관리</h1>
        <p className="mt-2 text-sm text-slate-600">
          개찰결과 등록 시 선택할 구분을 등록·관리합니다.
        </p>
      </div>

      {configured ? <BidOpeningCategoryManagement /> : <SupabaseConfigAlert />}
    </div>
  );
}
