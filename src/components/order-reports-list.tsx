"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BidNoticeDetailModal } from "@/components/bid-notice-detail-modal";
import type { CrawlSite } from "@/lib/crawl-sites";
import type { UserOrderReport } from "@/lib/bid-notices/order-reports";
import {
  ORDER_REPORT_SUMMARY_STATUS_LABELS,
  type OrderReportSummaryStatus,
} from "@/lib/order-report-summary/sections";
import type { OrderReportPqListMeta } from "@/lib/order-report-summary/pq-status";
import { pqListLabelClassName } from "@/lib/order-report-summary/pq-status";
import {
  formatDeptNameForList,
  formatListDateTime,
  LIST_DATETIME_COL_CLASS,
} from "@/lib/bid-notices/utils";

const LIST_TABLE_CLASS = "w-full table-fixed text-left text-xs";
const NOTICE_NO_COL_CLASS = "w-[5.5rem] whitespace-nowrap px-2 py-1.5";
const SITE_COL_CLASS = "w-[6.75rem] truncate px-2 py-1.5";
const NOTICE_TITLE_COL_CLASS =
  "w-[18rem] max-w-[18rem] px-2 py-1.5 break-words align-middle";
const DATE_COL_CLASS = LIST_DATETIME_COL_CLASS;
const DEPT_COL_CLASS = "w-[6rem] truncate px-2 py-1.5";
const SUMMARY_COL_CLASS = "w-[4.5rem] px-2 py-1.5";
const PQ_COL_CLASS = "w-[7rem] px-2 py-1.5 leading-tight break-words";
const STATUS_COL_CLASS = "w-[4rem] px-2 py-1.5";
const ACTION_COL_CLASS = "w-[9.5rem] px-2 py-1.5";

type CompletionFilter = "all" | "pending" | "completed";

