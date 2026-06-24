import type { OrderReportSummaryStatus } from "@/lib/order-report-summary/sections";
import { normalizeKoreanSummaryText } from "@/lib/order-report-summary/korean-spacing";
import {
  sanitizeMultilineSummaryText,
  sanitizeSummaryText,
} from "@/lib/order-report-summary/text-sanitize";
import { normalizeMonetaryAmount } from "@/lib/order-report-summary/text-hints";

/** 공사개요 내 중첩 표 (대상설비·설비현황·공사범위·투입인력 등) */
export interface OrderReportSummarySubTable {
  제목: string;
  헤더: string[];
  행: string[][];
  비고?: string;
}

export interface OrderReportSummaryOverviewRow {
  공사명: string;
  발주자: string;
  기초금액: string;
  공사기간: string;
  공사내용: string;
  비고: string;
  표: OrderReportSummarySubTable[];
}

export interface OrderReportSummaryScheduleStep {
  날짜: string;
  단계: string;
}

export interface OrderReportSummaryQualificationRow {
  구분: string;
  기준: string;
}

export interface OrderReportSummaryContact {
  구분: string;
  부서: string;
  이름: string;
  연락처: string;
}

export interface OrderReportSummaryData {
  발주기관: string;
  공고명: string;
  공고번호: string;
  생성일시: string;
  공사개요: OrderReportSummaryOverviewRow[];
  주요일정: OrderReportSummaryScheduleStep[];
  신청자격: OrderReportSummaryQualificationRow[];
  담당자: OrderReportSummaryContact[];
}

export interface OrderReportPqSummarySection {
  제목: string;
  내용: string;
}

/** PQ·적격심사 문서 LLM 자동 요약 */
export interface OrderReportPqAutoSummary {
  요약: string;
  항목: OrderReportPqSummarySection[];
  분석파일: string[];
}

export interface OrderReportSummaryBundle {
  version: 2;
  입찰공고문: OrderReportSummaryData | null;
  pq적격심사: OrderReportPqAutoSummary | null;
  /** 파일명 분석 제외 목록 (입찰공고문·입찰안내서·PQ/적격심사 패턴 미해당) */
  분석제외: string[];
  입찰공고문분석파일?: string[];
  pq분석파일?: string[];
}

export interface OrderReportSummaryRecord {
  noticeId: string;
  status: OrderReportSummaryStatus;
  summary: OrderReportSummaryData | null;
  pqSummary: OrderReportPqAutoSummary | null;
  excludedFiles: string[];
  bidNoticeSourceFiles: string[];
  pqSourceFiles: string[];
  docxFileName: string | null;
  downloadUrl: string | null;
  errorMessage: string | null;
  modelVersion: string | null;
  generatedAt: string | null;
  updatedAt: string | null;
  pqHasPq: boolean | null;
  pqSubmissionDate: string | null;
}

export const EMPTY_SUMMARY_VALUE = "미기재";

export function emptyOrderReportSummaryData(): OrderReportSummaryData {
  const empty = EMPTY_SUMMARY_VALUE;
  return {
    발주기관: empty,
    공고명: empty,
    공고번호: empty,
    생성일시: empty,
    공사개요: [
      {
        공사명: empty,
        발주자: empty,
        기초금액: empty,
        공사기간: empty,
        공사내용: empty,
        비고: empty,
        표: [],
      },
    ],
    주요일정: [],
    신청자격: [],
    담당자: [],
  };
}

function finalizeSummaryText(text: string): string {
  return normalizeKoreanSummaryText(text);
}

export function normalizeSummaryField(value: unknown): string {
  if (value == null) return EMPTY_SUMMARY_VALUE;
  const text = finalizeSummaryText(sanitizeSummaryText(String(value).trim()));
  return text || EMPTY_SUMMARY_VALUE;
}

function normalizeMultilineSummaryField(value: unknown): string {
  if (value == null) return EMPTY_SUMMARY_VALUE;
  const text = finalizeSummaryText(
    sanitizeMultilineSummaryText(String(value).trim()),
  );
  return text || EMPTY_SUMMARY_VALUE;
}

/** 금융 필드: 376,662,482원 (부가가치세 별도) 형식으로 통일 */
export function normalizeFinancialSummaryField(value: string): string {
  if (value === EMPTY_SUMMARY_VALUE) return value;
  const normalized = normalizeMonetaryAmount(value);
  return normalized || value;
}

function normalizeSubTableRow(cells: unknown): string[] {
  if (!Array.isArray(cells)) return [];
  return cells.map((cell) => {
    const text = finalizeSummaryText(
      sanitizeMultilineSummaryText(String(cell ?? "").trim()),
    );
    return text || EMPTY_SUMMARY_VALUE;
  });
}

