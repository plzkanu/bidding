"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BidOpeningResult } from "@/lib/bid-opening-results";
import {
  buildOpeningResultsChartData,
  computeChartYAxis,
  formatChartRateLabel,
  getDefaultSelectedCompanyIds,
  type OpeningResultsChartCompany,
} from "@/lib/bid-opening-results-chart";
import {
  getVisibleLabelIndices,
  getVisibleXAxisIndices,
  layoutChartDataLabels,
  shouldShowValueLabelsByDefault,
  type ChartLabelInput,
  type ChartLabelLayout,
} from "@/lib/bid-opening-results-chart-labels";

interface BidOpeningResultsChartModalProps {
  categoryId: string;
  categoryName: string;
  onClose: () => void;
}

const CHART_WIDTH = 1380;
const CHART_HEIGHT = 720;
const MARGIN = { top: 40, right: 48, bottom: 88, left: 118 };

function scaleX(index: number, count: number, innerWidth: number): number {
  if (count <= 1) return innerWidth / 2;
  return (index / (count - 1)) * innerWidth;
}

function scaleY(
  value: number,
  min: number,
  max: number,
  innerHeight: number,
): number {
  if (max === min) return innerHeight / 2;
  return innerHeight - ((value - min) / (max - min)) * innerHeight;
}

