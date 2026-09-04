"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrawlSite } from "@/lib/crawl-sites";
import type { UserBidAmountDecision } from "@/lib/bid-notices/bid-amounts";
import {
  BID_NOTICE_TYPE_LABELS,
  type KhnpBidNoticeRow,
} from "@/lib/bid-notices/types";
import {
  formatDeptNameForList,
  formatListDateTime,
  getOpenDetail,
} from "@/lib/bid-notices/utils";
import {
  computeBidRateFromAmount,
  formatOpeningAmount,
  formatOpeningRate,
  parseAmountInput,
  parseOpeningPercentValue,
} from "@/lib/bid-opening-results-format";

interface BidAmountDecisionViewProps {
  noticeId: string;
}

function amountToInput(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

function rateToInput(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

export function BidAmountDecisionView({ noticeId }: BidAmountDecisionViewProps) {
  const [notice, setNotice] = useState<KhnpBidNoticeRow | null>(null);
  const [siteName, setSiteName] = useState<string | undefined>();
  const [decision, setDecision] = useState<UserBidAmountDecision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [bidAmount, setBidAmount] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [awardRate, setAwardRate] = useState("");
  const [memo, setMemo] = useState("");

  const computedBidRate = useMemo(
    () =>
      computeBidRateFromAmount(
        parseAmountInput(bidAmount),
        parseOpeningPercentValue(awardRate),
        parseAmountInput(baseAmount),
      ),
    [bidAmount, awardRate, baseAmount],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const [noticeRes, sitesRes, decisionRes, reportsRes] = await Promise.all([
        fetch(`/api/bid-notices/${encodeURIComponent(noticeId)}`),
        fetch("/api/crawl-sites"),
        fetch(`/api/bid-amounts/${encodeURIComponent(noticeId)}`),
        fetch("/api/order-reports?completed=true"),
      ]);

      const noticeData = (await noticeRes.json()) as {
        notice?: KhnpBidNoticeRow;
        error?: string;
      };
      const sitesData = (await sitesRes.json()) as {
        sites?: CrawlSite[];
        error?: string;
      };
      const decisionData = (await decisionRes.json()) as {
        decision?: UserBidAmountDecision | null;
        error?: string;
      };
      const reportsData = (await reportsRes.json()) as {
        noticeIds?: string[];
        error?: string;
      };

      if (!noticeRes.ok) {
        throw new Error(noticeData.error ?? "공고를 불러오지 못했습니다.");
      }
      if (!decisionRes.ok) {
        throw new Error(
          decisionData.error ?? "투찰금액 정보를 불러오지 못했습니다.",
        );
      }
      if (!reportsRes.ok) {
        throw new Error(
          reportsData.error ?? "발주보고 완료 여부를 확인하지 못했습니다.",
        );
      }

      const completedIds = new Set(reportsData.noticeIds ?? []);
      if (!completedIds.has(noticeId)) {
        throw new Error(
          "발주보고가 완료된 공고만 투찰금액을 결정할 수 있습니다.",
        );
      }

      const nextNotice = noticeData.notice ?? null;
      setNotice(nextNotice);
      const sites = (sitesData.sites ?? []).filter((s) => s.is_active !== false);
      setSiteName(
        nextNotice
          ? sites.find((s) => s.id === nextNotice.site_id)?.site_name
          : undefined,
      );

      const nextDecision = decisionData.decision ?? null;
      setDecision(nextDecision);
      setBidAmount(amountToInput(nextDecision?.bidAmount));
      setBaseAmount(amountToInput(nextDecision?.baseAmount));
      setAwardRate(rateToInput(nextDecision?.awardRate));
      setMemo(nextDecision?.memo ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setNotice(null);
      setDecision(null);
    } finally {
      setIsLoading(false);
    }
  }, [noticeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function save(status: "DRAFT" | "DECIDED") {
    setIsSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch(
        `/api/bid-amounts/${encodeURIComponent(noticeId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bidAmount,
            baseAmount,
            awardRate,
            memo,
            status,
          }),
        },
      );
      const data = (await response.json()) as {
        decision?: UserBidAmountDecision;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "투찰금액 저장에 실패했습니다.");
      }
      const next = data.decision ?? null;
      setDecision(next);
      if (next) {
        setBidAmount(amountToInput(next.bidAmount));
        setBaseAmount(amountToInput(next.baseAmount));
        setAwardRate(rateToInput(next.awardRate));
        setMemo(next.memo ?? "");
      }
      setSuccessMessage(
        status === "DECIDED"
          ? "투찰금액이 확정되었습니다."
          : "임시 저장되었습니다.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "투찰금액 저장에 실패했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-400">불러오는 중…</p>;
  }

  if (!notice) {
    return (
      <div>
        {error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        ) : (
          <p className="text-sm text-slate-500">공고를 찾을 수 없습니다.</p>
        )}
        <Link
          href="/dashboard/bid/amount"
          className="mt-4 inline-block text-sm font-medium text-[#004b87] underline-offset-2 hover:underline"
        >
          ← 입찰금액 결정 목록
        </Link>
      </div>
    );
  }

  const open = getOpenDetail(notice);
  const isDecided = decision?.status === "DECIDED";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/bid/amount"
          className="text-sm font-medium text-[#004b87] underline-offset-2 hover:underline"
        >
          ← 입찰금액 결정 목록
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              isDecided
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : decision
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {isDecided ? "확정" : decision ? "작성중" : "미결정"}
          </span>
          <Link
            href={`/dashboard/order-report/${encodeURIComponent(noticeId)}`}
            className="rounded-lg border border-[#004b87]/30 bg-[#004b87]/5 px-3 py-1.5 text-xs font-medium text-[#004b87] hover:bg-[#004b87]/10"
          >
            발주요약 보기
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">공고 정보</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">공고번호</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {notice.notice_no}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">사이트</dt>
            <dd className="mt-0.5 text-slate-700">{siteName ?? "-"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">공고명</dt>
            <dd className="mt-0.5 font-medium text-[#004b87]">{notice.title}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">공고구분</dt>
            <dd className="mt-0.5 text-slate-700">
              {BID_NOTICE_TYPE_LABELS[notice.notice_type]}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">부서</dt>
            <dd className="mt-0.5 text-slate-700">
              {formatDeptNameForList(notice.dept_name)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">입찰마감</dt>
            <dd className="mt-0.5 text-slate-700">
              {notice.notice_type === "BID"
                ? formatListDateTime(open?.bid_close_dt)
                : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">최근 저장</dt>
            <dd className="mt-0.5 text-slate-700">
              {decision
                ? formatListDateTime(decision.updatedAt)
                : "저장 이력 없음"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">투찰금액 결정</h2>
        <p className="mt-1 text-xs text-slate-500">
          기초금액·낙찰율을 입력하면 투찰율이 자동 계산됩니다. 「임시 저장」후
          「투찰금액 확정」으로 확정할 수 있습니다.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              기초금액 (원)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              placeholder="예: 1000000000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              낙찰율 (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={awardRate}
              onChange={(e) => setAwardRate(e.target.value)}
              placeholder="예: 87.745"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              투찰금액 (원)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="예: 850000000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              입력값: {formatOpeningAmount(parseAmountInput(bidAmount))}원
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              투찰율 (자동)
            </label>
            <div className="flex h-[38px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums text-slate-700">
              {formatOpeningRate(computedBidRate)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              투찰금액 ÷ 낙찰율 ÷ 기초금액 × 100
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder="결정 근거, 참고사항 등"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save("DRAFT")}
            disabled={isSaving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {isSaving ? "저장 중…" : "임시 저장"}
          </button>
          <button
            type="button"
            onClick={() => save("DECIDED")}
            disabled={isSaving}
            className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#003a6b] disabled:opacity-40"
          >
            {isSaving ? "저장 중…" : "투찰금액 확정"}
          </button>
        </div>
      </section>
    </div>
  );
}
