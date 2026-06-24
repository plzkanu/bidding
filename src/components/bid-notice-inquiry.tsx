"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BidNoticeDetailModal } from "@/components/bid-notice-detail-modal";
import { BidNoticeManualFormModal } from "@/components/bid-notice-manual-form";
import { BidNoticeFavoriteButton } from "@/components/bid-notice-favorite-button";
import {
  BidNoticeScreeningButton,
  getScreeningRowTextClass,
  getScreeningTitleClass,
} from "@/components/bid-notice-screening-button";
import { BidNoticeWorkMenu } from "@/components/bid-notice-work-menu";
import { BidNoticeAssignmentTableCells } from "@/components/bid-notice-assignment-fields";
import { CrawlSiteSelector } from "@/components/crawl-site-selector";
import { ScreeningKeywordChips } from "@/components/screening-keyword-chips";
import type { CrawlSite } from "@/lib/crawl-sites";
import {
  BID_NOTICE_TYPE_LABELS,
  type BidNoticeType,
  type KhnpBidNoticeRow,
} from "@/lib/bid-notices/types";
import {
  DEADLINE_CLOSED_LABEL,
  DEADLINE_WINDOW_LABELS,
  type DeadlineWindow,
} from "@/lib/bid-notices/deadline";
import {
  formatNoticeDateFilterSummary,
  getNoticeDateYesterdayFilterSummary,
  isValidNoticeDateYmd,
  NOTICE_DATE_YESTERDAY_LABEL,
} from "@/lib/bid-notices/notice-date";
import type { BidNoticeScreeningStatus } from "@/lib/bid-notices/screening";
import type { NoticeActivityEntry } from "@/lib/bid-notices/notice-activity";
import type { BidNoticeAssignment } from "@/lib/bid-notices/assignments";
import type { Department } from "@/lib/departments";
import { downloadBidNoticeExcel } from "@/lib/bid-notices/excel-export";
import { isManualBidNotice } from "@/lib/bid-notices/manual-entry";
import {
  formatDeptNameForList,
  formatListDate,
  formatListDateTime,
  formatNoticePeriodForList,
  getOpenDetail,
  getPrivateDetail,
  LIST_DATE_COL_CLASS,
  LIST_DATETIME_COL_CLASS,
  LIST_PERIOD_COL_CLASS,
  truncateText,
} from "@/lib/bid-notices/utils";

const NOTICE_TYPES: BidNoticeType[] = ["BID", "PRIVATE", "PLAN_SPEC"];
const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10_000;
const SITE_STORAGE_KEY = "bid-notice-site-id";

const LIST_TABLE_CLASS = "w-full table-fixed text-left text-xs";
const BID_STATUS_COL_CLASS = "w-[4.5rem] whitespace-nowrap px-2 py-1.5";
const BID_PURCHASE_TYPE_COL_CLASS = "w-[3.5rem] whitespace-nowrap px-2 py-1.5";
const FAVORITE_COL_CLASS = "w-9 px-1 py-1.5 text-center";
const SCREENING_COL_CLASS = "w-[3.25rem] px-1 py-1.5 text-center";
const WORK_ACTION_COL_CLASS = "w-[4.5rem] px-1 py-1.5 text-center";
const NOTICE_NO_COL_CLASS = "w-[5.5rem] whitespace-nowrap px-2 py-1.5 align-top";
/** 공고명: 가변 영역 대비 약 60% (≈22rem) */
const NOTICE_TITLE_COL_CLASS =
  "w-[22rem] max-w-[22rem] px-2 py-1.5 break-words align-top";
const DEPT_COL_CLASS = "w-[6rem] truncate px-2 py-1.5";
const ASSIGNED_DEPT_COL_CLASS = "w-[5.5rem] px-2 py-1.5";
const ASSIGNED_USER_COL_CLASS = "w-[4.5rem] px-2 py-1.5";
const NOTICE_DATE_COL_CLASS = LIST_DATE_COL_CLASS;
/** 입찰마감 */
const BID_CLOSE_COL_CLASS = LIST_DATETIME_COL_CLASS;
/** 공고기간 */
const PERIOD_COL_CLASS = LIST_PERIOD_COL_CLASS;
const PRIVATE_CONTENT_COL_CLASS = "min-w-0 truncate px-2 py-1.5";

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

interface BidNoticeInquiryProps {
  /** 관심공고 메뉴 등: 처음부터 관심공고만 조회 */
  defaultFavoritesOnly?: boolean;
}

function parseDeadlineWindow(
  value: string | null,
): DeadlineWindow | null {
  if (value === "week" || value === "day") return value;
  return null;
}

function parseNoticeType(value: string | null): BidNoticeType | null {
  if (value && NOTICE_TYPES.includes(value as BidNoticeType)) {
    return value as BidNoticeType;
  }
  return null;
}

