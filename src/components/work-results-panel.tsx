"use client";

import { useCallback, useEffect, useState } from "react";
import { BidNoticeDetailModal } from "@/components/bid-notice-detail-modal";
import type { CrawlSite } from "@/lib/crawl-sites";
import {
  BID_NOTICE_TYPE_LABELS,
  type KhnpBidNoticeRow,
} from "@/lib/bid-notices/types";
import {
  WORK_RESULT_KIND_LABELS,
  type WorkResult,
  type WorkResultKind,
} from "@/lib/bid-notices/work-results";
import {
  formatDeptNameForList,
  formatListDateTime,
  formatNoticePeriodForList,
  getOpenDetail,
  LIST_DATETIME_COL_CLASS,
  LIST_PERIOD_COL_CLASS,
} from "@/lib/bid-notices/utils";

const LIST_TABLE_CLASS = "w-full table-fixed text-left text-xs";
const NOTICE_NO_COL_CLASS = "w-[5.5rem] whitespace-nowrap px-2 py-1.5";
const NOTICE_TITLE_COL_CLASS =
  "w-[22rem] max-w-[22rem] px-2 py-1.5 break-words align-top";
const DEPT_COL_CLASS = "w-[6rem] truncate px-2 py-1.5";
const DEADLINE_PERIOD_COL_CLASS = LIST_PERIOD_COL_CLASS;
const DATE_COL_CLASS = LIST_DATETIME_COL_CLASS;

const KIND_FILTER_OPTIONS: Array<{ value: "ALL" | WorkResultKind; label: string }> =
  [
    { value: "ALL", label: "전체" },
    { value: "ORDER_REPORT", label: "발주" },
    { value: "BID", label: "입찰" },
    { value: "ESTIMATE", label: "견적" },
  ];

