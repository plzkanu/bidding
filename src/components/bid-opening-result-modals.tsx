"use client";

import { FormEvent, useEffect, useState } from "react";
import type { BidCompetitor } from "@/lib/bid-competitors";
import type { BidOpeningCategory } from "@/lib/bid-opening-categories";
import type { BidOpeningResult } from "@/lib/bid-opening-results";
import {
  computeBidRateFromAmount,
  computeConfirmedEstimatedPriceRate,
  formatAwardWinnerLabel,
  formatOpeningAmount,
  formatOpeningDate,
  formatOpeningRate,
  hasOurOpeningBid,
  parseAmountInput,
  parseRateInput,
  toOpeningDateInputValue,
  type BidOpeningAwardWinnerType,
} from "@/lib/bid-opening-results-format";

interface BidRow {
  key: string;
  competitorId: string;
  bidAmount: string;
}

interface BidOpeningResultFormModalProps {
  item: BidOpeningResult | null;
  onClose: () => void;
  onSaved: () => void;
}

function emptyBidRow(): BidRow {
  return {
    key: crypto.randomUUID(),
    competitorId: "",
    bidAmount: "",
  };
}

function toBidRows(item: BidOpeningResult | null): BidRow[] {
  if (!item || item.bids.length === 0) {
    return [emptyBidRow()];
  }
  return item.bids.map((bid) => ({
    key: bid.id,
    competitorId: bid.competitorId,
    bidAmount: bid.bidAmount != null ? String(bid.bidAmount) : "",
  }));
}