export function OrderReportsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightNoticeId = searchParams.get("noticeId")?.trim() ?? null;

  const [sites, setSites] = useState<CrawlSite[]>([]);
  const [reports, setReports] = useState<UserOrderReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>("all");
  const [error, setError] = useState("");
  const [detailNotice, setDetailNotice] = useState<UserOrderReport["notice"] | null>(
    null,
  );
  const [summaryStatuses, setSummaryStatuses] = useState<
    Record<string, OrderReportSummaryStatus>
  >({});
  const [pqMetaByNoticeId, setPqMetaByNoticeId] = useState<
    Record<string, OrderReportPqListMeta>
  >({});
  const [detailSiteName, setDetailSiteName] = useState<string | undefined>();

  const siteNameById = new Map(sites.map((s) => [s.id, s.site_name]));

  const filteredReports = useMemo(() => {
    if (completionFilter === "pending") {
      return reports.filter((r) => !r.isCompleted);
    }
    if (completionFilter === "completed") {
      return reports.filter((r) => r.isCompleted);
    }
    return reports;
  }, [reports, completionFilter]);

  const pendingCount = reports.filter((r) => !r.isCompleted).length;
  const completedCount = reports.filter((r) => r.isCompleted).length;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [sitesRes, reportsRes] = await Promise.all([
        fetch("/api/crawl-sites"),
        fetch("/api/order-reports"),
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
          reportsData.error ?? "발주보고 목록을 불러오지 못했습니다.",
        );
      }

      setSites((sitesData.sites ?? []).filter((s) => s.is_active !== false));
      const nextReports = reportsData.reports ?? [];
      setReports(nextReports);

      if (nextReports.length > 0) {
        const statusRes = await fetch(
          `/api/order-report-summaries/status?noticeIds=${nextReports
            .map((r) => encodeURIComponent(r.noticeId))
            .join(",")}`,
        );
        const statusData = (await statusRes.json()) as {
          statuses?: Record<string, OrderReportSummaryStatus>;
          meta?: Record<string, OrderReportPqListMeta>;
        };
        if (statusRes.ok && statusData.statuses) {
          setSummaryStatuses(statusData.statuses);
        }
        if (statusRes.ok && statusData.meta) {
          setPqMetaByNoticeId(statusData.meta);
        }
      } else {
        setSummaryStatuses({});
        setPqMetaByNoticeId({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!highlightNoticeId || isLoading) return;
    router.replace(`/dashboard/order-report/${encodeURIComponent(highlightNoticeId)}`);
  }, [highlightNoticeId, isLoading, router]);

  async function cancelOrderReport(noticeId: string) {
    setCancellingId(noticeId);
    setError("");
    try {
      const response = await fetch(
        `/api/order-reports?noticeId=${encodeURIComponent(noticeId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "발주보고 취소에 실패했습니다.");
      }
      setReports((prev) => prev.filter((r) => r.noticeId !== noticeId));
      if (detailNotice?.id === noticeId) {
        setDetailNotice(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "발주보고 취소에 실패했습니다.",
      );
    } finally {
      setCancellingId(null);
    }
  }

  async function toggleReportCompleted(
    noticeId: string,
    nextCompleted: boolean,
  ) {
    setCompletingId(noticeId);
    setError("");
    try {
      const response = await fetch("/api/order-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeId, isCompleted: nextCompleted }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ?? "발주보고 완료 상태 변경에 실패했습니다.",
        );
      }
      setReports((prev) =>
        prev.map((r) =>
          r.noticeId === noticeId
            ? {
                ...r,
                isCompleted: nextCompleted,
                completedAt: nextCompleted ? new Date().toISOString() : null,
              }
            : r,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "발주보고 완료 상태 변경에 실패했습니다.",
      );
    } finally {
      setCompletingId(null);
    }
  }

  function openDetail(report: UserOrderReport) {
    setDetailNotice(report.notice);
    setDetailSiteName(siteNameById.get(report.siteId));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="text-sm text-slate-600">
        입찰공고 조회·관심공고에서 등록한 발주보고 건입니다. 「요약 작성」에서
        첨부파일 기반 발주요약 화면으로 이동합니다. 「보고 완료」로 보고 여부를
        표시·관리할 수 있습니다.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {!isLoading && reports.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: "전체", count: reports.length },
              { id: "pending", label: "미완료", count: pendingCount },
              { id: "completed", label: "완료", count: completedCount },
            ] as const
          ).map((tab) => {
            const selected = completionFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCompletionFilter(tab.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "border-[#004b87] bg-[#004b87] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 tabular-nums ${
                    selected ? "text-white/80" : "text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 flex min-h-[20rem] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="px-6 py-16 text-center text-sm text-slate-400">
            불러오는 중…
          </p>
        ) : reports.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            <p>등록된 발주보고가 없습니다.</p>
            <p className="mt-2">
              <Link
                href="/dashboard/announcements"
                className="font-medium text-[#004b87] underline-offset-2 hover:underline"
              >
                입찰공고 조회
              </Link>
              {" 또는 "}
              <Link
                href="/dashboard/favorites"
                className="font-medium text-[#004b87] underline-offset-2 hover:underline"
              >
                관심공고
              </Link>
              에서 작업 → 발주보고를 눌러 추가하세요.
            </p>
          </div>
        ) : filteredReports.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-slate-400">
            {completionFilter === "completed"
              ? "완료된 발주보고가 없습니다."
              : "미완료 발주보고가 없습니다."}
          </p>
        ) : (
          <div>
            <table className={LIST_TABLE_CLASS}>
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-center text-slate-600">
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
                  <th className={`${DEPT_COL_CLASS} font-medium`}>부서</th>
                  <th className={`${DATE_COL_CLASS} font-medium`}>
                    발주 등록일
                  </th>
                  <th className={`${SUMMARY_COL_CLASS} font-medium`}>요약</th>
                  <th className={`${PQ_COL_CLASS} font-medium`}>PQ유무</th>
                  <th className={`${STATUS_COL_CLASS} font-medium`}>상태</th>
                  <th className={`${ACTION_COL_CLASS} font-medium`}>관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => {
                  const notice = report.notice;
                  const isHighlighted = highlightNoticeId === report.noticeId;
                  const isCancelling = cancellingId === report.noticeId;
                  const isCompleting = completingId === report.noticeId;
                  const pqMeta =
                    pqMetaByNoticeId[report.noticeId] ??
                    ({
                      summaryStatus:
                        summaryStatuses[report.noticeId] ?? "NOT_STARTED",
                      pqLabel: "PQ 분석 전",
                      pqHasPq: null,
                      pqSubmissionDate: null,
                    } satisfies OrderReportPqListMeta);

                  return (
                    <tr
                      key={report.id}
                      id={`order-report-${report.noticeId}`}
                      className={`cursor-pointer hover:bg-slate-50/80 ${
                        isHighlighted
                          ? "bg-[#004b87]/5 ring-1 ring-inset ring-[#004b87]/20"
                          : report.isCompleted
                            ? "bg-emerald-50/40"
                            : ""
                      }`}
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
                      <td className={`${DEPT_COL_CLASS} text-slate-600`}>
                        {formatDeptNameForList(notice.dept_name)}
                      </td>
                      <td className={`${DATE_COL_CLASS} text-slate-600`}>
                        {formatListDateTime(report.submittedAt)}
                      </td>
                      <td className={SUMMARY_COL_CLASS}>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          {ORDER_REPORT_SUMMARY_STATUS_LABELS[
                            summaryStatuses[report.noticeId] ?? "NOT_STARTED"
                          ]}
                        </span>
                      </td>
                      <td className={PQ_COL_CLASS}>
                        <span
                          className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[10px] font-medium ${pqListLabelClassName(pqMeta.pqLabel)}`}
                          title={pqMeta.pqLabel}
                        >
                          {pqMeta.pqLabel}
                        </span>
                      </td>
                      <td className={STATUS_COL_CLASS}>
                        {report.isCompleted ? (
                          <span
                            className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                            title={
                              report.completedAt
                                ? `완료: ${formatListDateTime(report.completedAt)}`
                                : undefined
                            }
                          >
                            완료
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            미완료
                          </span>
                        )}
                      </td>
                      <td className={ACTION_COL_CLASS}>
                        <div
                          className="flex flex-row items-center justify-center gap-1"
                          data-no-row-click
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/dashboard/order-report/${encodeURIComponent(report.noticeId)}`}
                            className="flex size-10 shrink-0 flex-col items-center justify-center rounded border border-[#004b87]/30 bg-[#004b87]/5 text-[10px] font-medium leading-tight text-[#004b87] hover:bg-[#004b87]/10"
                          >
                            <span>요약</span>
                            <span>작성</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              toggleReportCompleted(
                                report.noticeId,
                                !report.isCompleted,
                              )
                            }
                            disabled={isCompleting}
                            className={`flex size-10 shrink-0 cursor-pointer flex-col items-center justify-center rounded border text-[10px] font-medium leading-tight disabled:cursor-not-allowed disabled:opacity-40 ${
                              report.isCompleted
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                            title={
                              report.isCompleted
                                ? "보고 완료 취소"
                                : "보고 완료로 표시"
                            }
                          >
                            {isCompleting ? (
                              <>
                                <span>처리</span>
                                <span>중…</span>
                              </>
                            ) : report.isCompleted ? (
                              <>
                                <span>완료</span>
                                <span>취소</span>
                              </>
                            ) : (
                              <>
                                <span>보고</span>
                                <span>완료</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelOrderReport(report.noticeId)}
                            disabled={isCancelling}
                            className="flex size-10 shrink-0 cursor-pointer flex-col items-center justify-center rounded border border-red-200 text-[10px] font-medium leading-tight text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isCancelling ? (
                              <>
                                <span>취소</span>
                                <span>중…</span>
                              </>
                            ) : (
                              <>
                                <span>보고</span>
                                <span>취소</span>
                              </>
                            )}
                          </button>
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
          isCancellingOrderReport={cancellingId === detailNotice.id}
          onToggleFavorite={() => {}}
          onCancelOrderReport={() => cancelOrderReport(detailNotice.id)}
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
