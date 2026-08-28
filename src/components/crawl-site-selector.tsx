"use client";

import { useMemo } from "react";
import type { CrawlSite } from "@/lib/crawl-sites";
import { sortCrawlSitesForDisplay } from "@/lib/crawl-sites";

interface CrawlSiteSelectorProps {
  sites: CrawlSite[];
  selectedSiteId: number | null;
  /** null = 전체 사이트 */
  onSelect: (siteId: number | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** 맨 왼쪽에 「전체」 버튼 표시 (입찰공고 조회용) */
  allowAll?: boolean;
  /** default: 카드 그리드, compact: 헤더용 가로 탭 (대시보드 크기) */
  variant?: "default" | "compact";
}

function siteButtonClass(isSelected: boolean, compact: boolean) {
  if (compact) {
    return `inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      isSelected
        ? "border-[#004b87] bg-[#004b87]/5 ring-1 ring-[#009ada]/30"
        : "border-slate-200 bg-white hover:border-[#009ada]/50 hover:bg-slate-50"
    }`;
  }
  return `flex min-h-[4.75rem] min-w-[8.5rem] flex-1 flex-col rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    isSelected
      ? "border-[#004b87] bg-[#004b87]/5 shadow-sm ring-2 ring-[#009ada]/30"
      : "border-slate-200 bg-white hover:border-[#009ada]/50 hover:bg-slate-50"
  }`;
}

export function CrawlSiteSelector({
  sites,
  selectedSiteId,
  onSelect,
  isLoading = false,
  disabled = false,
  allowAll = false,
  variant = "default",
}: CrawlSiteSelectorProps) {
  const isDisabled = disabled || isLoading;
  const orderedSites = useMemo(
    () => sortCrawlSitesForDisplay(sites),
    [sites],
  );
  const isAllSelected = allowAll && selectedSiteId == null;
  const compact = variant === "compact";

  const allButton = allowAll ? (
    <button
      key="all"
      type="button"
      role="option"
      aria-selected={isAllSelected}
      disabled={isDisabled}
      onClick={() => onSelect(null)}
      title="전체 사이트"
      className={siteButtonClass(isAllSelected, compact)}
    >
      {compact ? (
        <>
          <span
            className={`text-xs font-semibold ${
              isAllSelected ? "text-[#004b87]" : "text-slate-800"
            }`}
          >
            전체
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              isAllSelected
                ? "bg-[#004b87] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            ALL
          </span>
        </>
      ) : (
        <>
          <div className="flex min-w-0 items-start justify-between gap-1.5">
            <span
              className={`truncate text-xs font-semibold leading-snug ${
                isAllSelected ? "text-[#004b87]" : "text-slate-800"
              }`}
            >
              전체
            </span>
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                isAllSelected
                  ? "bg-[#004b87] text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              ALL
            </span>
          </div>
          <span className="mt-1.5 truncate text-[11px] text-slate-500">
            모든 사이트
          </span>
        </>
      )}
    </button>
  ) : null;

  if (compact) {
    return (
      <div
        className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5 overflow-x-auto"
        role="listbox"
        aria-label="입찰공고 사이트 선택"
      >
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="h-9 w-24 shrink-0 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
              />
            ))}
          </>
        ) : orderedSites.length === 0 && !allowAll ? (
          <span className="text-xs text-slate-400">등록된 사이트 없음</span>
        ) : (
          <>
            {allButton}
            {orderedSites.map((site) => {
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
                  className={siteButtonClass(isSelected, true)}
                >
                  <span
                    className={`max-w-[7.5rem] truncate text-xs font-semibold xl:max-w-[9.5rem] ${
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
            })}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-700">입찰공고 사이트</p>

      {isLoading ? (
        <div className="flex flex-nowrap gap-2.5 overflow-x-auto">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="h-[4.75rem] min-w-[8.5rem] flex-1 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : orderedSites.length === 0 && !allowAll ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          활성화된 입찰공고 사이트가 없습니다. 관리자 메뉴에서 사이트를
          등록하세요.
        </p>
      ) : (
        <div
          className="flex flex-nowrap gap-2.5 overflow-x-auto"
          role="listbox"
          aria-label="입찰공고 사이트 선택"
        >
          {allButton}
          {orderedSites.map((site) => {
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
                title={site.site_name}
                className={siteButtonClass(isSelected, false)}
              >
                <div className="flex min-w-0 items-start justify-between gap-1.5">
                  <span
                    className={`truncate text-xs font-semibold leading-snug ${
                      isSelected ? "text-[#004b87]" : "text-slate-800"
                    }`}
                  >
                    {site.site_name}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      isSelected
                        ? "bg-[#004b87] text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {site.site_code}
                  </span>
                </div>
                {meta ? (
                  <span className="mt-1.5 truncate text-[11px] text-slate-500">
                    {meta}
                  </span>
                ) : (
                  <span className="mt-1.5 truncate text-[11px] text-slate-400">
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
