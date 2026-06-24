"use client";

import type { CrawlSite } from "@/lib/crawl-sites";

interface CrawlSiteSelectorProps {
  sites: CrawlSite[];
  selectedSiteId: number | null;
  onSelect: (siteId: number) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** default: 카드 그리드, compact: 헤더용 가로 탭 */
  variant?: "default" | "compact";
}

export function CrawlSiteSelector({
  sites,
  selectedSiteId,
  onSelect,
  isLoading = false,
  disabled = false,
  variant = "default",
}: CrawlSiteSelectorProps) {
  const isDisabled = disabled || isLoading;

  if (variant === "compact") {
    return (
      <div
        className="flex max-w-[42rem] flex-wrap items-center justify-end gap-2"
        role="listbox"
        aria-label="입찰공고 사이트 선택"
      >
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 w-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
              />
            ))}
          </>
        ) : sites.length === 0 ? (
          <span className="text-xs text-slate-400">등록된 사이트 없음</span>
        ) : (
          sites.map((site) => {
            const isSelected = selectedSiteId === site.id;
            return (
              <button
                key={site.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isDisabled}
                onClick={() => onSelect(site.id)}
                title={site.site_name}
                className={`inline-flex max-w-[13rem] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? "border-[#004b87] bg-[#004b87]/5 ring-1 ring-[#009ada]/30"
                    : "border-slate-200 bg-white hover:border-[#009ada]/50 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`truncate text-xs font-semibold ${
                    isSelected ? "text-[#004b87]" : "text-slate-800"
                  }`}
                >
                  {site.site_name}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    isSelected
                      ? "bg-[#004b87] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {site.site_code}
                </span>
              </button>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-700">입찰공고 사이트</p>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[5.5rem] animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          활성화된 입찰공고 사이트가 없습니다. 관리자 메뉴에서 사이트를
          등록하세요.
        </p>
      ) : (
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          role="listbox"
          aria-label="입찰공고 사이트 선택"
        >
          {sites.map((site) => {
            const isSelected = selectedSiteId === site.id;
            const meta = [site.org_type, site.region]
              .filter(Boolean)
              .join(" · ");

            return (
              <button
                key={site.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isDisabled}
                onClick={() => onSelect(site.id)}
                className={`flex min-h-[5.5rem] flex-col rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? "border-[#004b87] bg-[#004b87]/5 shadow-sm ring-2 ring-[#009ada]/30"
                    : "border-slate-200 bg-white hover:border-[#009ada]/50 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-sm font-semibold leading-snug ${
                      isSelected ? "text-[#004b87]" : "text-slate-800"
                    }`}
                  >
                    {site.site_name}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                      isSelected
                        ? "bg-[#004b87] text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {site.site_code}
                  </span>
                </div>
                {meta ? (
                  <span className="mt-2 text-xs text-slate-500">{meta}</span>
                ) : (
                  <span className="mt-2 text-xs text-slate-400">
                    {site.site_category ?? "입찰공고"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