export function BidOpeningResultFormModal({
  item,
  onClose,
  onSaved,
}: BidOpeningResultFormModalProps) {
  const isEdit = item != null;

  const [categories, setCategories] = useState<BidOpeningCategory[]>([]);
  const [competitors, setCompetitors] = useState<BidCompetitor[]>([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(true);
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "");
  const [noticeNo, setNoticeNo] = useState(item?.noticeNo ?? "");
  const [bidName, setBidName] = useState(item?.bidName ?? "");
  const [bidDate, setBidDate] = useState(() => toOpeningDateInputValue(item?.bidDate));
  const [baseAmount, setBaseAmount] = useState(
    item?.baseAmount != null ? String(item.baseAmount) : "",
  );
  const [estimatedPrice, setEstimatedPrice] = useState(
    item?.estimatedPrice != null ? String(item.estimatedPrice) : "",
  );
  const [awardRate, setAwardRate] = useState(
    item?.awardRate != null ? String(item.awardRate) : "",
  );
  const [bidRows, setBidRows] = useState<BidRow[]>(() => toBidRows(item));
  const [awardWinnerType, setAwardWinnerType] = useState<
    BidOpeningAwardWinnerType | ""
  >(item?.awardWinnerType ?? "");
  const [awardWinnerCompetitorId, setAwardWinnerCompetitorId] = useState(
    item?.awardWinnerCompetitorId ?? "",
  );
  const [ourBidAmount, setOurBidAmount] = useState(
    item?.ourBidAmount != null ? String(item.ourBidAmount) : "",
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const computedConfirmedRate = computeConfirmedEstimatedPriceRate(
    parseAmountInput(baseAmount),
    parseAmountInput(estimatedPrice),
  );
  const parsedBaseAmount = parseAmountInput(baseAmount);
  const parsedAwardRate = parseRateInput(awardRate);
  const computedOurBidRate = computeBidRateFromAmount(
    parseAmountInput(ourBidAmount),
    parsedAwardRate,
    parsedBaseAmount,
  );

  function computeRowBidRate(bidAmount: string) {
    return computeBidRateFromAmount(
      parseAmountInput(bidAmount),
      parsedAwardRate,
      parsedBaseAmount,
    );
  }

  useEffect(() => {
    async function loadMasters() {
      setIsLoadingMasters(true);
      try {
        const [categoriesRes, competitorsRes] = await Promise.all([
          fetch("/api/bid-opening-categories?activeOnly=true"),
          fetch("/api/bid-competitors?activeOnly=true"),
        ]);
        const categoriesData = (await categoriesRes.json()) as {
          categories?: BidOpeningCategory[];
        };
        const competitorsData = (await competitorsRes.json()) as {
          competitors?: BidCompetitor[];
        };
        setCategories(categoriesData.categories ?? []);
        setCompetitors(competitorsData.competitors ?? []);
      } catch {
        setCategories([]);
        setCompetitors([]);
      } finally {
        setIsLoadingMasters(false);
      }
    }
    loadMasters();
  }, []);

  function updateBidRow(key: string, patch: Partial<BidRow>) {
    setBidRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addBidRow() {
    setBidRows((prev) => [...prev, emptyBidRow()]);
  }

  function removeBidRow(key: string) {
    setBidRows((prev) => {
      const removed = prev.find((row) => row.key === key);
      if (removed?.competitorId === awardWinnerCompetitorId) {
        setAwardWinnerCompetitorId("");
        if (awardWinnerType === "competitor") {
          setAwardWinnerType("");
        }
      }
      if (prev.length <= 1) return [emptyBidRow()];
      return prev.filter((row) => row.key !== key);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    const bids = bidRows
      .filter((row) => row.competitorId)
      .map((row) => ({
        competitorId: row.competitorId,
        bidAmount: parseAmountInput(row.bidAmount),
        bidRate: computeRowBidRate(row.bidAmount),
      }));

    const payload = {
      categoryId,
      noticeNo,
      bidName,
      bidDate: bidDate || null,
      baseAmount: parsedBaseAmount,
      estimatedPrice: parseAmountInput(estimatedPrice),
      awardRate: parsedAwardRate,
      awardWinnerType: awardWinnerType || null,
      awardWinnerCompetitorId:
        awardWinnerType === "competitor" ? awardWinnerCompetitorId || null : null,
      ourBidAmount: parseAmountInput(ourBidAmount),
      ourBidRate: computedOurBidRate,
      bids,
    };

    try {
      const url = isEdit
        ? `/api/bid-opening-results/${encodeURIComponent(item.id)}`
        : "/api/bid-opening-results";
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          data.error ??
            (isEdit ? "개찰결과 수정에 실패했습니다." : "개찰결과 등록에 실패했습니다."),
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const usedCompetitorIds = new Set(
    bidRows.map((row) => row.competitorId).filter(Boolean),
  );
  const bidCompetitorOptions = bidRows
    .filter((row) => row.competitorId)
    .map((row) => {
      const competitor = competitors.find((item) => item.id === row.competitorId);
      return {
        id: row.competitorId,
        name: competitor?.name ?? row.competitorId,
      };
    });

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-3xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-[#004b87]">
            {isEdit ? "개찰결과 수정" : "개찰결과 등록"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          {error ? (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {isLoadingMasters ? (
            <p className="text-sm text-slate-400">마스터 데이터 불러오는 중…</p>
          ) : categories.length === 0 || competitors.length === 0 ? (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {categories.length === 0 ? (
                <p>등록된 구분이 없습니다. 먼저 구분 관리에서 구분을 등록해 주세요.</p>
              ) : null}
              {competitors.length === 0 ? (
                <p className={categories.length === 0 ? "mt-2" : ""}>
                  등록된 경쟁사가 없습니다. 먼저 경쟁사 관리에서 경쟁사를 등록해
                  주세요.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    구분 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  >
                    <option value="">선택</option>
                    {categories.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    입찰공고번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={noticeNo}
                    onChange={(e) => setNoticeNo(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    입찰명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bidName}
                    onChange={(e) => setBidName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    입찰일
                  </label>
                  <input
                    type="text"
                    value={bidDate}
                    onChange={(e) => setBidDate(e.target.value)}
                    placeholder="26.06.15"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    기초금액
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    placeholder="원"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    예정가격
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(e.target.value)}
                    placeholder="원"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    낙착율
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={awardRate}
                    onChange={(e) => setAwardRate(e.target.value)}
                    placeholder="%"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    확정예가
                  </label>
                  <div className="flex h-[38px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums text-slate-700">
                    {formatOpeningRate(computedConfirmedRate)}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    예정가격 ÷ 기초금액 × 100 (자동 계산)
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <h3 className="text-sm font-semibold text-slate-700">우리 회사 투찰</h3>
                <p className="mt-1 text-xs text-slate-500">
                  우리 회사의 투찰금액을 입력하면 투찰율이 자동 계산됩니다.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      우리 투찰금액
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ourBidAmount}
                      onChange={(e) => setOurBidAmount(e.target.value)}
                      placeholder="원"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      우리 투찰율
                    </label>
                    <div className="flex h-[38px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums text-slate-700">
                      {formatOpeningRate(computedOurBidRate)}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      투찰금액 ÷ 낙찰율 ÷ 기초금액 × 100
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <h3 className="text-sm font-semibold text-slate-700">낙찰자</h3>
                <p className="mt-1 text-xs text-slate-500">
                  우리 또는 이 공고에 투찰한 경쟁사 중 낙찰자를 선택합니다.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      낙찰 구분
                    </label>
                    <select
                      value={awardWinnerType}
                      onChange={(e) => {
                        const next = e.target.value as BidOpeningAwardWinnerType | "";
                        setAwardWinnerType(next);
                        if (next !== "competitor") {
                          setAwardWinnerCompetitorId("");
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                    >
                      <option value="">미지정</option>
                      <option value="ours">우리</option>
                      <option value="competitor">경쟁사</option>
                    </select>
                  </div>
                  {awardWinnerType === "competitor" ? (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        낙찰 경쟁사
                      </label>
                      <select
                        value={awardWinnerCompetitorId}
                        onChange={(e) => setAwardWinnerCompetitorId(e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                      >
                        <option value="">선택</option>
                        {bidCompetitorOptions.map((competitor) => (
                          <option key={competitor.id} value={competitor.id}>
                            {competitor.name}
                          </option>
                        ))}
                      </select>
                      {bidCompetitorOptions.length === 0 ? (
                        <p className="mt-1 text-xs text-amber-700">
                          투찰 경쟁사를 먼저 추가해 주세요.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">
                    경쟁사 투찰
                  </h3>
                  <button
                    type="button"
                    onClick={addBidRow}
                    className="rounded border border-[#004b87]/30 px-2 py-1 text-xs text-[#004b87] hover:bg-[#004b87]/5"
                  >
                    + 업체 추가
                  </button>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  이 공고에 참여한 경쟁사만 선택하세요. 공고마다 참여 업체가
                  다를 수 있습니다.
                </p>
                <div className="space-y-3">
                  {bidRows.map((row) => (
                    <div
                      key={row.key}
                      className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
                          경쟁사
                        </label>
                        <select
                          value={row.competitorId}
                          onChange={(e) =>
                            updateBidRow(row.key, { competitorId: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                        >
                          <option value="">선택</option>
                          {competitors.map((competitor) => {
                            const disabled =
                              competitor.id !== row.competitorId &&
                              usedCompetitorIds.has(competitor.id);
                            return (
                              <option
                                key={competitor.id}
                                value={competitor.id}
                                disabled={disabled}
                              >
                                {competitor.name}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
                          투찰금액
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.bidAmount}
                          onChange={(e) =>
                            updateBidRow(row.key, { bidAmount: e.target.value })
                          }
                          placeholder="원"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
                          투찰율
                        </label>
                        <div className="flex h-[34px] items-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm tabular-nums text-slate-700">
                          {formatOpeningRate(computeRowBidRate(row.bidAmount))}
                        </div>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeBidRow(row.key)}
                          className="rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-600 hover:bg-white"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={
                isSaving ||
                isLoadingMasters ||
                categories.length === 0 ||
                competitors.length === 0
              }
              className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#003a6a] disabled:opacity-40"
            >
              {isSaving ? "저장 중…" : isEdit ? "수정" : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BidOpeningResultDetailModalProps {
  item: BidOpeningResult;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function BidOpeningResultDetailModal({
  item,
  onClose,
  onEdit,
  onDelete,
  isDeleting,
}: BidOpeningResultDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-[#004b87]">개찰결과 상세</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">구분</dt>
              <dd className="font-medium text-slate-800">{item.categoryName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">입찰공고번호</dt>
              <dd className="font-medium text-slate-800">{item.noticeNo}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">입찰명</dt>
              <dd className="font-medium text-slate-800">{item.bidName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">입찰일</dt>
              <dd className="font-medium text-slate-800">
                {formatOpeningDate(item.bidDate)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">기초금액</dt>
              <dd className="font-medium text-slate-800">
                {formatOpeningAmount(item.baseAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">예정가격</dt>
              <dd className="font-medium text-slate-800">
                {formatOpeningAmount(item.estimatedPrice)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">낙착율</dt>
              <dd className="font-medium text-slate-800">
                {formatOpeningRate(item.awardRate)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">확정예가</dt>
              <dd className="font-medium text-slate-800">
                {formatOpeningRate(
                  computeConfirmedEstimatedPriceRate(
                    item.baseAmount,
                    item.estimatedPrice,
                  ),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">낙찰자</dt>
              <dd className="font-medium text-slate-800">
                <span
                  className={
                    item.awardWinnerType === "ours"
                      ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"
                      : item.awardWinnerType === "competitor"
                        ? "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-slate-700"
                        : ""
                  }
                >
                  {formatAwardWinnerLabel(
                    item.awardWinnerType,
                    item.awardWinnerCompetitorName,
                  )}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">투찰 현황</h3>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">업체</th>
                  <th className="px-3 py-2 font-medium">투찰금액</th>
                  <th className="px-3 py-2 font-medium">투찰율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr
                  className={
                    item.awardWinnerType === "ours"
                      ? "bg-[#a4ce39]/10"
                      : hasOurOpeningBid(item)
                        ? "bg-[#009ada]/5"
                        : undefined
                  }
                >
                  <td className="px-3 py-2">
                    우리
                    {item.awardWinnerType === "ours" ? (
                      <span className="ml-2 rounded-full bg-[#a4ce39]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#004b87]">
                        낙찰
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {formatOpeningAmount(item.ourBidAmount)}
                  </td>
                  <td className="px-3 py-2">{formatOpeningRate(item.ourBidRate)}</td>
                </tr>
                {item.bids.map((bid) => {
                    const isWinner =
                      item.awardWinnerType === "competitor" &&
                      bid.competitorId === item.awardWinnerCompetitorId;
                    return (
                      <tr
                        key={bid.id}
                        className={isWinner ? "bg-[#a4ce39]/10" : undefined}
                      >
                        <td className="px-3 py-2">
                          {bid.competitorName}
                          {isWinner ? (
                            <span className="ml-2 rounded-full bg-[#a4ce39]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#004b87]">
                              낙찰
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {formatOpeningAmount(bid.bidAmount)}
                        </td>
                        <td className="px-3 py-2">{formatOpeningRate(bid.bidRate)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              {isDeleting ? "삭제 중…" : "삭제"}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#003a6a]"
            >
              수정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
