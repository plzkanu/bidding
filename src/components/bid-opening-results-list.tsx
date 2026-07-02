"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  BidOpeningResultDetailModal,
  BidOpeningResultFormModal,
} from "@/components/bid-opening-result-modals";
import { BidOpeningResultsChartModal } from "@/components/bid-opening-results-chart-modal";
import { BidOpeningResultsComparisonModal } from "@/components/bid-opening-results-comparison-modal";
import type { BidOpeningCategory } from "@/lib/bid-opening-categories";
import type { BidOpeningResultsCsvImportResult } from "@/lib/bid-opening-results-csv";
import type { BidOpeningResult } from "@/lib/bid-opening-results";
import {
  computeConfirmedEstimatedPriceRate,
  countOpeningResultBids,
  formatAwardWinnerLabel,
  formatOpeningAmount,
  formatOpeningDate,
  formatOpeningRate,
  hasOurOpeningBid,
} from "@/lib/bid-opening-results-format";

const PAGE_SIZE = 20;
const LIST_TABLE_CLASS = "w-full min-w-[76rem] table-auto text-left text-sm";
const CELL_PAD = "px-4 py-2.5";
const CATEGORY_COL_CLASS = `${CELL_PAD} min-w-[8.5rem] whitespace-nowrap`;
const NOTICE_NO_COL_CLASS = `${CELL_PAD} min-w-[8.5rem] whitespace-nowrap`;
const BID_NAME_COL_CLASS = `${CELL_PAD} min-w-[18rem] max-w-[36rem] break-words align-top`;
const BID_DATE_COL_CLASS = `${CELL_PAD} min-w-[6rem] whitespace-nowrap tabular-nums`;
const AMOUNT_COL_CLASS = `${CELL_PAD} min-w-[8.5rem] whitespace-nowrap text-right tabular-nums`;
const RATE_COL_CLASS = `${CELL_PAD} min-w-[6.5rem] whitespace-nowrap text-right tabular-nums`;
const WINNER_COL_CLASS = `${CELL_PAD} min-w-[7.5rem] whitespace-nowrap`;
const BID_COUNT_COL_CLASS = `${CELL_PAD} min-w-[5rem] whitespace-nowrap text-center`;
const OUR_AWARD_ROW_CLASS =
  "bg-[#004b87] text-white hover:bg-[#003a6a]";
const OUR_BID_ROW_CLASS = "bg-[#009ada]/5 hover:bg-[#009ada]/10";

