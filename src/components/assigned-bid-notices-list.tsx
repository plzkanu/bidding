"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BidNoticeDetailModal } from "@/components/bid-notice-detail-modal";
import type {
  AssignedBidNoticeItem,
  DepartmentAssignmentCount,
} from "@/lib/bid-notices/assigned-notices";
import type { BidNoticeAssignment } from "@/lib/bid-notices/assignments";
import {
  BID_NOTICE_TYPE_LABELS,
  type KhnpBidNoticeRow,
} from "@/lib/bid-notices/types";
import type { Department } from "@/lib/departments";
import type { CrawlSite } from "@/lib/crawl-sites";
import {
  formatDeptNameForList,
  formatListDate,
  formatNoticePeriodForList,
  LIST_DATE_COL_CLASS,
  LIST_PERIOD_COL_CLASS,
} from "@/lib/bid-notices/utils";

const PAGE_SIZE = 20;

const LIST_TABLE_CLASS = "w-full table-fixed text-left text-xs";
const NOTICE_NO_COL_CLASS = "w-[5.5rem] whitespace-nowrap px-2 py-1.5";
const NOTICE_TITLE_COL_CLASS =
  "w-[18rem] max-w-[18rem] px-2 py-1.5 break-words align-top";
const SITE_COL_CLASS = "w-[4.5rem] truncate px-2 py-1.5";
const ASSIGNED_DEPT_COL_CLASS = "w-[5.5rem] truncate px-2 py-1.5";
const ASSIGNED_USER_COL_CLASS = "w-[4.5rem] truncate px-2 py-1.5";
const NOTICE_DEPT_COL_CLASS = "w-[5.5rem] truncate px-2 py-1.5";
const NOTICE_DATE_COL_CLASS = LIST_DATE_COL_CLASS;
const PERIOD_COL_CLASS = LIST_PERIOD_COL_CLASS;

