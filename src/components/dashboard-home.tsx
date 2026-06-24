"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BidNoticeDetailModal } from "@/components/bid-notice-detail-modal";
import { CrawlSiteSelector } from "@/components/crawl-site-selector";
import { DashboardNoticeCalendar as DashboardNoticeCalendarPanel } from "@/components/dashboard-notice-calendar";
import type {
  ApproachingDeadlineCounts,
  DashboardEstimateEntry,
  DashboardKpis,
  DashboardNoticeCalendar as DashboardNoticeCalendarData,
  DashboardOrgActivity,
  DashboardScheduleEntry,
  DashboardNoticeStatus,
} from "@/lib/bid-notices/dashboard";
import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";
import type { BidNoticeScreeningStatus } from "@/lib/bid-notices/screening";
import {
  formatListDate,
  formatDeptNameForList,
} from "@/lib/bid-notices/utils";
import type { CrawlSite } from "@/lib/crawl-sites";

const SITE_STORAGE_KEY = "bid-notice-site-id";

const STATUS_BADGE: Record<
  DashboardNoticeStatus,
  { label: string; className: string }
> = {
  new: { label: "신규", className: "bg-[#E8F0FE] text-[#1E5FD4]" },
  review: { label: "검토 중", className: "bg-[#FDF4E3] text-[#C8922A]" },
  submitted: { label: "제출 완료", className: "bg-[#E6F7F0] text-[#1E8A5A]" },
  missed: { label: "미참여", className: "bg-[#E8EAED] text-[#6B7280]" },
};

const BAR_COLORS = ["bg-[#1E5FD4]", "bg-[#1E8A5A]", "bg-[#C8922A]", "bg-[#1E5FD4]", "bg-[#BCC0C8]"];

function resolveInitialSiteId(
  sites: CrawlSite[],
  storedId: string | null,
): number | null {
  if (sites.length === 0) return null;
  const parsed = storedId ? Number(storedId) : NaN;
  if (!Number.isNaN(parsed) && sites.some((s) => s.id === parsed)) {
    return parsed;
  }
  const khnp = sites.find((s) => s.site_code === "KHNP");
  return khnp?.id ?? sites[0].id;
}