export function WorkResultsPanel() {
  const [sites, setSites] = useState<CrawlSite[]>([]);
  const [results, setResults] = useState<WorkResult[]>([]);
  const [orderReportCount, setOrderReportCount] = useState(0);
  const [bidCount, setBidCount] = useState(0);
  const [estimateCount, setEstimateCount] = useState(0);
  const [kindFilter, setKindFilter] = useState<"ALL" | WorkResultKind>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailNotice, setDetailNotice] = useState<KhnpBidNoticeRow | null>(null);
  const [detailSiteName, setDetailSiteName] = useState<string | undefined>();
  const [detailKind, setDetailKind] = useState<WorkResultKind | null>(null);

  const siteNameById = new Map(sites.map((s) => [s.id, s.site_name]));

  const filteredResults =
    kindFilter === "ALL"
      ? results
      : results.filter((result) => result.kind === kindFilter);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [sitesRes, resultsRes] = await Promise.all([
        fetch("/api/crawl-sites"),
        fetch("/api/work-results"),
      ]);

      const sitesData = (await sitesRes.json()) as {
        sites?: CrawlSite[];
        error?: string;
      };
      const resultsData = (await resultsRes.json()) as {
        results?: WorkResult[];
        orderReportCount?: number;
        bidCount?: number;
        estimateCount?: number;
        error?: string;
      };

      if (!sitesRes.ok) {
        throw new Error(sitesData.error ?? "사이트 목록을 불러오지 못했습니다.");
      }
      if (!resultsRes.ok) {
        throw new Error(resultsData.error ?? "결과를 불러오지 못했습니다.");
      }

      setSites((sitesData.sites ?? []).filter((s) => s.is_active !== false));
      setResults(resultsData.results ?? []);
      setOrderReportCount(resultsData.orderReportCount ?? 0);
      setBidCount(resultsData.bidCount ?? 0);
      setEstimateCount(resultsData.estimateCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setResults([]);
      setOrderReportCount(0);
      setBidCount(0);
      setEstimateCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openDetail(result: WorkResult) {
    setDetailNotice(result.notice);
    setDetailSiteName(siteNameById.get(result.siteId));
    setDetailKind(result.kind);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="text-sm text-slate-600">
        등록한 발주·입찰·견적을 한 화면에서 조회합니다. 발주{" "}
        {orderReportCount.toLocaleString("ko-KR")}건 · 입찰{" "}
        {bidCount.toLocaleString("ko-KR")}건 · 견적{" "}
        {estimateCount.toLocaleString("ko-KR")}건
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {KIND_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setKindFilter(option.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              kindFilter === option.value
                ? "bg-[#004b87] text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex min-h-[20rem] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="px-6 py-16 text-center text-sm text-slate-400">
            불러오는 중…
          </p>
        ) : filteredResults.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-slate-500">
            {kindFilter === "ALL"
              ? "등록된 입찰·견적 결과가 없습니다."
              : `${WORK_RESULT_KIND_LABELS[kindFilter]} 결과가 없습니다.`}
          </p>
        ) : (
          <div>
            <table className={LIST_TABLE_CLASS}>
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-[3.5rem] px-2 py-1.5 font-medium">구분</th>
                  <th className={`${NOTICE_NO_COL_CLASS} font-medium`}>
                    공고번호
                  </th>
                  <th className={`${NOTICE_TITLE_COL_CLASS} font-medium`}>
                    공고명
                  </th>
                  <th className="w-[4.5rem] whitespace-nowrap px-2 py-1.5 font-medium">
                    사이트
                  </th>
                  <th className="w-[4rem] whitespace-nowrap px-2 py-1.5 font-medium">
                    공고유형
                  </th>
                  <th className={`${DEPT_COL_CLASS} font-medium`}>부서</th>
                  <th className={`${DEADLINE_PERIOD_COL_CLASS} font-medium`}>
                    마감/기간
                  </th>
                  <th className={`${DATE_COL_CLASS} font-medium`}>등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((result) => {
                  const notice = result.notice;
                  const open = getOpenDetail(notice);

                  return (
                    <tr
                      key={`${result.kind}-${result.id}`}
                      className="cursor-pointer hover:bg-slate-50/80"
                      onClick={() => openDetail(result)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(result);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="w-[3.5rem] px-2 py-1.5">
                        <span
                          className={`inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                            result.kind === "ORDER_REPORT"
                              ? "bg-slate-200 text-slate-700"
                              : result.kind === "BID"
                                ? "bg-[#009ada]/10 text-[#004b87]"
                                : "bg-[#a4ce39]/20 text-[#3d5c00]"
                          }`}
                        >
                          {WORK_RESULT_KIND_LABELS[result.kind]}
                        </span>
                      </td>
                      <td className={`${NOTICE_NO_COL_CLASS} text-slate-700`}>
                        {notice.notice_no}
                      </td>
                      <td
                        className={`${NOTICE_TITLE_COL_CLASS} font-medium text-[#004b87]`}
                      >
                        {notice.title}
                      </td>
                      <td className="w-[4.5rem] truncate px-2 py-1.5 text-slate-600">
                        {siteNameById.get(result.siteId) ?? "-"}
                      </td>
                      <td className="w-[4rem] truncate px-2 py-1.5 text-slate-600">
                        {BID_NOTICE_TYPE_LABELS[notice.notice_type]}
                      </td>
                      <td className={`${DEPT_COL_CLASS} text-slate-600`}>
                        {formatDeptNameForList(notice.dept_name)}
                      </td>
                      <td className={`${DEADLINE_PERIOD_COL_CLASS} text-slate-600`}>
                        {notice.notice_type === "BID"
                          ? formatListDateTime(open?.bid_close_dt)
                          : formatNoticePeriodForList(notice)}
                      </td>
                      <td className={`${DATE_COL_CLASS} text-slate-600`}>
                        {formatListDateTime(result.submittedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => loadData()}
          disabled={isLoading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          새로고침
        </button>
      </div>

      {detailNotice ? (
        <BidNoticeDetailModal
          notice={detailNotice}
          siteName={detailSiteName}
          isFavorite={false}
          isOrderReported={detailKind === "ORDER_REPORT"}
          isSubmitted={detailKind === "BID"}
          isEstimated={detailKind === "ESTIMATE"}
          onToggleFavorite={() => {}}
          onClose={() => {
            setDetailNotice(null);
            setDetailSiteName(undefined);
            setDetailKind(null);
          }}
          showFavorite={false}
        />
      ) : null}
    </div>
  );
}