export function AssignedBidNoticesList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDepartmentId = searchParams.get("departmentId")?.trim() ?? null;

  const [sites, setSites] = useState<CrawlSite[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [items, setItems] = useState<AssignedBidNoticeItem[]>([]);
  const [departmentCounts, setDepartmentCounts] = useState<
    DepartmentAssignmentCount[]
  >([]);
  const [totalAssigned, setTotalAssigned] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(
    initialDepartmentId,
  );
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailNotice, setDetailNotice] = useState<KhnpBidNoticeRow | null>(null);
  const [detailAssignment, setDetailAssignment] =
    useState<BidNoticeAssignment | null>(null);
  const [detailSiteName, setDetailSiteName] = useState<string | undefined>();
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const siteNameById = new Map(sites.map((site) => [site.id, site.site_name]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const syncDepartmentInUrl = useCallback(
    (departmentId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (departmentId) {
        params.set("departmentId", departmentId);
      } else {
        params.delete("departmentId");
      }
      const query = params.toString();
      router.replace(
        query ? `/dashboard/assigned-notices?${query}` : "/dashboard/assigned-notices",
      );
    },
    [router, searchParams],
  );

  useEffect(() => {
    const fromUrl = searchParams.get("departmentId")?.trim() ?? null;
    setSelectedDepartmentId(fromUrl);
    setPage(1);
  }, [searchParams]);

  const loadSitesAndDepartments = useCallback(async () => {
    try {
      const [sitesRes, departmentsRes] = await Promise.all([
        fetch("/api/crawl-sites"),
        fetch("/api/departments?activeOnly=true"),
      ]);
      const sitesData = (await sitesRes.json()) as {
        sites?: CrawlSite[];
        error?: string;
      };
      const departmentsData = (await departmentsRes.json()) as {
        departments?: Department[];
        error?: string;
      };
      if (sitesRes.ok) {
        setSites((sitesData.sites ?? []).filter((site) => site.is_active !== false));
      }
      if (departmentsRes.ok) {
        setDepartments(departmentsData.departments ?? []);
      }
    } catch {
      setSites([]);
      setDepartments([]);
    }
  }, []);

  const loadNotices = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (selectedDepartmentId) {
        params.set("departmentId", selectedDepartmentId);
      }
      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/assigned-bid-notices?${params}`);
      const data = (await response.json()) as {
        items?: AssignedBidNoticeItem[];
        total?: number;
        departmentCounts?: DepartmentAssignmentCount[];
        totalAssigned?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "담당공고 목록을 불러오지 못했습니다.");
      }

      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setDepartmentCounts(data.departmentCounts ?? []);
      setTotalAssigned(data.totalAssigned ?? 0);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, selectedDepartmentId]);

  useEffect(() => {
    void loadSitesAndDepartments();
  }, [loadSitesAndDepartments]);

  useEffect(() => {
    void loadNotices();
  }, [loadNotices]);

  function handleDepartmentFilter(departmentId: string | null) {
    setSelectedDepartmentId(departmentId);
    setPage(1);
    syncDepartmentInUrl(departmentId);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  async function openDetail(noticeId: string, siteId: number) {
    setDetailLoadingId(noticeId);
    setError("");
    try {
      const response = await fetch(`/api/bid-notices/${noticeId}`);
      const data = (await response.json()) as {
        notice?: KhnpBidNoticeRow;
        assignment?: BidNoticeAssignment | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "상세 정보를 불러오지 못했습니다.");
      }
      if (data.notice) {
        setDetailNotice(data.notice);
        setDetailAssignment(data.assignment ?? null);
        setDetailSiteName(siteNameById.get(siteId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setDetailLoadingId(null);
    }
  }

  const visibleDepartmentCounts = departmentCounts.filter(
    (row) => row.isActive || row.count > 0,
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="text-sm text-slate-600">
        입찰공고 조회에서 담당부서가 지정된 공고만 모아 보여 줍니다. 부서별
        건수를 누르면 해당 부서 공고만 빠르게 조회할 수 있습니다.
      </p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">부서별 공고</h2>
          <span className="text-xs text-slate-500">전체 {totalAssigned}건</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleDepartmentFilter(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selectedDepartmentId == null
                ? "border-[#004b87] bg-[#004b87] text-white"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            전체 {totalAssigned}
          </button>
          {visibleDepartmentCounts.map((row) => (
            <button
              key={row.departmentId}
              type="button"
              onClick={() => handleDepartmentFilter(row.departmentId)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selectedDepartmentId === row.departmentId
                  ? "border-[#004b87] bg-[#004b87] text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              } ${!row.isActive ? "opacity-70" : ""}`}
            >
              {row.departmentName} {row.count}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="공고명·담당부서·담당자 검색"
          className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#003a6a]"
        >
          검색
        </button>
        {search ? (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            검색 초기화
          </button>
        ) : null}
      </form>

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
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            <p>조회된 공고가 없습니다.</p>
            <p className="mt-2">
              입찰공고 조회 화면에서 담당부서를 지정하면 이 목록에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={LIST_TABLE_CLASS}>
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className={`${NOTICE_NO_COL_CLASS} font-medium`}>공고번호</th>
                  <th className={`${NOTICE_TITLE_COL_CLASS} font-medium`}>공고명</th>
                  <th className={`${SITE_COL_CLASS} font-medium`}>사이트</th>
                  <th className={`${ASSIGNED_DEPT_COL_CLASS} font-medium`}>
                    담당부서
                  </th>
                  <th className={`${ASSIGNED_USER_COL_CLASS} font-medium`}>
                    담당자
                  </th>
                  <th className={`${NOTICE_DEPT_COL_CLASS} font-medium`}>
                    공고부서
                  </th>
                  <th className={`${NOTICE_DATE_COL_CLASS} font-medium`}>
                    공고일시
                  </th>
                  <th className={`${PERIOD_COL_CLASS} font-medium`}>공고기간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr
                    key={item.notice.id}
                    className="cursor-pointer hover:bg-slate-50/80"
                    onClick={() => openDetail(item.notice.id, item.notice.site_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetail(item.notice.id, item.notice.site_id);
                      }
                    }}
                    tabIndex={0}
                    aria-busy={detailLoadingId === item.notice.id}
                  >
                    <td className={`${NOTICE_NO_COL_CLASS} text-slate-700`}>
                      {item.notice.notice_no}
                    </td>
                    <td
                      className={`${NOTICE_TITLE_COL_CLASS} font-medium text-[#004b87] underline-offset-2 hover:underline`}
                    >
                      <span className="mr-1 text-[10px] font-semibold text-slate-500">
                        {BID_NOTICE_TYPE_LABELS[item.notice.notice_type]}
                      </span>
                      {item.notice.title}
                      {detailLoadingId === item.notice.id ? (
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          …
                        </span>
                      ) : null}
                    </td>
                    <td className={`${SITE_COL_CLASS} text-slate-600`}>
                      {siteNameById.get(item.notice.site_id) ?? "-"}
                    </td>
                    <td
                      className={`${ASSIGNED_DEPT_COL_CLASS} font-medium text-slate-700`}
                      title={item.assignment.departmentName}
                    >
                      {item.assignment.departmentName}
                    </td>
                    <td
                      className={`${ASSIGNED_USER_COL_CLASS} text-slate-600`}
                      title={item.assignment.assigneeName ?? undefined}
                    >
                      {item.assignment.assigneeName ?? "-"}
                    </td>
                    <td
                      className={`${NOTICE_DEPT_COL_CLASS} text-slate-600`}
                      title={item.notice.dept_name ?? undefined}
                    >
                      {formatDeptNameForList(item.notice.dept_name)}
                    </td>
                    <td className={`${NOTICE_DATE_COL_CLASS} text-slate-600`}>
                      {formatListDate(item.notice.notice_date)}
                    </td>
                    <td className={`${PERIOD_COL_CLASS} text-slate-600`}>
                      {formatNoticePeriodForList(item.notice)}
                    </td>
                  </tr>
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
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-sm text-slate-600">
            {page} / {totalPages} · 총 {total}건
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => loadNotices()}
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
          onToggleFavorite={() => {}}
          onClose={() => {
            setDetailNotice(null);
            setDetailAssignment(null);
            setDetailSiteName(undefined);
          }}
          showFavorite={false}
          departments={departments}
          initialAssignment={detailAssignment}
          onAssignmentSaved={(assignment) => {
            setDetailAssignment(assignment);
            void loadNotices();
          }}
        />
      ) : null}
    </div>
  );
}