function normalizeSubTable(raw: unknown): OrderReportSummarySubTable | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const headers = Array.isArray(row.헤더)
    ? row.헤더
        .map((item) => normalizeSummaryField(item))
        .filter((item) => item !== EMPTY_SUMMARY_VALUE)
    : [];
  const bodyRows = Array.isArray(row.행)
    ? row.행
        .map(normalizeSubTableRow)
        .filter((cells) => cells.some((cell) => cell !== EMPTY_SUMMARY_VALUE))
    : [];
  const title = normalizeSummaryField(row.제목);
  const note =
    row.비고 != null
      ? normalizeMultilineSummaryField(row.비고)
      : EMPTY_SUMMARY_VALUE;

  if (
    title === EMPTY_SUMMARY_VALUE &&
    headers.length === 0 &&
    bodyRows.length === 0
  ) {
    return null;
  }

  return {
    제목: title !== EMPTY_SUMMARY_VALUE ? title : "표",
    헤더: headers,
    행: bodyRows,
    ...(note !== EMPTY_SUMMARY_VALUE ? { 비고: note } : {}),
  };
}

function normalizeOverviewRow(
  raw: unknown,
): OrderReportSummaryOverviewRow {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const tables = Array.isArray(row.표)
    ? row.표
        .map(normalizeSubTable)
        .filter((table): table is OrderReportSummarySubTable => table != null)
    : [];

  return {
    공사명: normalizeSummaryField(row.공사명),
    발주자: normalizeSummaryField(row.발주자),
    기초금액: normalizeFinancialSummaryField(
      normalizeSummaryField(row.기초금액),
    ),
    공사기간: normalizeSummaryField(row.공사기간),
    공사내용: normalizeMultilineSummaryField(row.공사내용),
    비고: normalizeMultilineSummaryField(row.비고),
    표: tables,
  };
}

function normalizeScheduleStep(raw: unknown): OrderReportSummaryScheduleStep {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    날짜: normalizeSummaryField(row.날짜),
    단계: normalizeSummaryField(row.단계),
  };
}

function normalizeQualificationRow(
  raw: unknown,
): OrderReportSummaryQualificationRow {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    구분: normalizeSummaryField(row.구분),
    기준: normalizeMultilineSummaryField(row.기준),
  };
}

function normalizeContactRow(raw: unknown): OrderReportSummaryContact {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const 구분 = normalizeSummaryField(row.구분);
  return {
    구분: 구분 !== EMPTY_SUMMARY_VALUE ? 구분 : "담당자",
    부서: normalizeSummaryField(row.부서),
    이름: normalizeSummaryField(row.이름),
    연락처: normalizeSummaryField(row.연락처),
  };
}

function hasContactValue(contact: OrderReportSummaryContact): boolean {
  return [contact.부서, contact.이름, contact.연락처].some(
    (value) => value !== EMPTY_SUMMARY_VALUE,
  );
}

function normalizeContacts(raw: unknown): OrderReportSummaryContact[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeContactRow).filter(hasContactValue);
  }

  if (raw && typeof raw === "object") {
    const single = normalizeContactRow(raw);
    return hasContactValue(single) ? [single] : [];
  }

  return [];
}

