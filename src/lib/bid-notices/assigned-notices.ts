import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listDepartments } from "@/lib/departments";
import { getAllUsers } from "@/lib/users-store";
import {
  normalizeAssignmentsError,
  type BidNoticeAssignment,
} from "@/lib/bid-notices/assignments";
import { getBidNoticesByIds } from "@/lib/bid-notices/notice-repository";
import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";

export interface DepartmentAssignmentCount {
  departmentId: string;
  departmentName: string;
  count: number;
  isActive: boolean;
}

export interface AssignedBidNoticeItem {
  assignment: BidNoticeAssignment;
  notice: KhnpBidNoticeRow;
}

export interface ListAssignedBidNoticesOptions {
  departmentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AssignedBidNoticeListResult {
  items: AssignedBidNoticeItem[];
  total: number;
  departmentCounts: DepartmentAssignmentCount[];
  totalAssigned: number;
  error: string | null;
}

interface AssignmentRow {
  notice_id: string;
  department_id: string;
  assignee_user_id: string | null;
  updated_at: string | null;
  departments: { id?: string; name?: string } | null;
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 담당공고를 조회할 수 없습니다.";
  }
  return null;
}

function sanitizeSearchTerm(search?: string): string {
  return search?.trim().replace(/[,()]/g, " ").trim() ?? "";
}

function mapAssignmentRow(
  row: AssignmentRow,
  assigneeName: string | null,
  notice: KhnpBidNoticeRow,
): AssignedBidNoticeItem {
  return {
    assignment: {
      noticeId: row.notice_id,
      departmentId: row.department_id,
      departmentName: row.departments?.name ?? "",
      assigneeUserId: row.assignee_user_id,
      assigneeName,
      updatedAt: row.updated_at,
    },
    notice,
  };
}

async function getAssigneeNameMap(
  userIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const users = await getAllUsers();
  const map = new Map<string, string>();
  for (const user of users) {
    if (uniqueIds.includes(user.id)) {
      map.set(user.id, user.name);
    }
  }
  return map;
}

async function fetchAllAssignmentRows(): Promise<{
  rows: AssignmentRow[];
  error: string | null;
}> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bid_notice_assignments")
    .select(
      "notice_id, department_id, assignee_user_id, updated_at, departments (id, name)",
    );

  if (error) {
    return { rows: [], error: normalizeAssignmentsError(error.message) };
  }

  return { rows: (data ?? []) as AssignmentRow[], error: null };
}

async function getActiveAssignedNoticeIds(): Promise<{
  noticeIds: Set<string>;
  notices: Map<string, KhnpBidNoticeRow>;
  error: string | null;
}> {
  const { rows, error } = await fetchAllAssignmentRows();
  if (error) {
    return { noticeIds: new Set(), notices: new Map(), error };
  }

  const { notices, error: noticeError } = await getBidNoticesByIds(
    rows.map((row) => row.notice_id),
  );
  if (noticeError) {
    return { noticeIds: new Set(), notices: new Map(), error: noticeError };
  }

  const noticeIds = new Set<string>();
  for (const row of rows) {
    const notice = notices.get(row.notice_id);
    if (notice && !notice.is_deleted) {
      noticeIds.add(row.notice_id);
    }
  }

  return { noticeIds, notices, error: null };
}

async function searchNoticeIdsByTitle(
  pattern: string,
): Promise<{ noticeIds: string[]; error: string | null }> {
  const supabase = createServerClient();
  const noticeIds = new Set<string>();

  for (const table of ["khnp_bid_notice", "srm_bid_notice"] as const) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("is_deleted", false)
      .ilike("title", pattern);

    if (error) {
      return { noticeIds: [], error: normalizeAssignmentsError(error.message) };
    }

    for (const row of data ?? []) {
      noticeIds.add(row.id as string);
    }
  }

  return { noticeIds: [...noticeIds], error: null };
}

