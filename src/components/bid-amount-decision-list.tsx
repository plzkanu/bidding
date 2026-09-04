"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BidNoticeDetailModal } from "@/components/bid-notice-detail-modal";
import type { CrawlSite } from "@/lib/crawl-sites";
import type { UserBidAmountDecision } from "@/lib/bid-notices/bid-amounts";
import type { UserOrderReport } from "@/lib/bid-notices/order-reports";
import {
  BID_NOTICE_TYPE_LABELS,
  type KhnpBidNoticeRow,
} from "@/lib/bid-notices/types";
import {
  formatDeptNameForList,
  formatListDateTime,
  formatNoticePeriodForList,
  getOpenDetail,
  LIST_DATETIME_COL_CLASS,
} from "@/lib/bid-notices/utils";
import { formatOpeningAmount } from "@/lib/bid-opening-results-format";

const LIST_TABLE_CLASS = "w-full table-fixed text-left text-xs";
const NOTICE_NO_COL_CLASS = "w-[5.5rem] whitespace-nowrap px-2 py-1.5";
const SITE_COL_CLASS = "w-[6.75rem] truncate px-2 py-1.5";
const NOTICE_TITLE_COL_CLASS =
  "w-[20rem] max-w-[20rem] px-2 py-1.5 break-words align-middle";
const BID_CLOSE_COL_CLASS = LIST_DATETIME_COL_CLASS;
const DATE_COL_CLASS = LIST_DATETIME_COL_CLASS;
const DEPT_COL_CLASS = "w-[6rem] truncate px-2 py-1.5";
const STATUS_COL_CLASS = "w-[4.5rem] px-2 py-1.5";
const AMOUNT_COL_CLASS = "w-[6.5rem] px-2 py-1.5 tabular-nums";
const ACTION_COL_CLASS = "w-[7.5rem] px-2 py-1.5";

function decisionStatusLabel(decision: UserBidAmountDecision | undefined) {
  if (!decision) return "미결정";
  return decision.status === "DECIDED" ? "확정" : "작성중";
}