/** 이전 영문 키 스키마 → 신규 한글 키 구조 */
function migrateLegacySummaryData(
  raw: Record<string, unknown>,
): OrderReportSummaryData {
  const empty = emptyOrderReportSummaryData();
  const orderer = (raw.orderer as Record<string, unknown>) ?? {};
  const overview = (raw.overview as Record<string, unknown>) ?? {};
  const schedule = (raw.schedule as Record<string, unknown>) ?? {};
  const qualification = (raw.qualification as Record<string, unknown>) ?? {};

  const bidInfo = (raw.bidInfo as Record<string, unknown>) ?? {};
  const baseAmount =
    normalizeSummaryField(overview.baseAmount) !== EMPTY_SUMMARY_VALUE
      ? normalizeFinancialSummaryField(normalizeSummaryField(overview.baseAmount))
      : normalizeFinancialSummaryField(
          normalizeSummaryField(bidInfo.preliminary_base_price),
        );
  const estimatedPrice =
    normalizeSummaryField(overview.estimatedPrice) !== EMPTY_SUMMARY_VALUE
      ? normalizeFinancialSummaryField(
          normalizeSummaryField(overview.estimatedPrice),
        )
      : normalizeFinancialSummaryField(
          normalizeSummaryField(bidInfo.estimated_price),
        );

  const 비고Parts: string[] = [];
  if (estimatedPrice !== EMPTY_SUMMARY_VALUE) {
    비고Parts.push(`추정가격: ${estimatedPrice}`);
  }
  const scope = normalizeSummaryField(overview.scope);
  const location = normalizeSummaryField(overview.location);
  const targetEquipment = normalizeSummaryField(overview.targetEquipment);
  if (scope !== EMPTY_SUMMARY_VALUE) 비고Parts.push(scope);
  if (location !== EMPTY_SUMMARY_VALUE) 비고Parts.push(`장소: ${location}`);
  if (targetEquipment !== EMPTY_SUMMARY_VALUE) {
    비고Parts.push(`대상설비: ${targetEquipment}`);
  }

  const scheduleSteps: OrderReportSummaryScheduleStep[] = [
    { 날짜: normalizeSummaryField(schedule.noticeDate), 단계: "입찰공고" },
    { 날짜: EMPTY_SUMMARY_VALUE, 단계: "PQ서류 제출" },
    { 날짜: EMPTY_SUMMARY_VALUE, 단계: "입찰참가신청" },
    {
      날짜: normalizeSummaryField(schedule.bidSubmissionPeriod),
      단계: "입찰서 제출",
    },
    {
      날짜: normalizeSummaryField(schedule.openingDateTime),
      단계: "개찰",
    },
    {
      날짜: normalizeSummaryField(schedule.siteBriefing),
      단계: "현장설명회",
    },
    {
      날짜: normalizeSummaryField(schedule.qaDeadline),
      단계: "질의응답 마감",
    },
  ].filter(
    (step) =>
      step.날짜 !== EMPTY_SUMMARY_VALUE || step.단계 !== EMPTY_SUMMARY_VALUE,
  );

  const qualificationRows: OrderReportSummaryQualificationRow[] = [
    { 구분: "면허", 기준: normalizeSummaryField(qualification.license) },
    { 구분: "실적", 기준: normalizeSummaryField(qualification.performance) },
    {
      구분: "지역제한",
      기준: normalizeSummaryField(qualification.regionRestriction),
    },
    {
      구분: "기타",
      기준: normalizeSummaryField(qualification.otherRestrictions),
    },
  ].filter((row) => row.기준 !== EMPTY_SUMMARY_VALUE);

  return {
    발주기관: normalizeSummaryField(orderer.organization),
    공고명: empty.공고명,
    공고번호: empty.공고번호,
    생성일시: empty.생성일시,
    공사개요: [
      {
        공사명: EMPTY_SUMMARY_VALUE,
        발주자: EMPTY_SUMMARY_VALUE,
        기초금액: baseAmount,
        공사기간: normalizeSummaryField(overview.constructionPeriod),
        공사내용: scope !== EMPTY_SUMMARY_VALUE ? scope : EMPTY_SUMMARY_VALUE,
        비고: 비고Parts.length > 0 ? 비고Parts.join("\n") : EMPTY_SUMMARY_VALUE,
        표: [],
      },
    ],
    주요일정: scheduleSteps.length > 0 ? scheduleSteps : empty.주요일정,
    신청자격:
      qualificationRows.length > 0 ? qualificationRows : empty.신청자격,
    담당자: [
      {
        구분: "담당자",
        부서: normalizeSummaryField(orderer.department),
        이름: normalizeSummaryField(orderer.contactPerson),
        연락처: normalizeSummaryField(orderer.contact),
      },
    ].filter(hasContactValue),
  };
}

function normalizePqSummarySection(raw: unknown): OrderReportPqSummarySection {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    제목: normalizeSummaryField(row.제목),
    내용: normalizeMultilineSummaryField(row.내용),
  };
}

export function parseOrderReportPqAutoSummary(
  raw: unknown,
): OrderReportPqAutoSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const sections = Array.isArray(data.항목)
    ? data.항목
        .map(normalizePqSummarySection)
        .filter(
          (section) =>
            section.제목 !== EMPTY_SUMMARY_VALUE ||
            section.내용 !== EMPTY_SUMMARY_VALUE,
        )
    : [];
  const summaryText = normalizeMultilineSummaryField(data.요약);
  const files = Array.isArray(data.분석파일)
    ? data.분석파일
        .map((item) => normalizeSummaryField(item))
        .filter((item) => item !== EMPTY_SUMMARY_VALUE)
    : [];

  if (
    summaryText === EMPTY_SUMMARY_VALUE &&
    sections.length === 0 &&
    files.length === 0
  ) {
    return null;
  }

  return {
    요약: summaryText,
    항목: sections,
    분석파일: files,
  };
}

function isLegacyEnglishSummaryData(raw: Record<string, unknown>): boolean {
  return (
    "orderer" in raw ||
    "overview" in raw ||
    "schedule" in raw ||
    "qualification" in raw
  );
}

