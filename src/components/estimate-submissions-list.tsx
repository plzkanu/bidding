"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BidNoticeDetailModal } from "@/components/bid-notice-detail-modal";
import type { CrawlSite } from "@/lib/crawl-sites";
import {
  BID_NOTICE_TYPE_LABELS,
  type KhnpBidNoticeRow,
} from "@/lib/bid-notices/types";
import type { UserEstimateSubmission } from "@/lib/bid-notices/estimates";
import {
  formatDeptNameForList,
  formatListDateTime,
  LIST_DATETIME_COL_CLASS,
} from "@/lib/bid-notices/utils";

const LIST_TABLE_CLASS = "w-full table-fixed text-left text-xs";
const NOTICE_NO_COL_CLASS = "w-[5.5rem] whitespace-nowrap px-2 py-1.5";
const NOTICE_TITLE_COL_CLASS =
  "w-[22rem] max-w-[22rem] px-2 py-1.5 break-words align-top";
const DEPT_COL_CLASS = "w-[6rem] truncate px-2 py-1.5";
const DATE_COL_CLASS = LIST_DATETIME_COL_CLASS;

export function EstimateSubmissionsList() {
  const searchParams = useSearchParams();
  const highlightNoticeId = searchParams.get("noticeId")?.trim() ?? null;

  const [sites, setSites] = useState<CrawlSite[]>([]);
  const [submissions, setSubmissions] = useState<UserEstimateSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [detailNotice, setDetailNotice] = useState<KhnpBidNoticeRow | null>(null);
  const [detailSiteName, setDetailSiteName] = useState<string | undefined>();

  const siteNameById = new Map(sites.map((s) => [s.id, s.site_name]));

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [sitesRes, submissionsRes] = await Promise.all([
        fetch("/api/crawl-sites"),
        fetch("/api/estimate-submissions"),
      ]);

      const sitesData = (await sitesRes.json()) as {
        sites?: CrawlSite[];
        error?: string;
      };
      const submissionsData = (await submissionsRes.json()) as {
        submissions?: UserEstimateSubmission[];
        error?: string;
      };

      if (!sitesRes.ok) {
        throw new Error(sitesData.error ?? "사이트 목록을 불러오지 못했습니다.");
      }
      if (!submissionsRes.ok) {
        throw new Error(submissionsData.error ?? "견적 목록을 불러오지 못했습니다.");
      }

      setSites((sitesData.sites ?? []).filter((s) => s.is_active !== false));
      setSubmissions(submissionsData.submissions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!highlightNoticeId || isLoading) return;
    const target = submissions.find((s) => s.noticeId === highlightNoticeId);
    if (target) {
      const el = document.getElementById(`estimate-submission-${target.noticeId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightNoticeId, isLoading, submissions]);

  async function cancelEstimate(noticeId: string) {
    setCancellingId(noticeId);
    setError("");
    try {
      const response = await fetch(
        `/api/estimate-submissions?noticeId=${encodeURIComponent(noticeId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "견적 취소에 실패했습니다.");
      }
      setSubmissions((prev) => prev.filter((s) => s.noticeId !== noticeId));
      if (detailNotice?.id === noticeId) {
        setDetailNotice(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "견적 취소에 실패했습니다.");
    } finally {
      setCancellingId(null);
    }
  }

  function openDetail(submission: UserEstimateSubmission) {
    setDetailNotice(submission.notice);
    setDetailSiteName(siteNameById.get(submission.siteId));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="text-sm text-slate-600">
        입찰공고 조회·관심공고에서 등록한 견적 건입니다.
      </p>

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
        ) : submissions.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            <p>등록된 견적이 없습니다.</p>
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
              에서 작업 → 견적내기를 눌러 추가하세요.
            </p>
          </div>
        ) : (
          <div>
            <table className={LIST_TABLE_CLASS}>
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className={`${NOTICE_NO_COL_CLASS} font-medium`}>
                    공고번호
                  </th>
                  <th className={`${NOTICE_TITLE_COL_CLASS} font-medium`}>
                    공고명
                  </th>
                  <th className="w-[4.5rem] whitespace-nowrap px-2 py-1.5 font-medium">
                    사이트
                  </th>
                  <th className={`${DEPT_COL_CLASS} font-medium`}>부서</th>
                  <th className={`${DATE_COL_CLASS} font-medium`}>
                    견적 등록일
                  </th>
                  <th className="w-[4rem] px-2 py-1.5 font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((submission) => {
                  const notice = submission.notice;
                  const isHighlighted = highlightNoticeId === submission.noticeId;
                  const isCancelling = cancellingId === submission.noticeId;

                  return (
                    <tr
                      key={submission.id}
                      id={`estimate-submission-${submission.noticeId}`}
                      className={`cursor-pointer hover:bg-slate-50/80 ${
                        isHighlighted
                          ? "bg-[#a4ce39]/10 ring-1 ring-inset ring-[#a4ce39]/40"
                          : ""
                      }`}
                      onClick={() => openDetail(submission)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(submission);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className={`${NOTICE_NO_COL_CLASS} text-slate-700`}>
                        {notice.notice_no}
                      </td>
                      <td
                        className={`${NOTICE_TITLE_COL_CLASS} font-medium text-[#004b87]`}
                      >
                        {notice.title}
                      </td>
                      <td className="w-[4.5rem] truncate px-2 py-1.5 text-slate-600">
                        {siteNameById.get(submission.siteId) ?? "-"}
                      </td>
                      <td className={`${DEPT_COL_CLASS} text-slate-600`}>
                        {formatDeptNameForList(notice.dept_name)}
                      </td>
                      <td className={`${DATE_COL_CLASS} text-slate-600`}>
                        {formatListDateTime(submission.submittedAt)}
                      </td>
                      <td className="w-[4rem] px-2 py-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEstimate(submission.noticeId);
                          }}
                          disabled={isCancelling}
                          className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                        >
                          {isCancelling ? "취소 중…" : "견적취소"}
                        </button>
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
          isEstimated
          isCancellingEstimate={cancellingId === detailNotice.id}
          onToggleFavorite={() => {}}
          onCancelEstimate={() => cancelEstimate(detailNotice.id)}
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
