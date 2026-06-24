import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listDepartments } from "@/lib/departments";
import { getAllUsers } from "@/lib/users-store";
import {
  normalizeAssignmentsError,
  type BidNoticeAssignment,
} from "@/lib/bid-notices/assignments";
import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";

const NOTICE_SELECT = `
  *,
  khnp_bid_open (*),
  khnp_bid_private (*),
  khnp_bid_plan_spec (*)
`;

const ASSIGNMENT_LIST_SELECT = `
  notice_id,
  department_id,
  assignee_user_id,
  updated_at,
  departments (id, name),
  khnp_bid_notice!inner (${NOTICE_SELECT})
`;

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

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 담당공고를 조회할 수 없습니다.";
  }
  return null;
}

function sanitizeSearchTerm(search?: string): string {
  return search?.trim().replace(/[,()]/g, " ").trim() ?? "";
}

function mapAssignmentListRow(
  row: Record<string, unknown>,
  assigneeName: string | null,
): AssignedBidNoticeItem | null {
  const noticeRaw = row.khnp_bid_notice as KhnpBidNoticeRow | KhnpBidNoticeRow[] | null;
  const notice = Array.isArray(noticeRaw) ? noticeRaw[0] : noticeRaw;
  if (!notice) return null;

  const department = row.departments as { id?: string; name?: string } | null;

  return {
    assignment: {
      noticeId: row.notice_id as string,
      departmentId: row.department_id as string,
      departmentName: department?.name ?? "",
      assigneeUserId: (row.assignee_user_id as string | null) ?? null,
      assigneeName,
      updatedAt: (row.updated_at as string | null) ?? null,
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

async function getSearchMatchingNoticeIds(
  search: string,
): Promise<{ noticeIds: string[] | null; error: string | null }> {
  const trimmed = sanitizeSearchTerm(search);
  if (!trimmed) {
    return { noticeIds: null, error: null };
  }

  try {
    const supabase = createServerClient();
    const pattern = `%${trimmed}%`;
    const noticeIds = new Set<string>();

    const [titleResult, departmentResult, users] = await Promise.all([
      supabase
        .from("khnp_bid_notice")
        .select("id")
        .eq("is_deleted", false)
        .ilike("title", pattern),
      supabase
        .from("bid_notice_assignments")
        .select("notice_id, departments!inner(name)")
        .ilike("departments.name", pattern),
      getAllUsers(),
    ]);

    if (titleResult.error) {
      return { noticeIds: [], error: normalizeAssignmentsError(titleResult.error.message) };
    }
    if (departmentResult.error) {
      return {
        noticeIds: [],
        error: normalizeAssignmentsError(departmentResult.error.message),
      };
    }

    if ((titleResult.data ?? []).length > 0) {
      const titleNoticeIds = (titleResult.data ?? []).map((row) => row.id as string);
      const { data: assignedTitleMatches, error: assignedTitleError } =
        await supabase
          .from("bid_notice_assignments")
          .select("notice_id, khnp_bid_notice!inner(is_deleted)")
          .eq("khnp_bid_notice.is_deleted", false)
          .in("notice_id", titleNoticeIds);

      if (assignedTitleError) {
        return {
          noticeIds: [],
          error: normalizeAssignmentsError(assignedTitleError.message),
        };
      }

      for (const row of assignedTitleMatches ?? []) {
        noticeIds.add(row.notice_id as string);
      }
    }

    for (const row of departmentResult.data ?? []) {
      noticeIds.add(row.notice_id as string);
    }

    const lowered = trimmed.toLowerCase();
    const matchingUserIds = users
      .filter((user) => user.name.toLowerCase().includes(lowered))
      .map((user) => user.id);

    if (matchingUserIds.length > 0) {
      const { data, error } = await supabase
        .from("bid_notice_assignments")
        .select("notice_id, khnp_bid_notice!inner(is_deleted)")
        .eq("khnp_bid_notice.is_deleted", false)
        .in("assignee_user_id", matchingUserIds);

      if (error) {
        return { noticeIds: [], error: normalizeAssignmentsError(error.message) };
      }

      for (const row of data ?? []) {
        noticeIds.add(row.notice_id as string);
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
    const supabase = createServerClient();
    const [{ data, error }, { departments, error: departmentsError }] =
      await Promise.all([
        supabase
          .from("bid_notice_assignments")
          .select(
            "department_id, departments (id, name, is_active), khnp_bid_notice!inner(is_deleted)",
          )
          .eq("khnp_bid_notice.is_deleted", false),
        listDepartments({ activeOnly: false }),
      ]);

    if (error) {
      return { counts: [], total: 0, error: normalizeAssignmentsError(error.message) };
    }
    if (departmentsError) {
      return { counts: [], total: 0, error: departmentsError };
    }

    const countByDepartmentId = new Map<string, number>();
    let total = 0;

    for (const row of data ?? []) {
      const departmentId = row.department_id as string;
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
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

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
    const supabase = createServerClient();
    let query = supabase
      .from("bid_notice_assignments")
      .select(ASSIGNMENT_LIST_SELECT, { count: "exact" })
      .eq("khnp_bid_notice.is_deleted", false)
      .order("updated_at", { ascending: false });

    const departmentId = options.departmentId?.trim();
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }
    if (searchNoticeIds) {
      query = query.in("notice_id", searchNoticeIds);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return {
        items: [],
        total: 0,
        departmentCounts: counts,
        totalAssigned,
        error: normalizeAssignmentsError(error.message),
      };
    }

    const assigneeIds = (data ?? [])
      .map((row) => row.assignee_user_id as string | null)
      .filter((id): id is string => Boolean(id));
    const assigneeNameMap = await getAssigneeNameMap(assigneeIds);

    const items = (data ?? [])
      .map((row) =>
        mapAssignmentListRow(
          row,
          row.assignee_user_id
            ? (assigneeNameMap.get(row.assignee_user_id as string) ??
                (row.assignee_user_id as string))
            : null,
        ),
      )
      .filter((item): item is AssignedBidNoticeItem => item != null);

    return {
      items,
      total: count ?? items.length,
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
