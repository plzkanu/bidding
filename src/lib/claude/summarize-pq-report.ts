import {
  generateClaudeJsonContent,
  type ClaudeContentBlock,
} from "@/lib/claude/generate-content";
import { getClaudeModel } from "@/lib/claude/config";
import {
  collectAttachmentPlan,
  type SummarizeOrderReportInput,
} from "@/lib/claude/summarize-order-report";
import {
  CLAUDE_MAX_PDF_PAGES_PER_REQUEST,
  normalizePdfChunksForClaude,
  type PdfChunkMeta,
} from "@/lib/order-report-summary/pdf-page-limit";
import { ORDER_REPORT_PQ_SUMMARY_PROMPT } from "@/lib/order-report-summary/prompt";
import { parseLlmJsonResponse } from "@/lib/order-report-summary/llm-json";
import {
  parseOrderReportPqAutoSummary,
  type OrderReportPqAutoSummary,
} from "@/lib/order-report-summary/types";
import { setSummaryProgressPhase } from "@/lib/order-report-summary/summary-progress";
import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";
import { BID_NOTICE_TYPE_LABELS } from "@/lib/bid-notices/types";

const JSON_OUTPUT_INSTRUCTION = `위 PQ·적격심사 문서를 분석하여 반드시 순수 JSON만 출력하세요.
마크다운 코드블록(\`\`\`), 설명 텍스트 없이 JSON 객체만 반환하세요.
출력 형식은 system 프롬프트의 "출력 JSON 구조"를 따르세요.`;

const BATCH_MERGE_INSTRUCTION = `이전에 추출한 JSON과 이번에 추가된 PDF 페이지를 함께 분석하세요.
누락된 PQ·적격심사 정보를 보완한 뒤, system 프롬프트의 출력 JSON 구조에 맞는 완전한 JSON만 출력하세요.`;

function buildNoticeContext(notice: KhnpBidNoticeRow): string {
  return [
    "=== 공고 메타데이터 ===",
    `공고번호: ${notice.notice_no}`,
    `공고명: ${notice.title}`,
    `공고유형: ${BID_NOTICE_TYPE_LABELS[notice.notice_type]}`,
  ].join("\n");
}

function buildPdfChunkLabel(chunk: PdfChunkMeta): string {
  if (chunk.chunkCount <= 1) return chunk.fileName;
  return `${chunk.fileName} (${chunk.chunkIndex + 1}/${chunk.chunkCount} 부분)`;
}

function pdfChunksToContentBlocks(
  chunks: PdfChunkMeta[],
  descriptionByFile: Map<string, string[]>,
): ClaudeContentBlock[] {
  const blocks: ClaudeContentBlock[] = [];
  const describedFiles = new Set<string>();

  for (const chunk of chunks) {
    const chunkLabel = buildPdfChunkLabel(chunk);
    const textLines = [`[첨부파일: ${chunkLabel}]`];

    if (!describedFiles.has(chunk.fileName)) {
      const descriptions = descriptionByFile.get(chunk.fileName) ?? [];
      textLines.push(
        ...descriptions.filter((line) => !line.startsWith("[첨부파일:")),
      );
      describedFiles.add(chunk.fileName);
    } else if (chunk.chunkIndex > 0) {
      textLines.push("동일 첨부파일의 연속 페이지입니다.");
    }

    blocks.push({ type: "text", text: textLines.join("\n") });
    blocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: chunk.buffer.toString("base64"),
      },
    });
  }

  return blocks;
}

export async function summarizePqOrderReportWithClaude(
  input: SummarizeOrderReportInput,
): Promise<{ summary: OrderReportPqAutoSummary; model: string }> {
  const {
    pdfChunks,
    otherBlocks,
    skipped,
    pdfDescriptionByFile,
  } = await collectAttachmentPlan(input.attachments, input.progress);

  if (input.progress) {
    setSummaryProgressPhase(input.progress.userId, input.progress.noticeId, "llm");
  }

  if (pdfChunks.length === 0 && otherBlocks.length === 0) {
    const skipNote =
      skipped.length > 0 ? ` 제외된 파일: ${skipped.join(", ")}` : "";
    throw new Error(
      `PQ·적격심사 요약 가능한 첨부파일(PDF, DOCX, TXT, HWP→PDF)이 없습니다.${skipNote}`,
    );
  }

  const modelName = getClaudeModel();
  const contextBlock = buildNoticeContext(input.notice);
  const verifiedChunks = await normalizePdfChunksForClaude(pdfChunks);
  const pdfBatches = verifiedChunks.map((chunk) => [chunk]);
  let latestSummaryJson = "";

  for (let batchIndex = 0; batchIndex < pdfBatches.length; batchIndex += 1) {
    const batch = pdfBatches[batchIndex]!;
    const chunk = batch[0]!;

    if (chunk.pageCount > CLAUDE_MAX_PDF_PAGES_PER_REQUEST) {
      throw new Error(
        `첨부 PDF "${chunk.fileName}" 페이지 수(${chunk.pageCount})가 Claude API 한도를 초과합니다.`,
      );
    }

    const batchPdfBlocks = pdfChunksToContentBlocks(
      batch,
      pdfDescriptionByFile,
    );

    const contentBlocks: ClaudeContentBlock[] = [
      { type: "text", text: contextBlock },
    ];

    if (batchIndex === 0) {
      contentBlocks.push(...otherBlocks);
    }

    if (pdfBatches.length > 1) {
      contentBlocks.push({
        type: "text",
        text: `=== PDF 분석 배치 ${batchIndex + 1}/${pdfBatches.length} ===`,
      });
    }

    if (batchIndex > 0 && latestSummaryJson) {
      contentBlocks.push({
        type: "text",
        text: `=== 이전 배치에서 추출한 JSON ===\n${latestSummaryJson}`,
      });
      contentBlocks.push({
        type: "text",
        text: BATCH_MERGE_INSTRUCTION,
      });
    }

    contentBlocks.push(...batchPdfBlocks);
    contentBlocks.push({ type: "text", text: JSON_OUTPUT_INSTRUCTION });

    latestSummaryJson = await generateClaudeJsonContent({
      systemPrompt: ORDER_REPORT_PQ_SUMMARY_PROMPT,
      contentBlocks,
    });
  }

  if (!latestSummaryJson && otherBlocks.length > 0) {
    const contentBlocks: ClaudeContentBlock[] = [
      { type: "text", text: contextBlock },
      ...otherBlocks,
      { type: "text", text: JSON_OUTPUT_INSTRUCTION },
    ];
    latestSummaryJson = await generateClaudeJsonContent({
      systemPrompt: ORDER_REPORT_PQ_SUMMARY_PROMPT,
      contentBlocks,
    });
  }

  let parsed: unknown;
  try {
    parsed = parseLlmJsonResponse(latestSummaryJson);
  } catch {
    throw new Error("Claude PQ 요약 JSON 응답 파싱에 실패했습니다.");
  }

  const summary = parseOrderReportPqAutoSummary(parsed);
  if (!summary) {
    throw new Error("Claude PQ 요약 결과가 비어 있습니다.");
  }

  return {
    summary: {
      ...summary,
      분석파일: input.attachments.map((item) => item.fileName),
    },
    model: modelName,
  };
}