function isKoreanSummaryData(raw: Record<string, unknown>): boolean {
  return (
    "발주기관" in raw ||
    "공사개요" in raw ||
    "주요일정" in raw ||
    "신청자격" in raw ||
    "담당자" in raw
  );
}

function isSummaryBundleData(raw: Record<string, unknown>): boolean {
  return (
    raw.version === 2 ||
    "입찰공고문" in raw ||
    "pq적격심사" in raw ||
    "분석제외" in raw
  );
}

export function buildOrderReportSummaryBundle(options: {
  bidNotice: OrderReportSummaryData | null;
  pq: OrderReportPqAutoSummary | null;
  excluded?: string[];
  bidNoticeSourceFiles?: string[];
  pqSourceFiles?: string[];
}): OrderReportSummaryBundle {
  return {
    version: 2,
    입찰공고문: options.bidNotice,
    pq적격심사: options.pq,
    분석제외: options.excluded ?? [],
    입찰공고문분석파일: options.bidNoticeSourceFiles ?? [],
    pq분석파일: options.pqSourceFiles ?? [],
  };
}

export function parseOrderReportSummaryBundle(
  raw: unknown,
): OrderReportSummaryBundle {
  const emptyBundle = buildOrderReportSummaryBundle({
    bidNotice: null,
    pq: null,
    excluded: [],
  });

  if (!raw || typeof raw !== "object") {
    return emptyBundle;
  }

  const data = raw as Record<string, unknown>;

  if (isSummaryBundleData(data)) {
    const excluded = Array.isArray(data.분석제외)
      ? data.분석제외
          .map((item) => normalizeSummaryField(item))
          .filter((item) => item !== EMPTY_SUMMARY_VALUE)
      : [];
    const bidNoticeSourceFiles = Array.isArray(data.입찰공고문분석파일)
      ? data.입찰공고문분석파일
          .map((item) => normalizeSummaryField(item))
          .filter((item) => item !== EMPTY_SUMMARY_VALUE)
      : [];
    const pqSourceFiles = Array.isArray(data.pq분석파일)
      ? data.pq분석파일
          .map((item) => normalizeSummaryField(item))
          .filter((item) => item !== EMPTY_SUMMARY_VALUE)
      : [];

    return {
      version: 2,
      입찰공고문: data.입찰공고문
        ? parseOrderReportSummaryData(data.입찰공고문)
        : null,
      pq적격심사: parseOrderReportPqAutoSummary(data.pq적격심사),
      분석제외: excluded,
      입찰공고문분석파일: bidNoticeSourceFiles,
      pq분석파일: pqSourceFiles,
    };
  }

  if (isLegacyEnglishSummaryData(data)) {
    return buildOrderReportSummaryBundle({
      bidNotice: migrateLegacySummaryData(data),
      pq: null,
      excluded: [],
    });
  }

  if (isKoreanSummaryData(data)) {
    return buildOrderReportSummaryBundle({
      bidNotice: parseOrderReportSummaryData(data),
      pq: null,
      excluded: [],
    });
  }

  return emptyBundle;
}

export function parseOrderReportSummaryData(raw: unknown): OrderReportSummaryData {
  const empty = emptyOrderReportSummaryData();
  if (!raw || typeof raw !== "object") return empty;

  const data = raw as Record<string, unknown>;
  if (isLegacyEnglishSummaryData(data) && !isKoreanSummaryData(data)) {
    return migrateLegacySummaryData(data);
  }

  const overviewRows = Array.isArray(data.공사개요)
    ? data.공사개요.map(normalizeOverviewRow)
    : [];
  const scheduleSteps = Array.isArray(data.주요일정)
    ? data.주요일정.map(normalizeScheduleStep)
    : [];
  const qualificationRows = Array.isArray(data.신청자격)
    ? data.신청자격.map(normalizeQualificationRow)
    : [];

  return {
    발주기관: normalizeSummaryField(data.발주기관),
    공고명: normalizeSummaryField(data.공고명),
    공고번호: normalizeSummaryField(data.공고번호),
    생성일시: normalizeSummaryField(data.생성일시),
    공사개요: overviewRows.length > 0 ? overviewRows : empty.공사개요,
    주요일정: scheduleSteps,
    신청자격: qualificationRows,
    담당자: normalizeContacts(data.담당자),
  };
}

export function enrichSummaryWithNoticeMetadata(
  summary: OrderReportSummaryData,
  notice: { title: string; notice_no: string },
  generatedAt: Date,
): OrderReportSummaryData {
  return {
    ...summary,
    공고명: notice.title || summary.공고명,
    공고번호: notice.notice_no || summary.공고번호,
    생성일시: generatedAt.toLocaleString("ko-KR"),
  };
}