async function getSearchMatchingNoticeIds(
  search: string,
): Promise<{ noticeIds: string[] | null; error: string | null }> {
  const trimmed = sanitizeSearchTerm(search);
  if (!trimmed) {
    return { noticeIds: null, error: null };
  }

  try {
    const pattern = `%${trimmed}%`;
    const noticeIds = new Set<string>();
    const { noticeIds: activeAssignedIds, error: activeError } =
      await getActiveAssignedNoticeIds();
    if (activeError) {
      return { noticeIds: [], error: activeError };
    }

    const [titleResult, departmentResult, users] = await Promise.all([
      searchNoticeIdsByTitle(pattern),
      (async () => {
        const supabase = createServerClient();
        return supabase
          .from("bid_notice_assignments")
          .select("notice_id, departments!inner(name)")
          .ilike("departments.name", pattern);
      })(),
      getAllUsers(),
    ]);

    if (titleResult.error) {
      return { noticeIds: [], error: titleResult.error };
    }
    if (departmentResult.error) {
      return {
        noticeIds: [],
        error: normalizeAssignmentsError(departmentResult.error.message),
      };
    }

    for (const id of titleResult.noticeIds) {
      if (activeAssignedIds.has(id)) {
        noticeIds.add(id);
      }
    }

    for (const row of departmentResult.data ?? []) {
      const noticeId = row.notice_id as string;
      if (activeAssignedIds.has(noticeId)) {
        noticeIds.add(noticeId);
      }
    }

    const lowered = trimmed.toLowerCase();
    const matchingUserIds = users
      .filter((user) => user.name.toLowerCase().includes(lowered))
      .map((user) => user.id);

    if (matchingUserIds.length > 0) {
      const { rows, error } = await fetchAllAssignmentRows();
      if (error) {
        return { noticeIds: [], error };
      }

      for (const row of rows) {
        if (
          row.assignee_user_id &&
          matchingUserIds.includes(row.assignee_user_id) &&
          activeAssignedIds.has(row.notice_id)
        ) {
          noticeIds.add(row.notice_id);
        }
      }
    }

    return { noticeIds: [...noticeIds], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "담당공고 검색에 실패했습니다.";
    return { noticeIds: [], error: normalizeAssignmentsError(message) };
  }
}

export async function getDepartmentAssignmentCounts(): Promise<{
  counts: DepartmentAssignmentCount[];
  total: number;
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { counts: [], total: 0, error: configError };
  }

  try {
    const [{ rows, error }, { departments, error: departmentsError }] =
      await Promise.all([fetchAllAssignmentRows(), listDepartments({ activeOnly: false })]);

    if (error) {
      return { counts: [], total: 0, error };
    }
    if (departmentsError) {
      return { counts: [], total: 0, error: departmentsError };
    }

    const { notices, error: noticeError } = await getBidNoticesByIds(
      rows.map((row) => row.notice_id),
    );
    if (noticeError) {
      return { counts: [], total: 0, error: normalizeAssignmentsError(noticeError) };
    }

    const countByDepartmentId = new Map<string, number>();
    let total = 0;

    for (const row of rows) {
      const notice = notices.get(row.notice_id);
      if (!notice || notice.is_deleted) continue;

      const departmentId = row.department_id;
      countByDepartmentId.set(
        departmentId,
        (countByDepartmentId.get(departmentId) ?? 0) + 1,
      );
      total += 1;
    }

    const counts: DepartmentAssignmentCount[] = departments.map((department) => ({
      departmentId: department.id,
      departmentName: department.name,
      count: countByDepartmentId.get(department.id) ?? 0,
      isActive: department.is_active,
    }));

    counts.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.departmentName.localeCompare(b.departmentName, "ko");
    });

    return { counts, total, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "부서별 담당공고 수 조회에 실패했습니다.";
    return { counts: [], total: 0, error: normalizeAssignmentsError(message) };
  }
}

export async function listAssignedBidNotices(
  options: ListAssignedBidNoticesOptions,
): Promise<AssignedBidNoticeListResult> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return {
      items: [],
      total: 0,
      departmentCounts: [],
      totalAssigned: 0,
      error: configError,
    };
  }

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));

  const { counts, total: totalAssigned, error: countsError } =
    await getDepartmentAssignmentCounts();
  if (countsError) {
    return {
      items: [],
      total: 0,
      departmentCounts: [],
      totalAssigned: 0,
      error: countsError,
    };
  }

  const { noticeIds: searchNoticeIds, error: searchError } =
    await getSearchMatchingNoticeIds(options.search ?? "");
  if (searchError) {
    return {
      items: [],
      total: 0,
      departmentCounts: counts,
      totalAssigned,
      error: searchError,
    };
  }
  if (searchNoticeIds && searchNoticeIds.length === 0) {
    return {
      items: [],
      total: 0,
      departmentCounts: counts,
      totalAssigned,
      error: null,
    };
  }

  try {
    const { rows, error } = await fetchAllAssignmentRows();
    if (error) {
      return {
        items: [],
        total: 0,
        departmentCounts: counts,
        totalAssigned,
        error,
      };
    }

    const { notices, error: noticeError } = await getBidNoticesByIds(
      rows.map((row) => row.notice_id),
    );
    if (noticeError) {
      return {
        items: [],
        total: 0,
        departmentCounts: counts,
        totalAssigned,
        error: normalizeAssignmentsError(noticeError),
      };
    }

    const departmentId = options.departmentId?.trim();
    const filteredRows = rows.filter((row) => {
      const notice = notices.get(row.notice_id);
      if (!notice || notice.is_deleted) return false;
      if (departmentId && row.department_id !== departmentId) return false;
      if (searchNoticeIds && !searchNoticeIds.includes(row.notice_id)) {
        return false;
      }
      return true;
    });

    filteredRows.sort((a, b) => {
      const aTime = a.updated_at ? Date.parse(a.updated_at) : 0;
      const bTime = b.updated_at ? Date.parse(b.updated_at) : 0;
      return bTime - aTime;
    });

    const total = filteredRows.length;
    const from = (page - 1) * pageSize;
    const pageRows = filteredRows.slice(from, from + pageSize);

    const assigneeIds = pageRows
      .map((row) => row.assignee_user_id)
      .filter((id): id is string => Boolean(id));
    const assigneeNameMap = await getAssigneeNameMap(assigneeIds);

    const items = pageRows
      .map((row) => {
        const notice = notices.get(row.notice_id);
        if (!notice) return null;

        return mapAssignmentRow(
          row,
          row.assignee_user_id
            ? (assigneeNameMap.get(row.assignee_user_id) ?? row.assignee_user_id)
            : null,
          notice,
        );
      })
      .filter((item): item is AssignedBidNoticeItem => item != null);

    return {
      items,
      total,
      departmentCounts: counts,
      totalAssigned,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "담당공고 목록 조회에 실패했습니다.";
    return {
      items: [],
      total: 0,
      departmentCounts: counts,
      totalAssigned,
      error: normalizeAssignmentsError(message),
    };
  }
}