function formatPageDate(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatScheduleDate(iso: string): {
  month: string;
  day: string;
  dow: string;
  urgent: boolean;
} {
  const date = new Date(iso);
  const month = date
    .toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Seoul" })
    .toUpperCase();
  const day = date.toLocaleDateString("ko-KR", {
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
  const dow = date.toLocaleDateString("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  const diffMs = date.getTime() - Date.now();
  const urgent = diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
  return { month, day, dow, urgent };
}

export function DashboardHome() {
  const [sites, setSites] = useState<CrawlSite[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [noticeCalendar, setNoticeCalendar] =
    useState<DashboardNoticeCalendarData | null>(null);
  const [deadlineSchedule, setDeadlineSchedule] = useState<DashboardScheduleEntry[]>([]);
  const [estimates, setEstimates] = useState<DashboardEstimateEntry[]>([]);
  const [orgActivity, setOrgActivity] = useState<DashboardOrgActivity[]>([]);
  const [approachingCounts, setApproachingCounts] =
    useState<ApproachingDeadlineCounts | null>(null);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState("");
  const [detailNotice, setDetailNotice] = useState<KhnpBidNoticeRow | null>(null);
  const [detailIsFavorite, setDetailIsFavorite] = useState(false);
  const [detailMemo, setDetailMemo] = useState("");
  const [detailMemoUpdatedAt, setDetailMemoUpdatedAt] = useState<string | null>(null);
  const [detailScreeningStatus, setDetailScreeningStatus] =
    useState<BidNoticeScreeningStatus>("WAITING");
  const [isCyclingScreening, setIsCyclingScreening] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});

  const selectedSite = sites.find((s) => s.id === siteId);
  const todayLabel = formatPageDate(new Date());

  const loadSites = useCallback(async () => {
    setIsLoadingSites(true);
    setError("");
    try {
      const response = await fetch("/api/crawl-sites");
      const data = (await response.json()) as {
        sites?: CrawlSite[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "사이트 목록을 불러오지 못했습니다.");
      }
      const activeSites = (data.sites ?? []).filter((s) => s.is_active !== false);
      setSites(activeSites);
      if (activeSites.length > 0) {
        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem(SITE_STORAGE_KEY)
            : null;
        setSiteId((prev) => {
          if (prev != null && activeSites.some((s) => s.id === prev)) {
            return prev;
          }
          return resolveInitialSiteId(activeSites, stored);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoadingSites(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (siteId == null) {
      setKpis(null);
      setNoticeCalendar(null);
      setDeadlineSchedule([]);
      setEstimates([]);
      setOrgActivity([]);
      setApproachingCounts(null);
      return;
    }

    setIsLoadingData(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard?siteId=${siteId}`);
      const data = (await response.json()) as {
        kpis?: DashboardKpis;
        noticeCalendar?: DashboardNoticeCalendarData;
        deadlineSchedule?: DashboardScheduleEntry[];
        estimates?: DashboardEstimateEntry[];
        orgActivity?: DashboardOrgActivity[];
        approachingCounts?: ApproachingDeadlineCounts;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "대시보드를 불러오지 못했습니다.");
      }
      setKpis(data.kpis ?? null);
      setNoticeCalendar(data.noticeCalendar ?? null);
      setDeadlineSchedule(data.deadlineSchedule ?? []);
      setEstimates(data.estimates ?? []);
      setOrgActivity(data.orgActivity ?? []);
      setApproachingCounts(data.approachingCounts ?? null);
      setFavoriteOverrides({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoadingData(false);
    }
  }, [siteId]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function handleSiteChange(id: number) {
    setSiteId(id);
    localStorage.setItem(SITE_STORAGE_KEY, String(id));
  }

  async function openDetail(noticeId: string) {
    setDetailLoadingId(noticeId);
    setError("");
    try {
      const response = await fetch(`/api/bid-notices/${noticeId}`);
      const data = (await response.json()) as {
        notice?: KhnpBidNoticeRow;
        isFavorite?: boolean;
        memo?: string;
        memoUpdatedAt?: string | null;
        screeningStatus?: BidNoticeScreeningStatus;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "상세 정보를 불러오지 못했습니다.");
      }
      if (data.notice) {
        setDetailNotice(data.notice);
        setDetailIsFavorite(data.isFavorite ?? false);
        setDetailMemo(data.memo ?? "");
        setDetailMemoUpdatedAt(data.memoUpdatedAt ?? null);
        setDetailScreeningStatus(data.screeningStatus ?? "WAITING");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function cycleScreening(noticeId: string) {
    setIsCyclingScreening(true);
    setError("");
    try {
      const response = await fetch("/api/bid-notice-screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeId }),
      });
      const data = (await response.json()) as {
        status?: BidNoticeScreeningStatus;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "선별 상태 변경에 실패했습니다.");
      }
      const nextStatus = data.status ?? "WAITING";
      setDetailScreeningStatus(nextStatus);
      if (nextStatus === "EXCLUDED") {
        setDeadlineSchedule((prev) =>
          prev.filter((entry) => entry.notice.id !== noticeId),
        );
      } else {
        await loadDashboard();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsCyclingScreening(false);
    }
  }

  async function toggleFavorite(noticeId: string, currentlyFavorite: boolean) {
    setError("");
    try {
      const response = currentlyFavorite
        ? await fetch(
            `/api/bid-favorites?noticeId=${encodeURIComponent(noticeId)}`,
            { method: "DELETE" },
          )
        : await fetch("/api/bid-favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noticeId }),
          });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "관심공고 처리에 실패했습니다.");
      }
      setFavoriteOverrides((prev) => ({
        ...prev,
        [noticeId]: !currentlyFavorite,
      }));
      if (detailNotice?.id === noticeId) {
        setDetailIsFavorite(!currentlyFavorite);
      }
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    }
  }

  const isBusy = isLoadingSites || isLoadingData;
  const maxOrgParticipate = Math.max(
    ...orgActivity.map((item) => item.participateCount),
    1,
  );

  return (
    <div className="-m-7 flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-[#E8EAED] bg-white px-7 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="shrink-0">
            <h1 className="text-base font-bold text-[#0F2645]">대시보드</h1>
            <p className="text-xs text-[#6B7280]">{todayLabel}</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <CrawlSiteSelector
              sites={sites}
              selectedSiteId={siteId}
              onSelect={handleSiteChange}
              isLoading={isLoadingSites}
              variant="compact"
            />
            <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => loadDashboard()}
                disabled={isBusy || siteId == null}
                className="rounded-md border border-[#E8EAED] px-3 py-1.5 text-xs text-[#6B7280] hover:bg-[#F5F6F8] disabled:opacity-40"
              >
                새로고침
              </button>
              <Link
                href="/dashboard/estimate"
                className="flex items-center gap-1.5 rounded-md bg-[#1E5FD4] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1A3A6B]"
              >
                ＋ 견적 작성
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 px-7">
        {error ? (
          <p className="mb-4 rounded-lg bg-[#FDEAEA] px-4 py-3 text-sm text-[#D94040]">
            {error}
          </p>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="이번 달 수집 공고"
            value={kpis?.monthlyNotices ?? 0}
            sub={selectedSite ? `${selectedSite.site_name} 기준` : "사이트 선택 필요"}
            icon="📢"
            iconClass="bg-[#E8F0FE]"
          />
          <KpiCard
            label="검토 중 공고"
            value={kpis?.reviewingCount ?? 0}
            sub={
              <>
                마감 임박{" "}
                <span className="font-semibold text-[#D94040]">
                  {(kpis?.urgentDeadlineCount ?? 0).toLocaleString("ko-KR")}건
                </span>
              </>
            }
            icon="🔍"
            iconClass="bg-[#FDF4E3]"
          />
          <KpiCard
            label="제출 완료"
            value={kpis?.submittedCount ?? 0}
            sub={`견적 등록 ${(kpis?.estimateCount ?? 0).toLocaleString("ko-KR")}건`}
            icon="✅"
            iconClass="bg-[#E6F7F0]"
          />
          <KpiCard
            label="마감 임박 (관심공고)"
            value={
              approachingCounts
                ? Object.values(approachingCounts.week).reduce((a, b) => a + b, 0)
                : 0
            }
            sub="7일 이내 마감"
            icon="📅"
            iconClass="bg-[#E8F0FE]"
          />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(220px,1fr)_minmax(0,2.4fr)]">
          <DashboardCard
            title="공고일시 달력"
            actionHref={
              siteId != null
                ? `/dashboard/announcements?siteId=${siteId}`
                : "/dashboard/announcements"
            }
            actionLabel="입찰공고 조회 →"
          >
            <DashboardNoticeCalendarPanel
              calendar={noticeCalendar}
              siteId={siteId}
              isLoading={isBusy}
            />
          </DashboardCard>

          <DashboardCard
            title="입찰 마감 일정"
            actionHref="/dashboard/favorites"
            actionLabel="관심공고 →"
          >
            <div className="px-5 py-1">
              {isBusy ? (
                <EmptyState message="불러오는 중…" />
              ) : deadlineSchedule.length === 0 ? (
                <EmptyState message="예정된 마감 일정이 없습니다." />
              ) : (
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {deadlineSchedule.map((item) => {
                  const date = formatScheduleDate(item.deadlineIso);
                  return (
                    <button
                      key={`${item.notice.id}-${item.deadlineIso}`}
                      type="button"
                      onClick={() => openDetail(item.notice.id)}
                      className="flex w-full gap-3 border-b border-[#E8EAED] py-2.5 text-left hover:opacity-80"
                    >
                      <div className="w-11 shrink-0 text-center">
                        <div className="text-[10px] font-medium text-[#6B7280]">
                          {date.month}
                        </div>
                        <div
                          className={`text-xl leading-tight font-bold ${date.urgent || item.urgent ? "text-[#D94040]" : "text-[#0F2645]"}`}
                        >
                          {date.day}
                        </div>
                        <div className="text-[10px] text-[#6B7280]">{date.dow}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[#1A1E2C]">
                          {item.notice.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[#6B7280]">
                          {item.siteName ?? "-"}
                          {item.notice.dept_name
                            ? ` · ${formatDeptNameForList(item.notice.dept_name)}`
                            : ""}
                        </p>
                        <span className="mt-1 inline-flex rounded bg-[#E8F0FE] px-1.5 py-0.5 text-[10px] font-semibold text-[#1E5FD4]">
                          {item.scheduleLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
                </div>
              )}
            </div>
          </DashboardCard>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DashboardCard
            title="진행 중인 견적"
            actionHref="/dashboard/estimate"
            actionLabel="전체 보기 →"
          >
            <div className="grid grid-cols-[1fr_4rem_5rem] gap-2.5 border-b border-[#E8EAED] bg-[#F5F6F8] px-5 py-2 text-[11px] font-medium text-[#6B7280]">
              <span>공고명 / 발주처</span>
              <span>등록일</span>
              <span>상태</span>
            </div>
            {isBusy ? (
              <EmptyState message="불러오는 중…" />
            ) : estimates.length === 0 ? (
              <EmptyState message="진행 중인 견적이 없습니다." />
            ) : (
              estimates.map((item) => {
                const status = item.hasBid
                  ? { label: "제출 완료", className: STATUS_BADGE.submitted.className }
                  : item.hasEstimate
                    ? { label: "작성 중", className: STATUS_BADGE.review.className }
                    : { label: "미작성", className: STATUS_BADGE.new.className };
                return (
                  <button
                    key={item.notice.id}
                    type="button"
                    onClick={() => openDetail(item.notice.id)}
                    className="grid w-full grid-cols-[1fr_4rem_5rem] items-center gap-2.5 border-b border-[#E8EAED] px-5 py-2.5 text-left last:border-b-0 hover:bg-[#F5F6F8]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#1A1E2C]">
                        {item.notice.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#6B7280]">
                        {item.siteName ?? "-"}
                      </p>
                    </div>
                    <span className="text-[12px] text-[#6B7280]">
                      {item.submittedAt ? formatListDate(item.submittedAt) : "-"}
                    </span>
                    <span
                      className={`inline-flex w-fit rounded px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </button>
                );
              })
            )}
          </DashboardCard>

          <DashboardCard
            title="발주처별 참여 현황"
            actionHref="/dashboard/results"
            actionLabel="상세 조회 →"
          >
            <div className="space-y-3.5 px-5 py-4">
              {isBusy ? (
                <EmptyState message="불러오는 중…" />
              ) : orgActivity.length === 0 ? (
                <EmptyState message="활동 데이터가 없습니다." />
              ) : (
                orgActivity.map((item, index) => {
                  const rate =
                    item.participateCount > 0
                      ? Math.round((item.bidCount / item.participateCount) * 100)
                      : 0;
                  const width = Math.round(
                    (item.participateCount / maxOrgParticipate) * 100,
                  );
                  return (
                    <div key={item.label}>
                      <div className="mb-1.5 flex justify-between">
                        <span className="text-[12px] font-medium text-[#1A1E2C]">
                          {item.label}
                        </span>
                        <span className="text-[12px] font-bold text-[#0F2645]">
                          {rate}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#E8EAED]">
                        <div
                          className={`h-full rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-[#6B7280]">
                        공고 {item.participateCount.toLocaleString("ko-KR")}건 · 입찰{" "}
                        {item.bidCount.toLocaleString("ko-KR")}건
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </DashboardCard>
        </div>
      </div>

      {detailNotice ? (
        <BidNoticeDetailModal
          notice={detailNotice}
          siteName={selectedSite?.site_name}
          isFavorite={detailIsFavorite}
          onToggleFavorite={() =>
            toggleFavorite(detailNotice.id, detailIsFavorite)
          }
          screeningStatus={detailScreeningStatus}
          isCyclingScreening={isCyclingScreening}
          onCycleScreening={() => cycleScreening(detailNotice.id)}
          initialMemo={detailMemo}
          initialMemoUpdatedAt={detailMemoUpdatedAt}
          onClose={() => {
            setDetailNotice(null);
            setDetailMemo("");
            setDetailMemoUpdatedAt(null);
            setDetailScreeningStatus("WAITING");
          }}
        />
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  iconClass,
}: {
  label: string;
  value: number;
  sub: React.ReactNode;
  icon: string;
  iconClass: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[#E8EAED] bg-white px-5 py-4">
      <div className="flex items-start justify-between">
        <span className="text-xs text-[#6B7280]">{label}</span>
        <span
          className={`flex size-[34px] items-center justify-center rounded-lg text-base ${iconClass}`}
        >
          {icon}
        </span>
      </div>
      <div className="text-[26px] leading-none font-bold tracking-tight text-[#0F2645]">
        {value.toLocaleString("ko-KR")}
      </div>
      <div className="text-[11px] text-[#6B7280]">{sub}</div>
    </div>
  );
}

function DashboardCard({
  title,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#E8EAED] bg-white">
      <div className="flex items-center justify-between border-b border-[#E8EAED] px-5 py-3">
        <h2 className="text-sm font-bold text-[#0F2645]">{title}</h2>
        <Link href={actionHref} className="text-xs font-medium text-[#1E5FD4]">
          {actionLabel}
        </Link>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">{message}</p>
  );
}