function decisionStatusClass(decision: UserBidAmountDecision | undefined) {
  if (!decision) {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }
  if (decision.status === "DECIDED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function BidAmountDecisionList() {
  const [sites, setSites] = useState<CrawlSite[]>([]);
  const [reports, setReports] = useState<UserOrderReport[]>([]);
  const [decisionsByNoticeId, setDecisionsByNoticeId] = useState<
    Record<string, UserBidAmountDecision>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailNotice, setDetailNotice] = useState<KhnpBidNoticeRow | null>(
    null,
  );
  const [detailSiteName, setDetailSiteName] = useState<string | undefined>();

  const siteNameById = new Map(sites.map((s) => [s.id, s.site_name]));

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [sitesRes, reportsRes] = await Promise.all([
        fetch("/api/crawl-sites"),
        fetch("/api/order-reports?completed=true"),
      ]);

      const sitesData = (await sitesRes.json()) as {
        sites?: CrawlSite[];
        error?: string;
      };
      const reportsData = (await reportsRes.json()) as {
        reports?: UserOrderReport[];
        error?: string;
      };

      if (!sitesRes.ok) {
        throw new Error(sitesData.error ?? "사이트 목록을 불러오지 못했습니다.");
      }
      if (!reportsRes.ok) {
        throw new Error(
          reportsData.error ?? "입찰금액 결정 대상 목록을 불러오지 못했습니다.",
        );
      }

      setSites((sitesData.sites ?? []).filter((s) => s.is_active !== false));
      const nextReports = reportsData.reports ?? [];
      setReports(nextReports);

      if (nextReports.length > 0) {
        const decisionsRes = await fetch(
          `/api/bid-amounts?noticeIds=${nextReports
            .map((r) => encodeURIComponent(r.noticeId))
            .join(",")}`,
        );
        const decisionsData = (await decisionsRes.json()) as {
          decisions?: UserBidAmountDecision[];
          error?: string;
        };
        if (!decisionsRes.ok) {
          throw new Error(
            decisionsData.error ?? "투찰금액 상태를 불러오지 못했습니다.",
          );
        }
        const map: Record<string, UserBidAmountDecision> = {};
        for (const d of decisionsData.decisions ?? []) {
          map[d.noticeId] = d;
        }
        setDecisionsByNoticeId(map);
      } else {
        setDecisionsByNoticeId({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setReports([]);
      setDecisionsByNoticeId({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openDetail(report: UserOrderReport) {
    setDetailNotice(report.notice);
    setDetailSiteName(siteNameById.get(report.siteId));
  }

  return (
    <div>
      <p className="text-sm text-slate-600">
        발주보고에서 「보고 완료」한 공고만 표시됩니다. 「투찰 금액」에서
        투찰금액을 입력·확정합니다.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="px-6 py-16 text-center text-sm text-slate-400">
            불러오는 중…
          </p>
        ) : reports.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            <p>발주보고 완료된 공고가 없습니다.</p>
            <p className="mt-2">
              <Link
                href="/dashboard/order-report"
                className="font-medium text-[#004b87] underline-offset-2 hover:underline"
              >
                발주보고
              </Link>
              메뉴에서 보고를 완료하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div>
            <table className={LIST_TABLE_CLASS}>
              <thead className="border-b border-slate-200 bg-slate-50 text-center text-slate-600">
                <tr>
                  <th className={`${NOTICE_NO_COL_CLASS} font-medium`}>
                    공고번호
                  </th>
                  <th
                    className={`${SITE_COL_CLASS} whitespace-nowrap font-medium`}
                  >
                    사이트
                  </th>
                  <th className={`${NOTICE_TITLE_COL_CLASS} font-medium`}>
                    공고명
                  </th>
                  <th className="w-[4rem] whitespace-nowrap px-2 py-1.5 font-medium">
                    공고구분
                  </th>
                  <th className={`${BID_CLOSE_COL_CLASS} font-medium`}>
                    입찰마감
                  </th>
                  <th className={`${DEPT_COL_CLASS} font-medium`}>부서</th>
                  <th className={`${STATUS_COL_CLASS} font-medium`}>상태</th>
                  <th className={`${AMOUNT_COL_CLASS} font-medium`}>투찰금액</th>
                  <th className={`${ACTION_COL_CLASS} font-medium`}>관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => {
                  const notice = report.notice;
                  const open = getOpenDetail(notice);
                  const decision = decisionsByNoticeId[report.noticeId];

                  return (
                    <tr
                      key={report.id}
                      className="cursor-pointer hover:bg-slate-50/80"
                      onClick={() => openDetail(report)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(report);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className={`${NOTICE_NO_COL_CLASS} text-slate-700`}>
                        {notice.notice_no}
                      </td>
                      <td className={`${SITE_COL_CLASS} text-slate-600`}>
                        {siteNameById.get(report.siteId) ?? "-"}
                      </td>
                      <td
                        className={`${NOTICE_TITLE_COL_CLASS} font-medium text-[#004b87]`}
                      >
                        {notice.title}
                      </td>
                      <td className="w-[4rem] truncate px-2 py-1.5 text-slate-600">
                        {BID_NOTICE_TYPE_LABELS[notice.notice_type]}
                      </td>
                      <td className={`${BID_CLOSE_COL_CLASS} text-slate-600`}>
                        {notice.notice_type === "BID"
                          ? formatListDateTime(open?.bid_close_dt)
                          : formatNoticePeriodForList(notice)}
                      </td>
                      <td className={`${DEPT_COL_CLASS} text-slate-600`}>
                        {formatDeptNameForList(notice.dept_name)}
                      </td>
                      <td className={STATUS_COL_CLASS}>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${decisionStatusClass(decision)}`}
                        >
                          {decisionStatusLabel(decision)}
                        </span>
                      </td>
                      <td
                        className={`${AMOUNT_COL_CLASS} text-right text-slate-700`}
                      >
                        {decision?.bidAmount != null
                          ? formatOpeningAmount(decision.bidAmount)
                          : "-"}
                      </td>
                      <td className={ACTION_COL_CLASS}>
                        <div
                          className="flex flex-row items-center justify-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/dashboard/bid/amount/${encodeURIComponent(report.noticeId)}`}
                            className="flex size-10 shrink-0 flex-col items-center justify-center rounded border border-[#004b87]/30 bg-[#004b87]/5 text-[10px] font-medium leading-tight text-[#004b87] hover:bg-[#004b87]/10"
                          >
                            <span>투찰</span>
                            <span>금액</span>
                          </Link>
                          <Link
                            href={`/dashboard/order-report/${encodeURIComponent(report.noticeId)}`}
                            className="flex size-10 shrink-0 flex-col items-center justify-center rounded border border-slate-300 bg-white text-[10px] font-medium leading-tight text-slate-600 hover:bg-slate-50"
                          >
                            <span>발주</span>
                            <span>요약</span>
                          </Link>
                        </div>
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
          isOrderReported
          onToggleFavorite={() => {}}
          onClose={() => {
            setDetailNotice(null);
            setDetailSiteName(undefined);
          }}
          showFavorite={false}
        />
      ) : null}
    </div>
  );
}