export function BidNoticeInquiry({
  defaultFavoritesOnly = false,
}: BidNoticeInquiryProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDeadlineWindow = parseDeadlineWindow(
    searchParams.get("deadlineWindow"),
  );
  const initialFavoritesOnly =
    defaultFavoritesOnly || searchParams.get("favoritesOnly") === "true";
  const initialKeywordScreeningOnly =
    searchParams.get("keywordScreeningOnly") === "true";
  const initialNoticeType = parseNoticeType(searchParams.get("noticeType"));
  const initialSiteIdParam = searchParams.get("siteId");
  const parsedInitialSiteId = initialSiteIdParam
    ? Number(initialSiteIdParam)
    : NaN;
  const initialSiteIdFromUrl = !Number.isNaN(parsedInitialSiteId)
    ? parsedInitialSiteId
    : null;
  const initialNoticeDateParam = searchParams.get("noticeDate");
  const initialNoticeDate = isValidNoticeDateYmd(initialNoticeDateParam)
    ? initialNoticeDateParam
    : null;

  const [sites, setSites] = useState<CrawlSite[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [noticeType, setNoticeType] = useState<BidNoticeType>(
    initialNoticeType ?? "BID",
  );
  const [deadlineWindow, setDeadlineWindow] = useState<DeadlineWindow | null>(
    initialDeadlineWindow,
  );
  const [deadlineClosed, setDeadlineClosed] = useState(
    !initialDeadlineWindow && searchParams.get("deadlineClosed") === "true",
  );
  const [favoritesOnly, setFavoritesOnly] = useState(initialFavoritesOnly);
  const [keywordScreeningOnly, setKeywordScreeningOnly] = useState(
    initialKeywordScreeningOnly,
  );
  const [activeKeywords, setActiveKeywords] = useState<string[]>([]);
  const [showRegisteredKeywords, setShowRegisteredKeywords] = useState(false);
  const [noticeDateYesterday, setNoticeDateYesterday] = useState(
    initialNoticeDate ? false : searchParams.get("noticeDateYesterday") === "true",
  );
  const [noticeDateFilter, setNoticeDateFilter] = useState<string | null>(
    initialNoticeDate,
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [submissionIds, setSubmissionIds] = useState<Set<string>>(new Set());
  const [estimateIds, setEstimateIds] = useState<Set<string>>(new Set());
  const [orderReportIds, setOrderReportIds] = useState<Set<string>>(new Set());
  const [screeningStatuses, setScreeningStatuses] = useState<
    Record<string, BidNoticeScreeningStatus>
  >({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<
    Record<string, BidNoticeAssignment>
  >({});
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [notices, setNotices] = useState<KhnpBidNoticeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [isLoadingNotices, setIsLoadingNotices] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState<string | null>(
    null,
  );
  const [cyclingScreeningId, setCyclingScreeningId] = useState<string | null>(
    null,
  );
  const [submittingBidId, setSubmittingBidId] = useState<string | null>(null);
  const [submittingEstimateId, setSubmittingEstimateId] = useState<string | null>(
    null,
  );
  const [submittingOrderReportId, setSubmittingOrderReportId] = useState<
    string | null
  >(null);
  const [error, setError] = useState("");
  const [detailNotice, setDetailNotice] = useState<KhnpBidNoticeRow | null>(null);
  const [detailIsFavorite, setDetailIsFavorite] = useState(false);
  const [detailIsSubmitted, setDetailIsSubmitted] = useState(false);
  const [detailIsEstimated, setDetailIsEstimated] = useState(false);
  const [detailIsOrderReported, setDetailIsOrderReported] = useState(false);
  const [detailMemo, setDetailMemo] = useState("");
  const [detailMemoUpdatedAt, setDetailMemoUpdatedAt] = useState<string | null>(
    null,
  );
  const [detailAssignment, setDetailAssignment] =
    useState<BidNoticeAssignment | null>(null);
  const [detailCanEdit, setDetailCanEdit] = useState(false);
  const [detailCanDelete, setDetailCanDelete] = useState(false);
  const [detailActivities, setDetailActivities] = useState<NoticeActivityEntry[]>(
    [],
  );
  const [isDeletingNotice, setIsDeletingNotice] = useState(false);
  const [manualFormMode, setManualFormMode] = useState<"create" | "edit" | null>(
    null,
  );
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedSite = sites.find((s) => s.id === siteId);
  const activeKeywordCount = activeKeywords.length;

  const syncNoticeDateInUrl = useCallback(
    (ymd: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (ymd) {
        params.set("noticeDate", ymd);
        params.delete("noticeDateYesterday");
      } else {
        params.delete("noticeDate");
      }
      const query = params.toString();
      router.replace(query ? `/dashboard/announcements?${query}` : "/dashboard/announcements");
    },
    [router, searchParams],
  );

  useEffect(() => {
    const fromUrl = searchParams.get("noticeDate");
    if (isValidNoticeDateYmd(fromUrl)) {
      setNoticeDateFilter(fromUrl);
      setNoticeDateYesterday(false);
      return;
    }
    if (!searchParams.get("noticeDate")) {
      setNoticeDateFilter(null);
    }
  }, [searchParams]);

  function clearNoticeDateFilter() {
    setNoticeDateFilter(null);
    setPage(1);
    syncNoticeDateInUrl(null);
  }

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
          if (
            initialSiteIdFromUrl != null &&
            activeSites.some((s) => s.id === initialSiteIdFromUrl)
          ) {
            return initialSiteIdFromUrl;
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

  const loadFavoriteIds = useCallback(async () => {
    if (siteId == null) {
      setFavoriteIds(new Set());
      return;
    }

    try {
      const params = new URLSearchParams({
        siteId: String(siteId),
        noticeType,
      });
      const response = await fetch(`/api/bid-favorites?${params}`);
      const data = (await response.json()) as {
        noticeIds?: string[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "관심공고 목록을 불러오지 못했습니다.");
      }
      setFavoriteIds(new Set(data.noticeIds ?? []));
    } catch (err) {
      setFavoriteIds(new Set());
      setError(err instanceof Error ? err.message : "관심공고 목록을 불러오지 못했습니다.");
    }
  }, [siteId, noticeType]);

  const loadSubmissionIds = useCallback(async () => {
    try {
      const response = await fetch("/api/bid-submissions");
      const data = (await response.json()) as {
        noticeIds?: string[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "입찰 목록을 불러오지 못했습니다.");
      }
      setSubmissionIds(new Set(data.noticeIds ?? []));
    } catch (err) {
      setSubmissionIds(new Set());
      setError(err instanceof Error ? err.message : "입찰 목록을 불러오지 못했습니다.");
    }
  }, []);

  const loadEstimateIds = useCallback(async () => {
    try {
      const response = await fetch("/api/estimate-submissions");
      const data = (await response.json()) as {
        noticeIds?: string[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "견적 목록을 불러오지 못했습니다.");
      }
      setEstimateIds(new Set(data.noticeIds ?? []));
    } catch (err) {
      setEstimateIds(new Set());
      setError(err instanceof Error ? err.message : "견적 목록을 불러오지 못했습니다.");
    }
  }, []);

  const loadOrderReportIds = useCallback(async () => {
    try {
      const response = await fetch("/api/order-reports");
      const data = (await response.json()) as {
        noticeIds?: string[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "발주보고 목록을 불러오지 못했습니다.");
      }
      setOrderReportIds(new Set(data.noticeIds ?? []));
    } catch (err) {
      setOrderReportIds(new Set());
      setError(
        err instanceof Error ? err.message : "발주보고 목록을 불러오지 못했습니다.",
      );
    }
  }, []);

  const loadScreeningStatuses = useCallback(async () => {
    if (siteId == null) {
      setScreeningStatuses({});
      return;
    }

    try {
      const params = new URLSearchParams({
        siteId: String(siteId),
        noticeType,
      });
      const response = await fetch(`/api/bid-notice-screening?${params}`);
      const data = (await response.json()) as {
        statuses?: Record<string, BidNoticeScreeningStatus>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "선별 상태를 불러오지 못했습니다.");
      }
      setScreeningStatuses(data.statuses ?? {});
    } catch (err) {
      setScreeningStatuses({});
      setError(
        err instanceof Error ? err.message : "선별 상태를 불러오지 못했습니다.",
      );
    }
  }, [siteId, noticeType]);

  const loadDepartments = useCallback(async () => {
    try {
      const response = await fetch("/api/departments?activeOnly=true");
      const data = (await response.json()) as {
        departments?: Department[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "부서 목록을 불러오지 못했습니다.");
      }
      setDepartments(data.departments ?? []);
    } catch {
      setDepartments([]);
    }
  }, []);

  const loadAssignments = useCallback(async () => {
    if (siteId == null) {
      setAssignments({});
      return;
    }

    try {
      const params = new URLSearchParams({
        siteId: String(siteId),
        noticeType,
      });
      const response = await fetch(`/api/bid-notice-assignments?${params}`);
      const data = (await response.json()) as {
        assignments?: Record<string, BidNoticeAssignment>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "담당 지정 정보를 불러오지 못했습니다.");
      }
      setAssignments(data.assignments ?? {});
    } catch (err) {
      setAssignments({});
      setError(
        err instanceof Error ? err.message : "담당 지정 정보를 불러오지 못했습니다.",
      );
    }
  }, [siteId, noticeType]);

  const handleAssignmentSaved = useCallback(
    (assignment: BidNoticeAssignment) => {
      setAssignments((prev) => ({
        ...prev,
        [assignment.noticeId]: assignment,
      }));
      if (detailNotice?.id === assignment.noticeId) {
        setDetailAssignment(assignment);
      }
    },
    [detailNotice?.id],
  );

  const loadActiveKeywords = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/bid-notice-screening-keywords?activeOnly=true",
      );
      const data = (await response.json()) as {
        keywords?: { keyword: string }[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "자동선별 키워드를 불러오지 못했습니다.");
      }
      setActiveKeywords((data.keywords ?? []).map((row) => row.keyword));
    } catch {
      setActiveKeywords([]);
    }
  }, []);

  const loadNotices = useCallback(async () => {
    if (siteId == null) {
      setNotices([]);
      setTotal(0);
      return;
    }

    setIsLoadingNotices(true);
    setError("");
    try {
      const params = new URLSearchParams({
        siteId: String(siteId),
        noticeType,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (favoritesOnly) params.set("favoritesOnly", "true");
      if (keywordScreeningOnly) params.set("keywordScreeningOnly", "true");
      if (deadlineWindow) params.set("deadlineWindow", deadlineWindow);
      if (deadlineClosed) params.set("deadlineClosed", "true");
      if (noticeDateFilter) {
        params.set("noticeDate", noticeDateFilter);
      } else if (noticeDateYesterday) {
        params.set("noticeDateYesterday", "true");
      }

      const response = await fetch(`/api/bid-notices?${params}`);
      const data = (await response.json()) as {
        notices?: KhnpBidNoticeRow[];
        total?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "입찰공고를 불러오지 못했습니다.");
      }
      setNotices(data.notices ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setNotices([]);
      setTotal(0);
    } finally {
      setIsLoadingNotices(false);
    }
  }, [
    siteId,
    noticeType,
    page,
    search,
    favoritesOnly,
    keywordScreeningOnly,
    deadlineWindow,
    deadlineClosed,
    noticeDateYesterday,
    noticeDateFilter,
  ]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  useEffect(() => {
    loadFavoriteIds();
  }, [loadFavoriteIds]);

  useEffect(() => {
    loadSubmissionIds();
  }, [loadSubmissionIds]);

  useEffect(() => {
    loadEstimateIds();
  }, [loadEstimateIds]);

  useEffect(() => {
    loadOrderReportIds();
  }, [loadOrderReportIds]);

  useEffect(() => {
    loadScreeningStatuses();
  }, [loadScreeningStatuses]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    loadActiveKeywords();
  }, [loadActiveKeywords]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  const toggleFavorite = useCallback(
    async (noticeId: string, currentlyFavorite: boolean) => {
      setIsTogglingFavorite(noticeId);
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
          throw new Error(
            data.error ??
              (currentlyFavorite
                ? "관심공고 해제에 실패했습니다."
                : "관심공고 등록에 실패했습니다."),
          );
        }

        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (currentlyFavorite) {
            next.delete(noticeId);
          } else {
            next.add(noticeId);
          }
          return next;
        });

        if (detailNotice?.id === noticeId) {
          setDetailIsFavorite(!currentlyFavorite);
        }

        if (favoritesOnly && currentlyFavorite) {
          setNotices((prev) => prev.filter((n) => n.id !== noticeId));
          setTotal((t) => Math.max(0, t - 1));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      } finally {
        setIsTogglingFavorite(null);
      }
    },
    [detailNotice?.id, favoritesOnly],
  );

  const refreshDetailActivities = useCallback(async (noticeId: string) => {
    try {
      const response = await fetch(`/api/bid-notices/${noticeId}`);
      const data = (await response.json()) as {
        activities?: NoticeActivityEntry[];
      };
      if (response.ok && Array.isArray(data.activities)) {
        setDetailActivities(data.activities);
      }
    } catch {
      /* ignore background refresh */
    }
  }, []);

  const cycleScreening = useCallback(async (noticeId: string) => {
    setCyclingScreeningId(noticeId);
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
      setScreeningStatuses((prev) => ({
        ...prev,
        [noticeId]: nextStatus,
      }));
      if (detailNotice?.id === noticeId) {
        void refreshDetailActivities(noticeId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "선별 상태 변경에 실패했습니다.",
      );
    } finally {
      setCyclingScreeningId(null);
    }
  }, [detailNotice?.id, refreshDetailActivities]);

  const submitBid = useCallback(
    async (noticeId: string) => {
      setSubmittingBidId(noticeId);
      setError("");
      try {
        const response = await fetch("/api/bid-submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noticeId }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "입찰 등록에 실패했습니다.");
        }

        setSubmissionIds((prev) => new Set(prev).add(noticeId));
        if (detailNotice?.id === noticeId) {
          setDetailIsSubmitted(true);
          void refreshDetailActivities(noticeId);
        }

        router.push(
          `/dashboard/bid?noticeId=${encodeURIComponent(noticeId)}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "입찰 등록에 실패했습니다.");
      } finally {
        setSubmittingBidId(null);
      }
    },
    [detailNotice?.id, refreshDetailActivities, router],
  );

  const submitEstimate = useCallback(
    async (noticeId: string) => {
      setSubmittingEstimateId(noticeId);
      setError("");
      try {
        const response = await fetch("/api/estimate-submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noticeId }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "견적 등록에 실패했습니다.");
        }

        setEstimateIds((prev) => new Set(prev).add(noticeId));
        if (detailNotice?.id === noticeId) {
          setDetailIsEstimated(true);
          void refreshDetailActivities(noticeId);
        }

        router.push(
          `/dashboard/estimate?noticeId=${encodeURIComponent(noticeId)}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "견적 등록에 실패했습니다.");
      } finally {
        setSubmittingEstimateId(null);
      }
    },
    [detailNotice?.id, refreshDetailActivities, router],
  );

  const submitOrderReport = useCallback(
    async (noticeId: string) => {
      setSubmittingOrderReportId(noticeId);
      setError("");
      try {
        const response = await fetch("/api/order-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noticeId }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "발주보고 등록에 실패했습니다.");
        }

        setOrderReportIds((prev) => new Set(prev).add(noticeId));
        if (detailNotice?.id === noticeId) {
          setDetailIsOrderReported(true);
          void refreshDetailActivities(noticeId);
        }

        router.push(`/dashboard/order-report/${encodeURIComponent(noticeId)}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "발주보고 등록에 실패했습니다.",
        );
      } finally {
        setSubmittingOrderReportId(null);
      }
    },
    [detailNotice?.id, refreshDetailActivities, router],
  );

  function handleSiteChange(id: number) {
    setSiteId(id);
    setPage(1);
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
        isSubmitted?: boolean;
        isEstimated?: boolean;
        isOrderReported?: boolean;
        memo?: string;
        memoUpdatedAt?: string | null;
        assignment?: BidNoticeAssignment | null;
        activities?: NoticeActivityEntry[];
        canEdit?: boolean;
        canDelete?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "상세 정보를 불러오지 못했습니다.");
      }
      if (data.notice) {
        setDetailNotice(data.notice);
        setDetailIsFavorite(
          typeof data.isFavorite === "boolean"
            ? data.isFavorite
            : favoriteIds.has(noticeId),
        );
        setDetailIsSubmitted(
          typeof data.isSubmitted === "boolean"
            ? data.isSubmitted
            : submissionIds.has(noticeId),
        );
        setDetailIsEstimated(
          typeof data.isEstimated === "boolean"
            ? data.isEstimated
            : estimateIds.has(noticeId),
        );
        setDetailIsOrderReported(
          typeof data.isOrderReported === "boolean"
            ? data.isOrderReported
            : orderReportIds.has(noticeId),
        );
        setDetailMemo(data.memo ?? "");
        setDetailMemoUpdatedAt(data.memoUpdatedAt ?? null);
        setDetailAssignment(data.assignment ?? null);
        setDetailActivities(data.activities ?? []);
        setDetailCanEdit(Boolean(data.canEdit));
        setDetailCanDelete(Boolean(data.canDelete));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setDetailLoadingId(null);
    }
  }

  function handleNoticeTypeChange(type: BidNoticeType) {
    setNoticeType(type);
    setPage(1);
  }

  function clearDeadlineFilter() {
    setDeadlineWindow(null);
    setPage(1);
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  async function fetchAllNoticesForExport(): Promise<KhnpBidNoticeRow[]> {
    if (siteId == null) return [];

    const all: KhnpBidNoticeRow[] = [];
    let exportPage = 1;
    let expectedTotal = 0;

    while (all.length < MAX_EXPORT_ROWS) {
      const params = new URLSearchParams({
        siteId: String(siteId),
        noticeType,
        page: String(exportPage),
        pageSize: String(EXPORT_PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (favoritesOnly) params.set("favoritesOnly", "true");
      if (keywordScreeningOnly) params.set("keywordScreeningOnly", "true");
      if (deadlineWindow) params.set("deadlineWindow", deadlineWindow);
      if (deadlineClosed) params.set("deadlineClosed", "true");
      if (noticeDateFilter) {
        params.set("noticeDate", noticeDateFilter);
      } else if (noticeDateYesterday) {
        params.set("noticeDateYesterday", "true");
      }

      const response = await fetch(`/api/bid-notices?${params}`);
      const data = (await response.json()) as {
        notices?: KhnpBidNoticeRow[];
        total?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "입찰공고를 불러오지 못했습니다.");
      }

      const batch = data.notices ?? [];
      expectedTotal = data.total ?? expectedTotal;
      all.push(...batch);

      if (batch.length === 0 || all.length >= expectedTotal) {
        break;
      }
      exportPage += 1;
    }

    if (all.length > MAX_EXPORT_ROWS) {
      return all.slice(0, MAX_EXPORT_ROWS);
    }
    return all;
  }

  async function handleExcelExport() {
    if (siteId == null || !selectedSite || total === 0) return;

    setIsExporting(true);
    setError("");
    try {
      const rows = await fetchAllNoticesForExport();
      if (rows.length === 0) {
        throw new Error("다운로드할 공고가 없습니다.");
      }
      downloadBidNoticeExcel(rows, {
        noticeType,
        favoriteIds,
        siteName: selectedSite.site_name,
        favoritesOnly,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "엑셀 다운로드에 실패했습니다.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteNotice(noticeId: string) {
    if (
      !confirm(
        "이 공고를 삭제하시겠습니까? 삭제된 공고는 목록에 표시되지 않습니다.",
      )
    ) {
      return;
    }

    setIsDeletingNotice(true);
    setError("");
    try {
      const response = await fetch(
        `/api/bid-notices/${encodeURIComponent(noticeId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "공고 삭제에 실패했습니다.");
      }

      setDetailNotice(null);
      setDetailCanEdit(false);
      setDetailCanDelete(false);
      await loadNotices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "공고 삭제에 실패했습니다.");
    } finally {
      setIsDeletingNotice(false);
    }
  }

  function handleManualFormSaved(notice: KhnpBidNoticeRow) {
    setManualFormMode(null);
    setDetailNotice(null);
    setDetailCanEdit(false);
    setDetailCanDelete(false);
    void loadNotices().then(() => openDetail(notice.id));
  }

  return (
    <div>
      <CrawlSiteSelector
        sites={sites}
        selectedSiteId={siteId}
        onSelect={handleSiteChange}
        isLoading={isLoadingSites}
      />

      <form
        onSubmit={handleSearchSubmit}
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:max-w-2xl"
      >
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="공고번호·공고명·부서 검색"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[#004b87] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003d6e]"
          >
            검색
          </button>
          <button
            type="button"
            onClick={() => loadNotices()}
            disabled={isLoadingNotices || siteId == null}
            className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={() => setManualFormMode("create")}
            disabled={siteId == null}
            className="shrink-0 rounded-lg bg-[#a4ce39] px-4 py-2 text-sm font-semibold text-[#004b87] hover:bg-[#95bd33] disabled:opacity-40"
          >
            공고 직접 등록
          </button>
          <button
            type="button"
            onClick={() => handleExcelExport()}
            disabled={
              isExporting ||
              isLoadingNotices ||
              siteId == null ||
              total === 0
            }
            className="shrink-0 rounded-lg border border-[#009ada] px-4 py-2 text-sm font-medium text-[#004b87] hover:bg-[#009ada]/5 disabled:opacity-40"
          >
            {isExporting ? "다운로드 중…" : "엑셀 다운로드"}
          </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => {
              setFavoritesOnly(e.target.checked);
              setPage(1);
            }}
            className="size-4 rounded border-slate-300 text-[#004b87] focus:ring-[#009ada]/20"
          />
          관심공고만 보기
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={keywordScreeningOnly}
            onChange={(e) => {
              setKeywordScreeningOnly(e.target.checked);
              setPage(1);
            }}
            className="size-4 rounded border-slate-300 text-[#004b87] focus:ring-[#009ada]/20"
          />
          자동선별
          {activeKeywordCount > 0 ? (
            <span className="text-xs text-slate-500">
              (키워드 {activeKeywordCount.toLocaleString("ko-KR")}개)
            </span>
          ) : null}
        </label>
        {activeKeywordCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowRegisteredKeywords((prev) => !prev)}
            className="text-xs text-[#004b87] underline hover:text-[#003d6e]"
          >
            {showRegisteredKeywords ? "키워드 숨기기" : "키워드 보기"}
          </button>
        ) : null}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={noticeDateYesterday}
            onChange={(e) => {
              const checked = e.target.checked;
              setNoticeDateYesterday(checked);
              if (checked) {
                setNoticeDateFilter(null);
                syncNoticeDateInUrl(null);
              }
              setPage(1);
            }}
            disabled={Boolean(noticeDateFilter)}
            className="size-4 rounded border-slate-300 text-[#004b87] focus:ring-[#009ada]/20"
          />
          {NOTICE_DATE_YESTERDAY_LABEL}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={deadlineClosed}
            onChange={(e) => {
              const checked = e.target.checked;
              setDeadlineClosed(checked);
              if (checked) {
                setDeadlineWindow(null);
              }
              setPage(1);
            }}
            className="size-4 rounded border-slate-300 text-[#004b87] focus:ring-[#009ada]/20"
          />
          {DEADLINE_CLOSED_LABEL}
        </label>
        {noticeDateFilter ? (
          <button
            type="button"
            onClick={clearNoticeDateFilter}
            className="inline-flex items-center gap-1 rounded-full border border-[#1E5FD4]/30 bg-[#E8F0FE] px-2.5 py-0.5 text-xs font-medium text-[#1E5FD4] hover:bg-[#1E5FD4]/10"
          >
            {formatNoticeDateFilterSummary(noticeDateFilter)}
            <span aria-hidden>×</span>
          </button>
        ) : null}
        <span className="text-xs text-slate-500">
          관심 등록 {favoriteIds.size.toLocaleString("ko-KR")}건 · 입찰 등록{" "}
          {submissionIds.size.toLocaleString("ko-KR")}건 · 견적 등록{" "}
          {estimateIds.size.toLocaleString("ko-KR")}건
        </span>
      </div>

      {showRegisteredKeywords && activeKeywords.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[#009ada]/20 bg-[#009ada]/5 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#004b87]">
              등록된 자동선별 키워드 ({activeKeywords.length.toLocaleString("ko-KR")}개)
            </p>
            <span className="text-xs text-slate-500">
              공고명·공고번호·부서 중 하나에 포함되면 표시
            </span>
          </div>
          <ScreeningKeywordChips keywords={activeKeywords} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {NOTICE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleNoticeTypeChange(type)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              noticeType === type
                ? "bg-[#004b87] text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {BID_NOTICE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {deadlineWindow ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900 ring-1 ring-amber-200">
            {DEADLINE_WINDOW_LABELS[deadlineWindow]} 필터 적용 중
          </span>
          <button
            type="button"
            onClick={clearDeadlineFilter}
            className="text-sm text-slate-600 underline hover:text-[#004b87]"
          >
            필터 해제
          </button>
        </div>
      ) : null}

      {selectedSite ? (
        <p className="mt-3 text-sm text-slate-500">
          {selectedSite.site_name} · {BID_NOTICE_TYPE_LABELS[noticeType]}
          {favoritesOnly ? " · 관심공고" : ""}
          {keywordScreeningOnly ? " · 자동선별" : ""}
          {noticeDateFilter
            ? ` · ${formatNoticeDateFilterSummary(noticeDateFilter)}`
            : noticeDateYesterday
            ? ` · ${getNoticeDateYesterdayFilterSummary()}`
            : ""}
          {deadlineClosed ? ` · ${DEADLINE_CLOSED_LABEL}` : ""}
          {deadlineWindow
            ? ` · ${DEADLINE_WINDOW_LABELS[deadlineWindow]}`
            : ""}{" "}
          · 총 {total.toLocaleString("ko-KR")}건
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoadingNotices || isLoadingSites ? (
          <p className="px-6 py-16 text-center text-sm text-slate-400">
            불러오는 중…
          </p>
        ) : sites.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-slate-500">
            활성화된 입찰공고 사이트가 없습니다. 관리자 메뉴에서 사이트를
            등록하세요.
          </p>
        ) : notices.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-slate-500">
            {favoritesOnly
              ? "등록된 관심공고가 없습니다. 목록에서 ☆를 눌러 추가하세요."
              : keywordScreeningOnly && activeKeywordCount === 0
                ? "자동선별 키워드가 등록되지 않았습니다. 관리자 메뉴에서 키워드를 등록하세요."
                : keywordScreeningOnly
                  ? "등록된 키워드에 해당하는 공고가 없습니다."
                  : deadlineClosed
                    ? "입찰마감이 종료된 공고가 없습니다."
                    : deadlineWindow
                      ? "해당 조건의 마감 임박 공고가 없습니다."
                      : "조회된 공고가 없습니다."}
          </p>
        ) : (
          <div>
            <table className={LIST_TABLE_CLASS}>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className={`${FAVORITE_COL_CLASS} font-medium`}>관심</th>
                  <th className={`${SCREENING_COL_CLASS} font-medium`}>선별</th>
                  <th className={`${WORK_ACTION_COL_CLASS} font-medium`}>
                    작업
                  </th>
                  <th className={`${NOTICE_NO_COL_CLASS} font-medium`}>
                    공고번호
                  </th>
                  <th className={`${NOTICE_TITLE_COL_CLASS} font-medium`}>
                    공고명
                  </th>
                  {noticeType === "BID" ? (
                    <>
                      <th className={`${BID_STATUS_COL_CLASS} font-medium`}>
                        상태
                      </th>
                      <th
                        className={`${BID_PURCHASE_TYPE_COL_CLASS} font-medium`}
                      >
                        구분
                      </th>
                      <th className={`${BID_CLOSE_COL_CLASS} font-medium`}>
                        입찰마감
                      </th>
                    </>
                  ) : null}
                  {noticeType === "PRIVATE" ? (
                    <th className={`${PRIVATE_CONTENT_COL_CLASS} font-medium`}>
                      주요구매내용
                    </th>
                  ) : null}
                  <th className={`${ASSIGNED_DEPT_COL_CLASS} font-medium`}>
                    담당부서
                  </th>
                  <th className={`${ASSIGNED_USER_COL_CLASS} font-medium`}>
                    담당자
                  </th>
                  <th className={`${DEPT_COL_CLASS} font-medium`}>공고부서</th>
                  <th className={`${NOTICE_DATE_COL_CLASS} font-medium`}>
                    공고일시
                  </th>
                  <th className={`${PERIOD_COL_CLASS} font-medium`}>
                    공고기간
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notices.map((row) => (
                  <NoticeTableRow
                    key={row.id}
                    row={row}
                    noticeType={noticeType}
                    isFavorite={favoriteIds.has(row.id)}
                    isSubmitted={submissionIds.has(row.id)}
                    isEstimated={estimateIds.has(row.id)}
                    isOrderReported={orderReportIds.has(row.id)}
                    screeningStatus={screeningStatuses[row.id] ?? "WAITING"}
                    isCyclingScreening={cyclingScreeningId === row.id}
                    isSubmittingBid={submittingBidId === row.id}
                    isSubmittingEstimate={submittingEstimateId === row.id}
                    isSubmittingOrderReport={submittingOrderReportId === row.id}
                    isLoading={detailLoadingId === row.id}
                    departments={departments}
                    assignment={assignments[row.id] ?? null}
                    onAssignmentSaved={handleAssignmentSaved}
                    isTogglingFavorite={isTogglingFavorite === row.id}
                    onToggleFavorite={() =>
                      toggleFavorite(row.id, favoriteIds.has(row.id))
                    }
                    onCycleScreening={() => cycleScreening(row.id)}
                    onOrderReport={() => {
                      if (orderReportIds.has(row.id)) {
                        router.push(
                          `/dashboard/order-report?noticeId=${encodeURIComponent(row.id)}`,
                        );
                        return;
                      }
                      submitOrderReport(row.id);
                    }}
                    onSubmitBid={() => {
                      if (submissionIds.has(row.id)) {
                        router.push(
                          `/dashboard/bid?noticeId=${encodeURIComponent(row.id)}`,
                        );
                        return;
                      }
                      submitBid(row.id);
                    }}
                    onSubmitEstimate={() => {
                      if (estimateIds.has(row.id)) {
                        router.push(
                          `/dashboard/estimate?noticeId=${encodeURIComponent(row.id)}`,
                        );
                        return;
                      }
                      submitEstimate(row.id);
                    }}
                    onSelect={() => openDetail(row.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1 || isLoadingNotices}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-sm text-slate-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isLoadingNotices}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      ) : null}

      {detailNotice ? (
        <BidNoticeDetailModal
          notice={detailNotice}
          siteName={selectedSite?.site_name}
          isFavorite={detailIsFavorite}
          isSubmitted={detailIsSubmitted}
          isEstimated={detailIsEstimated}
          isOrderReported={detailIsOrderReported}
          isTogglingFavorite={isTogglingFavorite === detailNotice.id}
          isSubmittingBid={submittingBidId === detailNotice.id}
          isSubmittingEstimate={submittingEstimateId === detailNotice.id}
          isSubmittingOrderReport={submittingOrderReportId === detailNotice.id}
          initialMemo={detailMemo}
          initialMemoUpdatedAt={detailMemoUpdatedAt}
          departments={departments}
          initialAssignment={detailAssignment}
          onAssignmentSaved={handleAssignmentSaved}
          activities={detailActivities}
          onToggleFavorite={() =>
            toggleFavorite(detailNotice.id, detailIsFavorite)
          }
          onOrderReport={() => {
            if (detailIsOrderReported) {
              router.push(
                `/dashboard/order-report?noticeId=${encodeURIComponent(detailNotice.id)}`,
              );
              return;
            }
            submitOrderReport(detailNotice.id);
          }}
          onSubmitBid={() => {
            if (detailIsSubmitted) {
              router.push(
                `/dashboard/bid?noticeId=${encodeURIComponent(detailNotice.id)}`,
              );
              return;
            }
            submitBid(detailNotice.id);
          }}
          onSubmitEstimate={() => {
            if (detailIsEstimated) {
              router.push(
                `/dashboard/estimate?noticeId=${encodeURIComponent(detailNotice.id)}`,
              );
              return;
            }
            submitEstimate(detailNotice.id);
          }}
          onClose={() => {
            setDetailNotice(null);
            setDetailIsFavorite(false);
            setDetailIsSubmitted(false);
            setDetailIsEstimated(false);
            setDetailIsOrderReported(false);
            setDetailMemo("");
            setDetailMemoUpdatedAt(null);
            setDetailAssignment(null);
            setDetailActivities([]);
            setDetailCanEdit(false);
            setDetailCanDelete(false);
          }}
          canEdit={detailCanEdit}
          canDelete={detailCanDelete}
          isDeleting={isDeletingNotice}
          onEdit={() => setManualFormMode("edit")}
          onDelete={() => {
            if (detailNotice) {
              void handleDeleteNotice(detailNotice.id);
            }
          }}
        />
      ) : null}

      {manualFormMode && siteId != null && selectedSite ? (
        <BidNoticeManualFormModal
          mode={manualFormMode}
          siteId={siteId}
          siteName={selectedSite.site_name}
          noticeType={noticeType}
          initialNotice={manualFormMode === "edit" ? detailNotice : null}
          onClose={() => setManualFormMode(null)}
          onSaved={handleManualFormSaved}
        />
      ) : null}
    </div>
  );
}

