"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserUsageSummary } from "@/lib/usage-types";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) return "0분";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  if (minutes > 0) {
    return `${minutes}분`;
  }
  return `${totalSeconds}초`;
}

const roleLabels: Record<string, string> = {
  admin: "관리자",
  user: "일반",
};

export function UsageAnalytics() {
  const [users, setUsers] = useState<UserUsageSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/usage");
      const data = (await response.json()) as {
        users?: UserUsageSummary[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "사용 현황을 불러오지 못했습니다.");
      }
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (user) =>
        user.userId.toLowerCase().includes(query) ||
        user.name.toLowerCase().includes(query) ||
        user.department.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">계정별 사용 현황</h2>
          <p className="mt-1 text-xs text-slate-500">
            최종 접속시각, 누적 사용시간, 화면별 방문 횟수를 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="아이디·이름·부서 검색"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#009ada]/30 focus:ring"
          />
          <button
            type="button"
            onClick={() => void loadUsage()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>
      </div>

      {error ? (
        <p className="px-5 py-4 text-sm text-red-600">{error}</p>
      ) : null}

      {isLoading ? (
        <p className="px-5 py-8 text-sm text-slate-500">불러오는 중...</p>
      ) : filteredUsers.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">표시할 계정이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">아이디</th>
                <th className="px-5 py-3 font-medium">이름</th>
                <th className="px-5 py-3 font-medium">부서</th>
                <th className="px-5 py-3 font-medium">역할</th>
                <th className="px-5 py-3 font-medium">최종 접속</th>
                <th className="px-5 py-3 font-medium">최근 활동</th>
                <th className="px-5 py-3 font-medium">사용시간</th>
                <th className="px-5 py-3 font-medium">세션</th>
                <th className="px-5 py-3 font-medium">방문 화면</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isExpanded = expandedUserId === user.userId;
                const totalVisits = user.pageVisits.reduce(
                  (sum, visit) => sum + visit.visitCount,
                  0,
                );
                return (
                  <FragmentRow
                    key={user.userId}
                    user={user}
                    isExpanded={isExpanded}
                    totalVisits={totalVisits}
                    onToggle={() =>
                      setExpandedUserId(isExpanded ? null : user.userId)
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  user,
  isExpanded,
  totalVisits,
  onToggle,
}: {
  user: UserUsageSummary;
  isExpanded: boolean;
  totalVisits: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-slate-50/80">
        <td className="px-5 py-3 font-medium text-slate-800">{user.userId}</td>
        <td className="px-5 py-3 text-slate-700">{user.name}</td>
        <td className="px-5 py-3 text-slate-600">{user.department || "—"}</td>
        <td className="px-5 py-3">
          <span
            className={
              user.role === "admin"
                ? "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-[#004b87]"
                : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
            }
          >
            {roleLabels[user.role] ?? user.role}
          </span>
        </td>
        <td className="px-5 py-3 whitespace-nowrap text-slate-600">
          {formatDateTime(user.lastLoginAt)}
        </td>
        <td className="px-5 py-3 whitespace-nowrap text-slate-600">
          {formatDateTime(user.lastSeenAt)}
        </td>
        <td className="px-5 py-3 whitespace-nowrap text-slate-700">
          {formatDuration(user.totalActiveSeconds)}
        </td>
        <td className="px-5 py-3 text-slate-600">{user.sessionCount}</td>
        <td className="px-5 py-3 text-slate-600">{totalVisits}</td>
        <td className="px-5 py-3 text-right">
          <button
            type="button"
            onClick={onToggle}
            disabled={user.pageVisits.length === 0}
            className="text-sm text-[#009ada] hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
          >
            {isExpanded ? "접기" : "상세"}
          </button>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="bg-slate-50/60">
          <td colSpan={10} className="px-5 py-4">
            <p className="mb-2 text-xs font-medium text-slate-500">
              화면별 방문 횟수
            </p>
            {user.pageVisits.length === 0 ? (
              <p className="text-sm text-slate-500">방문 기록이 없습니다.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">화면</th>
                      <th className="px-4 py-2 font-medium">방문 횟수</th>
                      <th className="px-4 py-2 font-medium">최근 방문</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {user.pageVisits.map((visit) => (
                      <tr key={visit.screenKey}>
                        <td className="px-4 py-2 text-slate-700">
                          {visit.screenLabel}
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {visit.visitCount.toLocaleString("ko-KR")}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {formatDateTime(visit.lastVisitedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
