import { generateExaoneJsonContent } from "@/lib/exaone/generate-content";
import { getExaoneModel } from "@/lib/exaone/config";
import { collectAttachmentTextsForExaone } from "@/lib/order-report-summary/attachment-text";
import { EXAONE_MAX_TOTAL_TEXT_CHARS } from "@/lib/order-report-summary/config";
import { parseLlmJsonResponse } from "@/lib/order-report-summary/llm-json";
import { jsonHasTruncationEllipsis } from "@/lib/order-report-summary/text-sanitize";
import { ORDER_REPORT_TEXT_SUMMARY_PROMPT } from "@/lib/order-report-summary/prompt";
import type { SummarizeOrderReportInput } from "@/lib/order-report-summary/summarize-input";
import { setSummaryProgressPhase } from "@/lib/order-report-summary/summary-progress";
import {
  applyBidMethodHint,
  applyFinancialHints,
  buildFinancialHintPromptBlock,
  extractBaseAmountHintsFromTexts,
  extractBidMethodFromTexts,
  extractEstimatedPriceHintsFromTexts,
} from "@/lib/order-report-summary/text-hints";
import {
  applyContactHints,
  buildContactHintPromptBlock,
  extractContactHintsFromTexts,
} from "@/lib/order-report-summary/contact-hints";
import {
  applyQualificationHints,
  buildQualificationHintPromptBlock,
  extractQualificationHintsFromTexts,
} from "@/lib/order-report-summary/qualification-hints";
import {
  enrichSummaryWithNoticeMetadata,
  parseOrderReportSummaryData,
  type OrderReportSummaryData,
} from "@/lib/order-report-summary/types";
import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";
import { BID_NOTICE_TYPE_LABELS } from "@/lib/bid-notices/types";

const JSON_OUTPUT_INSTRUCTION = `위 문서 텍스트를 분석하여 반드시 순수 JSON만 출력하세요.
마크다운 코드블록(\`\`\`), 설명 텍스트, 추론 과정 없이 JSON 객체만 반환하세요.
출력 형식은 system 프롬프트의 "출력 JSON 구조"를 따르세요.
공사개요 표 셀·공사내용·공사기간·자격기준·비고에는 말줄임표(...)를 쓰지 말고 문서 원문 전체를 기입하세요.
출력 JSON 구조의 예시 값을 그대로 복사하지 마세요.`;

function resolveBidOpen(notice: KhnpBidNoticeRow) {
  const open = notice.khnp_bid_open;
  return Array.isArray(open) ? open[0] : open;
}

function buildNoticeContext(notice: KhnpBidNoticeRow): string {
  const bidOpen = resolveBidOpen(notice);
  const lines = [
    "=== 공고 메타데이터 (첨부와 교차 확인용) ===",
    `공고번호: ${notice.notice_no}`,
    `공고명: ${notice.title}`,
    `공고유형: ${BID_NOTICE_TYPE_LABELS[notice.notice_type]}`,
    `부서: ${notice.dept_name ?? "미기재"}`,
    `공고일: ${notice.notice_date ?? "미기재"}`,
    `공고기간: ${notice.notice_period_start ?? "-"} ~ ${notice.notice_period_end ?? "-"}`,
  ];

  if (bidOpen) {
    lines.push(
      `입찰방법: ${bidOpen.bid_method ?? "미기재"}`,
      `입찰시작: ${bidOpen.bid_start_dt ?? "미기재"}`,
      `입찰마감: ${bidOpen.bid_close_dt ?? "미기재"}`,
      `낙찰방법: ${bidOpen.award_method ?? "미기재"}`,
    );
  }

  return lines.join("\n");
}

const EXAONE_JSON_RETRY_HINT = `이전 응답이 잘못되었습니다. 반드시 유효한 JSON만 출력하세요.
- 신청자격.기준은 입찰 참가 판단에 필요한 핵심 조건만 한 줄씩 (법령 전문·보안 규정 전문·서문 제외)
- 한글 문장은 **띄어쓰기를 포함**하여 작성 (공백 없이 이어 붙이지 말 것)
- JSON 문자열 안의 따옴표는 \\" 로 이스케이프
- 표 셀·공사내용 등 어떤 값에도 ... 또는 … 로 내용을 줄이지 말 것`;