function buildLineSegments(
  values: (number | null)[],
): Array<Array<{ x: number; y: number; value: number; index: number }>> {
  const segments: Array<
    Array<{ x: number; y: number; value: number; index: number }>
  > = [];
  let current: Array<{ x: number; y: number; value: number; index: number }> =
    [];

  values.forEach((value, index) => {
    if (value == null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      return;
    }
    current.push({ x: index, y: value, value, index });
  });

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

function buildAreaPath(
  segment: Array<{ x: number; y: number; value: number; index: number }>,
  pointCount: number,
  innerWidth: number,
  innerHeight: number,
  yMin: number,
  yMax: number,
): string {
  if (segment.length === 0) return "";
  const points = segment.map((point) => {
    const x = scaleX(point.x, pointCount, innerWidth);
    const y = scaleY(point.y, yMin, yMax, innerHeight);
    return { x, y };
  });
  const baseline = innerHeight;
  const line = points.map((p) => `${p.x},${p.y}`).join(" L ");
  const first = points[0];
  const last = points[points.length - 1];
  return `M ${first.x},${baseline} L ${line} L ${last.x},${baseline} Z`;
}

function DiamondMarker({
  cx,
  cy,
  color,
  size = 8,
}: {
  cx: number;
  cy: number;
  color: string;
  size?: number;
}) {
  return (
    <polygon
      points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
      fill={color}
      stroke="#ffffff"
      strokeWidth={2.5}
    />
  );
}

function CircleMarker({
  cx,
  cy,
  color,
  size = 7,
}: {
  cx: number;
  cy: number;
  color: string;
  size?: number;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={size}
      fill={color}
      stroke="#ffffff"
      strokeWidth={2.5}
    />
  );
}

function DataLabel({ layout }: { layout: ChartLabelLayout }) {
  if (!layout.visible) return null;
  const label = formatChartRateLabel(layout.value);
  return (
    <g pointerEvents="none">
      <rect
        x={layout.rectX}
        y={layout.rectY}
        width={layout.width}
        height={layout.height}
        rx={6}
        fill="#ffffff"
        stroke={layout.color}
        strokeWidth={1.5}
        opacity={0.96}
      />
      <text
        x={layout.x}
        y={layout.rectY + 15}
        textAnchor="middle"
        fontSize={12}
        fill={layout.color}
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
}

function ChartSeries({
  series,
  marker,
  innerWidth,
  innerHeight,
  yMin,
  yMax,
  pointCount,
  showArea,
  dashed,
  labelLayoutMap,
  highlightedIndex,
}: {
  series: OpeningResultsChartCompany;
  marker: "diamond" | "circle";
  innerWidth: number;
  innerHeight: number;
  yMin: number;
  yMax: number;
  pointCount: number;
  showArea?: boolean;
  dashed?: boolean;
  labelLayoutMap: Map<string, ChartLabelLayout>;
  highlightedIndex: number | null;
}) {
  const segments = buildLineSegments(series.values);

  return (
    <g>
      {showArea
        ? segments.map((segment, segmentIndex) => (
            <path
              key={`${series.id}-area-${segmentIndex}`}
              d={buildAreaPath(
                segment,
                pointCount,
                innerWidth,
                innerHeight,
                yMin,
                yMax,
              )}
              fill={`url(#area-gradient-${series.id})`}
              opacity={0.35}
            />
          ))
        : null}
      {segments.map((segment, segmentIndex) => (
        <polyline
          key={`${series.id}-segment-${segmentIndex}`}
          fill="none"
          stroke={series.color}
          strokeWidth={marker === "diamond" ? 2.5 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? "8 5" : undefined}
          opacity={0.95}
          points={segment
            .map((point) => {
              const x = scaleX(point.x, pointCount, innerWidth);
              const y = scaleY(point.y, yMin, yMax, innerHeight);
              return `${x},${y}`;
            })
            .join(" ")}
        />
      ))}
      {series.values.map((value, index) => {
        if (value == null) return null;
        const x = scaleX(index, pointCount, innerWidth);
        const y = scaleY(value, yMin, yMax, innerHeight);
        const Marker = marker === "diamond" ? DiamondMarker : CircleMarker;
        const labelId = `${series.id}-point-${index}`;
        const layout = labelLayoutMap.get(labelId);
        const isHighlighted = highlightedIndex === index;
        return (
          <g
            key={`${series.id}-point-${index}`}
            filter="url(#point-shadow)"
            opacity={highlightedIndex == null || isHighlighted ? 1 : 0.45}
          >
            <circle cx={x} cy={y} r={12} fill={series.color} opacity={0.12} />
            <Marker cx={x} cy={y} color={series.color} />
            {layout ? <DataLabel layout={layout} /> : null}
          </g>
        );
      })}
    </g>
  );
}

interface TooltipEntry {
  label: string;
  color: string;
  value: number;
}

export function BidOpeningResultsChartModal({
  categoryId,
  categoryName,
  onClose,
}: BidOpeningResultsChartModalProps) {
  const [items, setItems] = useState<BidOpeningResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [labelPreference, setLabelPreference] = useState<"auto" | "on" | "off">(
    "auto",
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, maxX: 600 });
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadChartData() {
      setIsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (categoryId) {
          params.set("categoryId", categoryId);
        }
        const response = await fetch(
          `/api/bid-opening-results/chart?${params.toString()}`,
        );
        const data = (await response.json()) as {
          items?: BidOpeningResult[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "차트 데이터를 불러오지 못했습니다.");
        }
        setItems(data.items ?? []);
      } catch (err) {
        setItems([]);
        setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
    loadChartData();
  }, [categoryId]);

  const chartData = useMemo(
    () => buildOpeningResultsChartData(items),
    [items],
  );

  useEffect(() => {
    if (chartData.companies.length === 0) {
      setSelectedCompanyIds([]);
      return;
    }
    setSelectedCompanyIds(getDefaultSelectedCompanyIds(chartData));
  }, [chartData]);

  const selectedCompanies = chartData.companies.filter((company) =>
    selectedCompanyIds.includes(company.id),
  );

  const seriesCount = 1 + selectedCompanies.length;
  const pointCount = chartData.pointLabels.length;
  const showValueLabels =
    labelPreference === "auto"
      ? shouldShowValueLabelsByDefault(pointCount, seriesCount)
      : labelPreference === "on";

  const activeValues = useMemo(() => {
    const values: number[] = [];
    for (const value of chartData.confirmedSeries.values) {
      if (value != null) values.push(value);
    }
    for (const company of selectedCompanies) {
      for (const value of company.values) {
        if (value != null) values.push(value);
      }
    }
    return values;
  }, [chartData.confirmedSeries.values, selectedCompanies]);

  const yAxis = useMemo(() => computeChartYAxis(activeValues), [activeValues]);
  const innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const showHundredLine =
    yAxis.min <= 100 && yAxis.max >= 100 && activeValues.length > 0;

  const visibleLabelIndices = useMemo(
    () => getVisibleLabelIndices(pointCount, pointCount <= 10),
    [pointCount],
  );

  const visibleXAxisIndices = useMemo(
    () => getVisibleXAxisIndices(pointCount),
    [pointCount],
  );

  const labelLayoutMap = useMemo(() => {
    if (!showValueLabels) return new Map<string, ChartLabelLayout>();

    const inputs: ChartLabelInput[] = [];

    chartData.confirmedSeries.values.forEach((value, index) => {
      if (value == null || !visibleLabelIndices.has(index)) return;
      inputs.push({
        id: `${chartData.confirmedSeries.id}-point-${index}`,
        x: scaleX(index, pointCount, innerWidth),
        anchorY: scaleY(value, yAxis.min, yAxis.max, innerHeight),
        value,
        color: chartData.confirmedSeries.color,
        preferredPlacement: "above",
        priority: 0,
      });
    });

    selectedCompanies.forEach((company, companyIndex) => {
      company.values.forEach((value, index) => {
        if (value == null || !visibleLabelIndices.has(index)) return;
        inputs.push({
          id: `${company.id}-point-${index}`,
          x: scaleX(index, pointCount, innerWidth),
          anchorY: scaleY(value, yAxis.min, yAxis.max, innerHeight),
          value,
          color: company.color,
          preferredPlacement: companyIndex % 2 === 0 ? "below" : "above",
          priority: 1 + companyIndex,
        });
      });
    });

    const layouts = layoutChartDataLabels(inputs, {
      width: innerWidth,
      height: innerHeight,
    });
    return new Map(layouts.map((layout) => [layout.id, layout]));
  }, [
    chartData.confirmedSeries,
    selectedCompanies,
    showValueLabels,
    visibleLabelIndices,
    pointCount,
    innerWidth,
    innerHeight,
    yAxis.min,
    yAxis.max,
  ]);

  const tooltipEntries = useMemo((): TooltipEntry[] => {
    if (hoverIndex == null) return [];
    const entries: TooltipEntry[] = [];
    const confirmed = chartData.confirmedSeries.values[hoverIndex];
    if (confirmed != null) {
      entries.push({
        label: chartData.confirmedSeries.label,
        color: chartData.confirmedSeries.color,
        value: confirmed,
      });
    }
    for (const company of selectedCompanies) {
      const value = company.values[hoverIndex];
      if (value != null) {
        entries.push({ label: company.label, color: company.color, value });
      }
    }
    return entries;
  }, [hoverIndex, chartData.confirmedSeries, selectedCompanies]);

  const hoveredBidTitle = useMemo(() => {
    if (hoverIndex == null) return null;
    const round = `입찰 ${hoverIndex + 1}회`;
    const bidName = items[hoverIndex]?.bidName?.trim();
    return bidName ? `${round} : ${bidName}` : round;
  }, [hoverIndex, items]);

  function toggleCompany(companyId: string) {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    );
  }

  function handleColumnHover(
    index: number,
    event: React.MouseEvent<SVGRectElement>,
  ) {
    setHoverIndex(index);
    const container = chartContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setTooltipPos({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      maxX: rect.width - 180,
    });
  }

  const hoverGuideX =
    hoverIndex != null
      ? scaleX(hoverIndex, pointCount, innerWidth)
      : null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto bg-[#0f172a]/55 p-4 backdrop-blur-[2px] sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-[92rem] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-[#004b87] to-[#0066a8] px-6 py-5 text-white">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              투찰율 그래프
              {categoryName ? (
                <span className="ml-2 text-lg font-medium text-white/90">
                  · {categoryName}
                </span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-white/75">
              선택 구분 기준 · 확정예가 대비 투찰율 추이 · 입찰일 순 · 포인트에
              마우스를 올리면 수치를 확인할 수 있습니다
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            닫기
          </button>
        </div>

        <div className="bg-slate-50/80 px-5 py-5">
          {isLoading ? (
            <p className="py-24 text-center text-sm text-slate-400">
              차트 데이터를 불러오는 중…
            </p>
          ) : error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="py-24 text-center text-sm text-slate-500">
              표시할 개찰결과가 없습니다.
            </p>
          ) : (
            <>
              <div className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    표시 회사
                  </p>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={showValueLabels}
                      onChange={(event) =>
                        setLabelPreference(event.target.checked ? "on" : "off")
                      }
                      className="size-4 rounded border-slate-300 text-[#004b87] focus:ring-[#004b87]/30"
                    />
                    차트에 수치 표시
                    {pointCount > 10 ? (
                      <span className="text-xs text-slate-400">
                        (많을 때는 간격을 두어 표시)
                      </span>
                    ) : null}
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#7c5cbf]/30 bg-[#7c5cbf]/8 px-3 py-1.5 text-sm font-medium text-[#5b3f96]">
                    <span className="inline-block size-2.5 rotate-45 bg-[#7c5cbf]" />
                    확정예가
                  </span>
                  {chartData.companies.map((company) => {
                    const selected = selectedCompanyIds.includes(company.id);
                    return (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => toggleCompany(company.id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                          selected
                            ? "shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                        }`}
                        style={
                          selected
                            ? {
                                borderColor: `${company.color}55`,
                                backgroundColor: `${company.color}14`,
                                color: company.color,
                              }
                            : undefined
                        }
                      >
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{
                            backgroundColor: selected
                              ? company.color
                              : "#cbd5e1",
                          }}
                        />
                        {company.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                ref={chartContainerRef}
                className="relative overflow-x-auto rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 p-4 shadow-inner"
              >
                {hoverIndex != null && tooltipEntries.length > 0 ? (
                  <div
                    className="pointer-events-none absolute z-10 max-w-[min(24rem,calc(100%-1rem))] rounded-xl border border-slate-200 bg-white/98 px-3 py-2.5 shadow-lg backdrop-blur-sm"
                    style={{
                      left: Math.min(
                        Math.max(tooltipPos.x + 12, 8),
                        tooltipPos.maxX,
                      ),
                      top: Math.max(tooltipPos.y - 8, 8),
                      transform: "translateY(-100%)",
                    }}
                  >
                    <p className="mb-2 text-xs font-semibold leading-snug text-slate-500">
                      {hoveredBidTitle}
                    </p>
                    <ul className="space-y-1.5">
                      {tooltipEntries.map((entry) => (
                        <li
                          key={entry.label}
                          className="flex items-center justify-between gap-4 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-slate-700">
                            <span
                              className="inline-block size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="truncate">{entry.label}</span>
                          </span>
                          <span
                            className="shrink-0 font-semibold tabular-nums"
                            style={{ color: entry.color }}
                          >
                            {formatChartRateLabel(entry.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <svg
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  className="mx-auto min-w-[1380px] w-full"
                  role="img"
                  aria-label="확정예가 및 투찰율 비교 차트"
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <defs>
                    <linearGradient
                      id="plot-bg"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#f8fafc" />
                      <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>
                    <linearGradient
                      id={`area-gradient-${chartData.confirmedSeries.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={chartData.confirmedSeries.color}
                        stopOpacity={0.45}
                      />
                      <stop
                        offset="100%"
                        stopColor={chartData.confirmedSeries.color}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <filter id="point-shadow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow
                        dx="0"
                        dy="1"
                        stdDeviation="2"
                        floodColor="#0f172a"
                        floodOpacity="0.18"
                      />
                    </filter>
                  </defs>

                  <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill="transparent" />

                  <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
                    <rect
                      x={0}
                      y={0}
                      width={innerWidth}
                      height={innerHeight}
                      rx={12}
                      fill="url(#plot-bg)"
                      stroke="#e2e8f0"
                      strokeWidth={1}
                    />

                    {yAxis.ticks.map((tick, index) => {
                      const y = scaleY(tick, yAxis.min, yAxis.max, innerHeight);
                      const isMajor = index % 2 === 0;
                      return (
                        <g key={tick}>
                          <line
                            x1={0}
                            x2={innerWidth}
                            y1={y}
                            y2={y}
                            stroke={isMajor ? "#dbe3ee" : "#eef2f7"}
                            strokeWidth={1}
                            strokeDasharray={isMajor ? undefined : "4 6"}
                          />
                          <text
                            x={-26}
                            y={y + 4}
                            textAnchor="end"
                            fontSize={13}
                            fill="#64748b"
                            fontWeight={isMajor ? 600 : 400}
                          >
                            {formatChartRateLabel(tick)}
                          </text>
                        </g>
                      );
                    })}

                    {showHundredLine ? (
                      <line
                        x1={0}
                        x2={innerWidth}
                        y1={scaleY(100, yAxis.min, yAxis.max, innerHeight)}
                        y2={scaleY(100, yAxis.min, yAxis.max, innerHeight)}
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        opacity={0.8}
                      />
                    ) : null}

                    <ChartSeries
                      series={chartData.confirmedSeries}
                      marker="diamond"
                      innerWidth={innerWidth}
                      innerHeight={innerHeight}
                      yMin={yAxis.min}
                      yMax={yAxis.max}
                      pointCount={pointCount}
                      showArea
                      dashed
                      labelLayoutMap={labelLayoutMap}
                      highlightedIndex={hoverIndex}
                    />

                    {selectedCompanies.map((company) => (
                      <ChartSeries
                        key={company.id}
                        series={company}
                        marker="circle"
                        innerWidth={innerWidth}
                        innerHeight={innerHeight}
                        yMin={yAxis.min}
                        yMax={yAxis.max}
                        pointCount={pointCount}
                        labelLayoutMap={labelLayoutMap}
                        highlightedIndex={hoverIndex}
                      />
                    ))}

                    {hoverGuideX != null ? (
                      <line
                        x1={hoverGuideX}
                        x2={hoverGuideX}
                        y1={0}
                        y2={innerHeight}
                        stroke="#004b87"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        opacity={0.45}
                        pointerEvents="none"
                      />
                    ) : null}

                    {chartData.pointLabels.map((label, index) => {
                      if (!visibleXAxisIndices.has(index)) return null;
                      const x = scaleX(index, pointCount, innerWidth);
                      const isHovered = hoverIndex === index;
                      return (
                        <g key={`x-label-${label}-${index}`}>
                          <line
                            x1={x}
                            x2={x}
                            y1={innerHeight}
                            y2={innerHeight + 6}
                            stroke={isHovered ? "#004b87" : "#94a3b8"}
                            strokeWidth={isHovered ? 2 : 1.5}
                          />
                          <text
                            x={x}
                            y={innerHeight + 28}
                            textAnchor="middle"
                            fontSize={14}
                            fill={isHovered ? "#004b87" : "#475569"}
                            fontWeight={isHovered ? 700 : 500}
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}

                    <text
                      x={innerWidth / 2}
                      y={innerHeight + 58}
                      textAnchor="middle"
                      fontSize={13}
                      fill="#64748b"
                      fontWeight={600}
                    >
                      입찰 순번
                    </text>

                    {pointCount > 0
                      ? Array.from({ length: pointCount }, (_, index) => {
                          const columnWidth =
                            pointCount <= 1
                              ? innerWidth
                              : innerWidth / (pointCount - 1);
                          const x =
                            pointCount <= 1
                              ? 0
                              : scaleX(index, pointCount, innerWidth) -
                                columnWidth / 2;
                          return (
                            <rect
                              key={`hover-col-${index}`}
                              x={Math.max(0, x)}
                              y={0}
                              width={
                                pointCount <= 1
                                  ? innerWidth
                                  : Math.min(columnWidth, innerWidth - Math.max(0, x))
                              }
                              height={innerHeight}
                              fill="transparent"
                              onMouseEnter={(event) =>
                                handleColumnHover(index, event)
                              }
                              onMouseMove={(event) =>
                                handleColumnHover(index, event)
                              }
                            />
                          );
                        })
                      : null}
                  </g>

                  <text
                    x={12}
                    y={MARGIN.top + innerHeight / 2}
                    textAnchor="middle"
                    fontSize={12}
                    fill="#94a3b8"
                    fontWeight={600}
                    transform={`rotate(-90, 12, ${MARGIN.top + innerHeight / 2})`}
                  >
                    투찰율 (%)
                  </text>
                </svg>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
