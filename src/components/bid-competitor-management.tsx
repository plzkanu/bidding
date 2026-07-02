"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { BidCompetitor } from "@/lib/bid-competitors";

export function BidCompetitorManagement() {
  const [competitors, setCompetitors] = useState<BidCompetitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCompetitors = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bid-competitors");
      const data = (await response.json()) as {
        competitors?: BidCompetitor[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "경쟁사 목록을 불러오지 못했습니다.");
      }
      setCompetitors(data.competitors ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompetitors();
  }, [loadCompetitors]);

  const activeCount = competitors.filter((row) => row.is_active).length;

  const filteredCompetitors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return competitors.filter((row) => {
      if (!showInactive && !row.is_active) return false;
      if (!query) return true;
      return row.name.toLowerCase().includes(query);
    });
  }, [competitors, searchQuery, showInactive]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError("경쟁사명을 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    setError("");
    setInfo("");

    try {
      const response = await fetch("/api/bid-competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        competitor?: BidCompetitor;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "경쟁사 등록에 실패했습니다.");
      }
      setNewName("");
      setInfo(`「${data.competitor?.name ?? name}」 경쟁사를 등록했습니다.`);
      await loadCompetitors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEdit(id: string) {
    const name = editingName.trim();
    if (!name) {
      setError("경쟁사명을 입력해 주세요.");
      return;
    }

    setUpdatingId(id);
    setError("");
    setInfo("");

    try {
      const response = await fetch(`/api/bid-competitors/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "경쟁사 수정에 실패했습니다.");
      }
      setEditingId(null);
      setEditingName("");
      setInfo("경쟁사명을 수정했습니다.");
      await loadCompetitors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleActive(row: BidCompetitor) {
    setUpdatingId(row.id);
    setError("");
    setInfo("");

    try {
      const response = await fetch(`/api/bid-competitors/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !row.is_active }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "경쟁사 상태 변경에 실패했습니다.");
      }
      setInfo(
        row.is_active
          ? `「${row.name}」 경쟁사를 비활성화했습니다.`
          : `「${row.name}」 경쟁사를 활성화했습니다.`,
      );
      await loadCompetitors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeCompetitor(id: string, name: string) {
    if (!window.confirm(`「${name}」 경쟁사를 삭제하시겠습니까?`)) {
      return;
    }

    setDeletingId(id);
    setError("");
    setInfo("");

    try {
      const response = await fetch(`/api/bid-competitors/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "경쟁사 삭제에 실패했습니다.");
      }
      setInfo(`「${name}」 경쟁사를 삭제했습니다.`);
      await loadCompetitors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-600">
        개찰결과에 투찰 정보를 등록할 경쟁사를 관리합니다. 등록된 활성 경쟁사만
        선택할 수 있으며, 공고마다 참여 업체를 다르게 지정할 수 있습니다.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </p>
      ) : null}

      <form
        onSubmit={handleCreate}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            새 경쟁사
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="예: OO건설, XX엔지니어링"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
          />
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#003a6a] disabled:opacity-40"
        >
          {isSaving ? "등록 중…" : "경쟁사 등록"}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>
            전체 {competitors.length}개 · 활성 {activeCount}개
          </span>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            비활성 포함
          </label>
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="경쟁사 검색"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">
            불러오는 중…
          </p>
        ) : filteredCompetitors.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            {competitors.length === 0
              ? "등록된 경쟁사가 없습니다."
              : "검색 결과가 없습니다."}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">경쟁사</th>
                <th className="w-24 px-4 py-3 font-medium">상태</th>
                <th className="w-48 px-4 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCompetitors.map((row) => {
                const isEditing = editingId === row.id;
                const isUpdating = updatingId === row.id;
                const isDeleting = deletingId === row.id;

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                        />
                      ) : (
                        <span className="font-medium text-slate-800">
                          {row.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(row.id)}
                              disabled={isUpdating}
                              className="rounded border border-[#004b87]/30 px-2 py-1 text-xs text-[#004b87] hover:bg-[#004b87]/5 disabled:opacity-40"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditingName("");
                              }}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(row.id);
                                setEditingName(row.name);
                              }}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleActive(row)}
                              disabled={isUpdating}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                              {row.is_active ? "비활성화" : "활성화"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCompetitor(row.id, row.name)}
                              disabled={isDeleting}
                              className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
