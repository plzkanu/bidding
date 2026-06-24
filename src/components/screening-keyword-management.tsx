"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ScreeningKeywordChips } from "@/components/screening-keyword-chips";
import { parseBulkKeywordInput } from "@/lib/bid-notices/screening-keywords-utils";
import type { BidNoticeScreeningKeyword } from "@/lib/bid-notices/screening-keywords";

export function ScreeningKeywordManagement() {
  const [keywords, setKeywords] = useState<BidNoticeScreeningKeyword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKeyword, setEditingKeyword] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadKeywords = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bid-notice-screening-keywords");
      const data = (await response.json()) as {
        keywords?: BidNoticeScreeningKeyword[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "키워드 목록을 불러오지 못했습니다.");
      }
      setKeywords(data.keywords ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeywords();
  }, [loadKeywords]);

  const activeCount = keywords.filter((row) => row.is_active).length;

  const filteredKeywords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return keywords.filter((row) => {
      if (!showInactive && !row.is_active) return false;
      if (!query) return true;
      return row.keyword.toLowerCase().includes(query);
    });
  }, [keywords, searchQuery, showInactive]);

  const filteredKeywordTexts = useMemo(
    () => filteredKeywords.map((row) => row.keyword),
    [filteredKeywords],
  );

  const inactiveKeywordTexts = useMemo(
    () =>
      filteredKeywords.filter((row) => !row.is_active).map((row) => row.keyword),
    [filteredKeywords],
  );

  const selectedRow = selectedId
    ? keywords.find((row) => row.id === selectedId) ?? null
    : null;

  async function registerKeywords(items: string[]) {
    const parsed = parseBulkKeywordInput(items.join("\n"));
    if (parsed.length === 0) {
      setError("등록할 키워드를 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    setError("");
    setInfo("");

    try {
      const response = await fetch("/api/bid-notice-screening-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: parsed }),
      });
      const data = (await response.json()) as {
        keywords?: BidNoticeScreeningKeyword[];
        skipped?: string[];
        errors?: string[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "키워드 등록에 실패했습니다.");
      }

      const createdCount = data.keywords?.length ?? 0;
      const skippedCount = data.skipped?.length ?? 0;
      const parts: string[] = [];
      if (createdCount > 0) {
        parts.push(`${createdCount}건 등록`);
      }
      if (skippedCount > 0) {
        parts.push(`${skippedCount}건 중복 제외`);
      }
      if (data.errors?.length) {
        parts.push(`${data.errors.length}건 실패`);
      }
      setInfo(parts.join(" · ") || "등록을 완료했습니다.");
      await loadKeywords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await registerKeywords([newKeyword]);
    setNewKeyword("");
  }

  async function handleBulkCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await registerKeywords(parseBulkKeywordInput(bulkInput));
    setBulkInput("");
  }

  function startEdit(row: BidNoticeScreeningKeyword) {
    setEditingId(row.id);
    setEditingKeyword(row.keyword);
    setSelectedId(row.id);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingKeyword("");
  }

  async function saveEdit(id: string) {
    setUpdatingId(id);
    setError("");

    try {
      const response = await fetch(
        `/api/bid-notice-screening-keywords/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: editingKeyword }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "키워드 수정에 실패했습니다.");
      }

      cancelEdit();
      await loadKeywords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleActive(row: BidNoticeScreeningKeyword) {
    setUpdatingId(row.id);
    setError("");

    try {
      const response = await fetch(
        `/api/bid-notice-screening-keywords/${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !row.is_active }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "키워드 상태 변경에 실패했습니다.");
      }

      await loadKeywords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id: string) {
    const row = keywords.find((item) => item.id === id);
    if (!row) return;
    if (!window.confirm(`"${row.keyword}" 키워드를 삭제하시겠습니까?`)) return;

    setDeletingId(id);
    setError("");

    try {
      const response = await fetch(
        `/api/bid-notice-screening-keywords/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "키워드 삭제에 실패했습니다.");
      }

      if (editingId === id) {
        cancelEdit();
      }
      if (selectedId === id) {
        setSelectedId(null);
      }
      await loadKeywords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleChipClick(keywordText: string) {
    const row = keywords.find((item) => item.keyword === keywordText);
    if (!row) return;
    setSelectedId(row.id);
  }

  function handleCopyAll() {
    const text = keywords
      .filter((row) => row.is_active)
      .map((row) => row.keyword)
      .join(", ");
    if (!text) {
      setInfo("복사할 활성 키워드가 없습니다.");
      return;
    }
    void navigator.clipboard.writeText(text).then(() => {
      setInfo("활성 키워드를 클립보드에 복사했습니다.");
    });
  }

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#004b87]">키워드 등록</h2>
        <p className="mt-1 text-sm text-slate-600">
          등록한 키워드가 공고명·공고번호·부서 중 하나에 포함된 공고만 입찰공고
          조회 화면의 자동선별에서 표시됩니다.
        </p>

        <form
          onSubmit={handleCreate}
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="키워드 하나 추가"
            maxLength={100}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
          />
          <button
            type="submit"
            disabled={isSaving || !newKeyword.trim()}
            className="shrink-0 rounded-lg bg-[#004b87] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003d6e] disabled:opacity-40"
          >
            {isSaving ? "등록 중…" : "추가"}
          </button>
        </form>

        <form onSubmit={handleBulkCreate} className="mt-3">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="여러 키워드 일괄 등록 — 줄바꿈, 쉼표(,), 세미콜론(;)으로 구분"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving || !bulkInput.trim()}
              className="rounded-lg border border-[#004b87] px-4 py-2 text-sm font-semibold text-[#004b87] hover:bg-[#004b87]/5 disabled:opacity-40"
            >
              {isSaving ? "등록 중…" : "일괄 등록"}
            </button>
          </div>
        </form>
      </div>

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

      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#004b87]">
                등록된 키워드
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                활성 {activeCount.toLocaleString("ko-KR")}건 / 전체{" "}
                {keywords.length.toLocaleString("ko-KR")}건
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadKeywords()}
                disabled={isLoading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                새로고침
              </button>
              <button
                type="button"
                onClick={handleCopyAll}
                disabled={activeCount === 0}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                활성 키워드 복사
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="키워드 검색"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
            />
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="size-3.5 rounded border-slate-300 text-[#004b87]"
              />
              비활성 포함
            </label>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            불러오는 중…
          </p>
        ) : keywords.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            등록된 키워드가 없습니다.
          </p>
        ) : filteredKeywords.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            검색 조건에 맞는 키워드가 없습니다.
          </p>
        ) : (
          <div className="px-5 py-4">
            {editingId ? (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-[#009ada]/30 bg-[#009ada]/5 p-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={editingKeyword}
                  onChange={(e) => setEditingKeyword(e.target.value)}
                  maxLength={100}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(editingId)}
                    disabled={updatingId === editingId || !editingKeyword.trim()}
                    className="rounded-lg bg-[#004b87] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#003d6e] disabled:opacity-40"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={updatingId === editingId}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : null}

            <ScreeningKeywordChips
              keywords={filteredKeywordTexts}
              inactiveKeywords={inactiveKeywordTexts}
              onClick={handleChipClick}
            />

            {selectedRow ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-500">선택:</span>
                <span className="text-sm font-medium text-slate-800">
                  {selectedRow.keyword}
                </span>
                <button
                  type="button"
                  onClick={() => toggleActive(selectedRow)}
                  disabled={
                    updatingId === selectedRow.id ||
                    deletingId === selectedRow.id
                  }
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-white disabled:opacity-40"
                >
                  {selectedRow.is_active ? "비활성화" : "활성화"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(selectedRow)}
                  disabled={
                    updatingId === selectedRow.id ||
                    deletingId === selectedRow.id
                  }
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-white disabled:opacity-40"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedRow.id)}
                  disabled={
                    updatingId === selectedRow.id ||
                    deletingId === selectedRow.id
                  }
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  삭제
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  선택 해제
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                키워드를 클릭하면 수정·삭제·활성화를 할 수 있습니다.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
