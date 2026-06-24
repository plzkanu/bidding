import { CrawlSiteManagement } from "@/components/crawl-site-management";
import { SupabaseConfigAlert } from "@/components/supabase-config-alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function CrawlSitesAdminPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">
          입찰공고 조회 사이트 관리
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          입찰공고를 수집할 사이트를 등록·수정·삭제합니다. (Supabase{" "}
          <code className="text-xs">crawl_sites</code>)
        </p>
      </div>

      {configured ? <CrawlSiteManagement /> : <SupabaseConfigAlert />}
    </div>
  );
}