async function requestExaoneSummaryJson(
  userContent: string,
  retry = false,
): Promise<string> {
  const content = retry
    ? `${userContent}\n\n${EXAONE_JSON_RETRY_HINT}`
    : userContent;

  return generateExaoneJsonContent({
    systemPrompt: ORDER_REPORT_TEXT_SUMMARY_PROMPT,
    userContent: content,
    maxTokens: 16384,
  });
}

export async function summarizeOrderReportWithExaone(
  input: SummarizeOrderReportInput,
): Promise<{ summary: OrderReportSummaryData; model: string }> {
  const { sections, skipped } = await collectAttachmentTextsForExaone(
    input.attachments,
    input.progress,
    { maxTotalChars: EXAONE_MAX_TOTAL_TEXT_CHARS },
  );

  if (input.progress) {
    setSummaryProgressPhase(input.progress.userId, input.progress.noticeId, "llm");
  }

  if (sections.length === 0) {
    const skipNote =
      skipped.length > 0 ? ` 제외된 파일: ${skipped.join(", ")}` : "";
    throw new Error(
      `요약 가능한 첨부파일에서 텍스트를 추출하지 못했습니다. HWP/HWPX는 PDF 변환 없이 hwpkit으로 직접 읽습니다 (py -m pip install hwpkit).${skipNote}`,
    );
  }

  const plainTexts = sections.map((section) => ({
    fileName: section.fileName,
    text: section.text,
  }));

  const baseAmountHints = extractBaseAmountHintsFromTexts(plainTexts);
  const estimatedPriceHints = extractEstimatedPriceHintsFromTexts(plainTexts);
  const bidMethodHint = extractBidMethodFromTexts(plainTexts);
  const qualificationHints = extractQualificationHintsFromTexts(plainTexts);
  const contactHints = extractContactHintsFromTexts(plainTexts);
  const hintBlock = [
    buildFinancialHintPromptBlock(baseAmountHints, estimatedPriceHints),
    bidMethodHint
      ? `=== 첨부 텍스트 자동 추출 힌트 (입찰방법) ===\n- 입찰방법: ${bidMethodHint}\n공사개요[].입찰방법에 원문 그대로 반영하세요.`
      : "",
    buildQualificationHintPromptBlock(qualificationHints),
    buildContactHintPromptBlock(contactHints),
  ]
    .filter(Boolean)
    .join("\n\n");

  const attachmentBlocks = sections
    .map(
      (section) =>
        `=== 첨부파일: ${section.fileName} ===\n${section.text}`,
    )
    .join("\n\n");

  const userContent = [
    buildNoticeContext(input.notice),
    hintBlock,
    attachmentBlocks,
    JSON_OUTPUT_INSTRUCTION,
  ]
    .filter(Boolean)
    .join("\n\n");

  const modelName = getExaoneModel();

  let latestSummaryJson = "";
  let lastParseError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      latestSummaryJson = await requestExaoneSummaryJson(userContent, attempt > 0);
      const parsedAttempt = parseLlmJsonResponse(latestSummaryJson);
      if (jsonHasTruncationEllipsis(parsedAttempt)) {
        throw new Error("요약에 말줄임표가 포함되어 원문을 다시 추출합니다.");
      }
      lastParseError = null;
      break;
    } catch (err) {
      lastParseError = err instanceof Error ? err : new Error(String(err));
      const retryable =
        attempt === 0 &&
        (lastParseError.message.includes("JSON") ||
          lastParseError.message.includes("잘렸습니다") ||
          lastParseError.message.includes("말줄임"));
      if (!retryable) {
        throw lastParseError;
      }
    }
  }

  if (lastParseError) {
    throw lastParseError;
  }

  let parsed: unknown;
  try {
    parsed = parseLlmJsonResponse(latestSummaryJson);
  } catch {
    throw new Error("LG엑사원 JSON 응답 파싱에 실패했습니다.");
  }

  const generatedAt = new Date();
  const summary = enrichSummaryWithNoticeMetadata(
    applyBidMethodHint(
      applyContactHints(
        applyQualificationHints(
          applyFinancialHints(
            parseOrderReportSummaryData(parsed),
            baseAmountHints,
            estimatedPriceHints,
          ),
          qualificationHints,
        ),
        contactHints,
      ),
      bidMethodHint,
    ),
    input.notice,
    generatedAt,
  );

  return {
    summary,
    model: modelName,
  };
}
