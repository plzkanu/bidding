import { generateExaoneJsonContent } from "@/lib/exaone/generate-content";
import { getExaoneModel } from "@/lib/exaone/config";
import { collectAttachmentTextsForExaone } from "@/lib/order-report-summary/attachment-text";
import { EXAONE_MAX_TOTAL_TEXT_CHARS } from "@/lib/order-report-summary/config";
import { parseLlmJsonResponse } from "@/lib/order-report-summary/llm-json";
import { ORDER_REPORT_PQ_TEXT_SUMMARY_PROMPT } from "@/lib/order-report-summary/prompt";
import type { SummarizeOrderReportInput } from "@/lib/order-report-summary/summarize-input";
import { setSummaryProgressPhase } from "@/lib/order-report-summary/summary-progress";
import {
  parseOrderReportPqAutoSummary,
  type OrderReportPqAutoSummary,
} from "@/lib/order-report-summary/types";
import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";
import { BID_NOTICE_TYPE_LABELS } from "@/lib/bid-notices/types";

const JSON_OUTPUT_INSTRUCTION = `위 PQ·적격심사 문서 텍스트를 분석하여 반드시 순수 JSON만 출력하세요.
마크다운 코드블록(\`\`\`), 설명 텍스트 없이 JSON 객체만 반환하세요.`;

function buildNoticeContext(notice: KhnpBidNoticeRow): string {
  return [
    "=== 공고 메타데이터 ===",
    `공고번호: ${notice.notice_no}`,
    `공고명: ${notice.title}`,
    `공고유형: ${BID_NOTICE_TYPE_LABELS[notice.notice_type]}`,
  ].join("\n");
}

const EXAONE_JSON_RETRY_HINT = `이전 응답이 잘못되었습니다. 반드시 유효한 JSON만 출력하세요.
- 한글 문장은 띄어쓰기를 포함하여 작성
- JSON 문자열 안의 따옴표는 \\" 로 이스케이프`;

async function requestExaonePqSummaryJson(
  userContent: string,
  retry = false,
): Promise<string> {
  const content = retry
    ? `${userContent}\n\n${EXAONE_JSON_RETRY_HINT}`
    : userContent;

  return generateExaoneJsonContent({
    systemPrompt: ORDER_REPORT_PQ_TEXT_SUMMARY_PROMPT,
    userContent: content,
    maxTokens: 8192,
  });
}

export async function summarizePqOrderReportWithExaone(
  input: SummarizeOrderReportInput,
): Promise<{ summary: OrderReportPqAutoSummary; model: string }> {
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
      `PQ·적격심사 요약 가능한 첨부파일에서 텍스트를 추출하지 못했습니다.${skipNote}`,
    );
  }

  const attachmentBlocks = sections
    .map(
      (section) => `=== 첨부파일: ${section.fileName} ===\n${section.text}`,
    )
    .join("\n\n");

  const userContent = [
    buildNoticeContext(input.notice),
    attachmentBlocks,
    JSON_OUTPUT_INSTRUCTION,
  ].join("\n\n");

  const modelName = getExaoneModel();
  let latestSummaryJson = "";
  let lastParseError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      latestSummaryJson = await requestExaonePqSummaryJson(
        userContent,
        attempt > 0,
      );
      parseLlmJsonResponse(latestSummaryJson);
      lastParseError = null;
      break;
    } catch (err) {
      lastParseError = err instanceof Error ? err : new Error(String(err));
      const retryable =
        attempt === 0 &&
        (lastParseError.message.includes("JSON") ||
          lastParseError.message.includes("잘렸습니다"));
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
    throw new Error("LG엑사원 PQ 요약 JSON 응답 파싱에 실패했습니다.");
  }

  const summary = parseOrderReportPqAutoSummary(parsed);
  if (!summary) {
    throw new Error("LG엑사원 PQ 요약 결과가 비어 있습니다.");
  }

  return {
    summary: {
      ...summary,
      분석파일: input.attachments.map((item) => item.fileName),
    },
    model: modelName,
  };
}