export function BidOpeningResultsList() {
  const [categories, setCategories] = useState<BidOpeningCategory[]>([]);
  const [items, setItems] = useState<BidOpeningResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailItem, setDetailItem] = useState<BidOpeningResult | null>(null);
  const [formItem, setFormItem] = useState<BidOpeningResult | null | undefined>(
    undefined,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importInfo, setImportInfo] = useState("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/bid-opening-categories?activeOnly=true");
      const data = (await response.json()) as {
        categories?: BidOpeningCategory[];
      };
      if (response.ok) {
        setCategories(data.categories ?? []);
      }
    } catch {
      setCategories([]);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (selectedCategoryId) {
        params.set("categoryId", selectedCategoryId);
      }
      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/bid-opening-results?${params}`);
      const data = (await response.json()) as {
        items?: BidOpeningResult[];
        total?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "개찰결과 목록을 불러오지 못했습니다.");
      }

      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, selectedCategoryId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function handleDelete(item: BidOpeningResult) {
    if (
      !window.confirm(
        `「${item.bidName}」 개찰결과를 삭제하시겠습니까?`,
      )
    ) {
      return;
    }

    setDeletingId(item.id);
    setError("");
    try {
      const response = await fetch(
        `/api/bid-opening-results/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "개찰결과 삭제에 실패했습니다.");
      }
      setDetailItem(null);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved() {
    loadItems();
    if (detailItem) {
      setDetailItem(null);
    }
  }

  async function handleCsvUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("업로드할 파일을 선택해 주세요.");
      return;
    }

    setIsUploading(true);
    setError("");
    setImportInfo("");
    setImportWarnings([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/bid-opening-results/import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as BidOpeningResultsCsvImportResult & {
        error?: string;
      };

      if (data.warnings?.length) {
        setImportWarnings(
          data.warnings.map((item) => `${item.row}행: ${item.message}`),
        );
      }

      if (data.errors?.length) {
        setError(
          data.errors.map((item) => `${item.row}행: ${item.message}`).join("\n"),
        );
      } else if (!response.ok) {
        throw new Error(data.error ?? "파일 업로드에 실패했습니다.");
      }

      if (data.created > 0) {
        setImportInfo(`${data.created}건의 개찰결과를 등록했습니다.`);
        await loadItems();
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteAll() {
    if (
      !window.confirm(
        "등록된 개찰결과를 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.",
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "정말 전체 삭제합니다. 구분·경쟁사 마스터는 유지되고 개찰결과만 삭제됩니다.",
      )
    ) {
      return;
    }

    setIsDeletingAll(true);
    setError("");
    setImportInfo("");
    setImportWarnings([]);
    try {
      const response = await fetch("/api/bid-opening-results", {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        deleted?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "전체 삭제에 실패했습니다.");
      }
      setDetailItem(null);
      setPage(1);
      setImportInfo(`${data.deleted ?? 0}건의 개찰결과를 삭제했습니다.`);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "전체 삭제에 실패했습니다.");
    } finally {
      setIsDeletingAll(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowBulkImport((prev) => !prev)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              showBulkImport
                ? "border-[#004b87] bg-[#004b87]/10 text-[#004b87]"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            일괄등록
          </button>
          <button
            type="button"
            onClick={() => setFormItem(null)}
            className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#003a6a]"
          >
            + 개찰결과 등록
          </button>
      </div>

      {showBulkImport ? (
        <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/bid-opening-results/template"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              CSV 양식
            </a>
            <a
              href="/api/bid-opening-results/template?format=xlsx"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Excel 양식
            </a>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={isDeletingAll || total === 0}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              {isDeletingAll ? "삭제 중…" : "전체 삭제 (임시)"}
            </button>
          </div>

          <form
            onSubmit={handleCsvUpload}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-[14rem] flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                파일 업로드 (CSV / Excel)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#004b87]/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#004b87]"
              />
            </div>
            <button
              type="submit"
              disabled={isUploading}
              className="rounded-lg border border-[#004b87]/30 px-4 py-2 text-sm font-medium text-[#004b87] hover:bg-[#004b87]/5 disabled:opacity-40"
            >
              {isUploading ? "업로드 중…" : "파일 등록"}
            </button>
          </form>

          {importInfo ? (
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 whitespace-pre-wrap">
              {importInfo}
            </p>
          ) : null}

          {importWarnings.length > 0 ? (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 whitespace-pre-wrap">
              {importWarnings.join("\n")}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 whitespace-pre-wrap">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">구분</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
            >
              <option value="">전체</option>
              {categories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">검색</label>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="공고번호·입찰명"
              className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            검색
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">총 {total}건</span>
          <button
            type="button"
            onClick={() => setShowComparison(true)}
            disabled={total === 0}
            className="rounded-lg border border-[#004b87]/30 px-4 py-2 text-sm font-medium text-[#004b87] hover:bg-[#004b87]/5 disabled:opacity-40"
          >
            경쟁업체비교
          </button>
          <button
            type="button"
            onClick={() => setShowChart(true)}
            disabled={total === 0}
            className="rounded-lg border border-[#004b87]/30 px-4 py-2 text-sm font-medium text-[#004b87] hover:bg-[#004b87]/5 disabled:opacity-40"
          >
            그래프
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="px-6 py-16 text-center text-sm text-slate-400">
            불러오는 중…
          </p>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            <p>등록된 개찰결과가 없습니다.</p>
            <button
              type="button"
              onClick={() => setFormItem(null)}
              className="mt-2 font-medium text-[#004b87] underline-offset-2 hover:underline"
            >
              첫 개찰결과 등록하기
            </button>
          </div>
        ) : (
          <table className={LIST_TABLE_CLASS}>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className={`${CATEGORY_COL_CLASS} font-medium`}>구분</th>
                <th className={`${NOTICE_NO_COL_CLASS} font-medium`}>
                  입찰공고번호
                </th>
                <th className={`${BID_NAME_COL_CLASS} font-medium`}>입찰명</th>
                <th className={`${BID_DATE_COL_CLASS} font-medium`}>입찰일</th>
                <th className={`${AMOUNT_COL_CLASS} font-medium`}>기초금액</th>
                <th className={`${AMOUNT_COL_CLASS} font-medium`}>예정가격</th>
                <th className={`${RATE_COL_CLASS} font-medium`}>낙착율</th>
                <th className={`${RATE_COL_CLASS} font-medium`}>확정예가</th>
                <th className={`${WINNER_COL_CLASS} font-medium`}>낙찰자</th>
                <th className={`${BID_COUNT_COL_CLASS} font-medium`}>투찰</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const ourAward = item.awardWinnerType === "ours";
                const ourBid = !ourAward && hasOurOpeningBid(item);
                return (
                <tr
                  key={item.id}
                  className={`cursor-pointer ${
                    ourAward
                      ? OUR_AWARD_ROW_CLASS
                      : ourBid
                        ? OUR_BID_ROW_CLASS
                        : "hover:bg-slate-50/80"
                  }`}
                  onClick={() => setDetailItem(item)}
                >
                  <td className={CATEGORY_COL_CLASS}>{item.categoryName}</td>
                  <td className={NOTICE_NO_COL_CLASS}>{item.noticeNo}</td>
                  <td className={BID_NAME_COL_CLASS}>{item.bidName}</td>
                  <td className={BID_DATE_COL_CLASS}>
                    {formatOpeningDate(item.bidDate)}
                  </td>
                  <td className={AMOUNT_COL_CLASS}>
                    {formatOpeningAmount(item.baseAmount)}
                  </td>
                  <td className={AMOUNT_COL_CLASS}>
                    {formatOpeningAmount(item.estimatedPrice)}
                  </td>
                  <td className={RATE_COL_CLASS}>
                    {formatOpeningRate(item.awardRate)}
                  </td>
                  <td className={RATE_COL_CLASS}>
                    {formatOpeningRate(
                      computeConfirmedEstimatedPriceRate(
                        item.baseAmount,
                        item.estimatedPrice,
                      ),
                    )}
                  </td>
                  <td className={WINNER_COL_CLASS}>
                    <span
                      className={
                        ourAward
                          ? "inline-flex rounded-full bg-white/15 px-1.5 py-0.5 text-xs font-medium text-white"
                          : item.awardWinnerType === "competitor"
                            ? "text-xs text-slate-700"
                            : "text-xs text-slate-400"
                      }
                    >
                      {formatAwardWinnerLabel(
                        item.awardWinnerType,
                        item.awardWinnerCompetitorName,
                      )}
                    </span>
                  </td>
                  <td
                    className={`${BID_COUNT_COL_CLASS} ${
                      ourAward ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    {countOpeningResultBids(item)}건
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-sm text-slate-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            다음
          </button>
        </div>
      ) : null}

      {formItem !== undefined ? (
        <BidOpeningResultFormModal
          item={formItem}
          onClose={() => setFormItem(undefined)}
          onSaved={handleSaved}
        />
      ) : null}

      {detailItem ? (
        <BidOpeningResultDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={() => {
            setFormItem(detailItem);
            setDetailItem(null);
          }}
          onDelete={() => handleDelete(detailItem)}
          isDeleting={deletingId === detailItem.id}
        />
      ) : null}

      {showComparison ? (
        <BidOpeningResultsComparisonModal
          categoryId={selectedCategoryId}
          onClose={() => setShowComparison(false)}
          onSelectResult={(item) => {
            setShowComparison(false);
            setDetailItem(item);
          }}
        />
      ) : null}

      {showChart ? (
        <BidOpeningResultsChartModal
          categoryId={selectedCategoryId}
          onClose={() => setShowChart(false)}
        />
      ) : null}
    </div>
  );
}