function NoticeTableRow({
  row,
  noticeType,
  isFavorite,
  isSubmitted,
  isEstimated,
  isOrderReported,
  screeningStatus,
  onSelect,
  onToggleFavorite,
  onCycleScreening,
  onOrderReport,
  onSubmitBid,
  onSubmitEstimate,
  isLoading,
  isTogglingFavorite,
  isCyclingScreening,
  isSubmittingBid,
  isSubmittingEstimate,
  isSubmittingOrderReport,
  departments,
  assignment,
  onAssignmentSaved,
}: {
  row: KhnpBidNoticeRow;
  noticeType: BidNoticeType;
  isFavorite: boolean;
  isSubmitted: boolean;
  isEstimated: boolean;
  isOrderReported: boolean;
  screeningStatus: BidNoticeScreeningStatus;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onCycleScreening: () => void;
  onOrderReport: () => void;
  onSubmitBid: () => void;
  onSubmitEstimate: () => void;
  isLoading: boolean;
  isTogglingFavorite: boolean;
  isCyclingScreening: boolean;
  isSubmittingBid: boolean;
  isSubmittingEstimate: boolean;
  isSubmittingOrderReport: boolean;
  departments: Department[];
  assignment: BidNoticeAssignment | null;
  onAssignmentSaved: (assignment: BidNoticeAssignment) => void;
}) {
  const open = getOpenDetail(row);
  const priv = getPrivateDetail(row);
  const rowTextClass = getScreeningRowTextClass(screeningStatus);
  const titleClass = getScreeningTitleClass(screeningStatus);

  return (
    <tr
      className="cursor-pointer hover:bg-slate-50/80"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-no-row-click]")) {
          return;
        }
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      aria-busy={isLoading}
    >
      <td
        className={FAVORITE_COL_CLASS}
        data-no-row-click
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <BidNoticeFavoriteButton
          isFavorite={isFavorite}
          disabled={isTogglingFavorite}
          onToggle={onToggleFavorite}
          size="sm"
        />
      </td>
      <td
        className={SCREENING_COL_CLASS}
        data-no-row-click
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <BidNoticeScreeningButton
          status={screeningStatus}
          disabled={isCyclingScreening}
          onCycle={onCycleScreening}
        />
      </td>
      <td
        className={WORK_ACTION_COL_CLASS}
        data-no-row-click
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <BidNoticeWorkMenu
          isOrderReported={isOrderReported}
          isSubmitted={isSubmitted}
          isEstimated={isEstimated}
          isSubmittingOrderReport={isSubmittingOrderReport}
          isSubmittingBid={isSubmittingBid}
          isSubmittingEstimate={isSubmittingEstimate}
          onOrderReport={onOrderReport}
          onSubmitBid={onSubmitBid}
          onSubmitEstimate={onSubmitEstimate}
        />
      </td>
      <td className={`${NOTICE_NO_COL_CLASS} ${rowTextClass}`}>
        <div>{row.notice_no}</div>
        {row.notice_div ? (
          <span className="mt-0.5 inline-block text-[11px] opacity-80">
            {row.notice_div}
          </span>
        ) : null}
      </td>
      <td
        className={`${NOTICE_TITLE_COL_CLASS} ${titleClass} underline-offset-2 hover:underline`}
      >
        {isManualBidNotice(row) ? (
          <span className="mr-1 inline-flex rounded bg-[#a4ce39]/20 px-1 py-0.5 text-[10px] font-semibold text-[#3d5a14]">
            직접
          </span>
        ) : null}
        {row.title}
        {isLoading ? (
          <span className="ml-2 text-xs font-normal text-slate-400">…</span>
        ) : null}
      </td>
      {noticeType === "BID" ? (
        <>
          <td className={`${BID_STATUS_COL_CLASS} ${rowTextClass}`}>
            {open?.status ?? "-"}
          </td>
          <td className={`${BID_PURCHASE_TYPE_COL_CLASS} ${rowTextClass}`}>
            {open?.purchase_type ?? "-"}
          </td>
          <td className={`${BID_CLOSE_COL_CLASS} ${rowTextClass}`}>
            {formatListDateTime(open?.bid_close_dt)}
          </td>
        </>
      ) : null}
      {noticeType === "PRIVATE" ? (
        <td className={`${PRIVATE_CONTENT_COL_CLASS} ${rowTextClass}`}>
          {truncateText(priv?.main_content)}
        </td>
      ) : null}
      <BidNoticeAssignmentTableCells
        noticeId={row.id}
        departments={departments}
        assignment={assignment}
        onSaved={onAssignmentSaved}
        deptColClass={ASSIGNED_DEPT_COL_CLASS}
        assigneeColClass={ASSIGNED_USER_COL_CLASS}
      />
      <td className={`${DEPT_COL_CLASS} ${rowTextClass}`}>
        {formatDeptNameForList(row.dept_name)}
      </td>
      <td className={`${NOTICE_DATE_COL_CLASS} ${rowTextClass}`}>
        {formatListDate(row.notice_date)}
      </td>
      <td className={`${PERIOD_COL_CLASS} ${rowTextClass}`}>
        {formatNoticePeriodForList(row)}
      </td>
    </tr>
  );
}
