import {
  generateClaudeJsonContent,
  type ClaudeContentBlock,
} from "@/lib/claude/generate-content";
import { getClaudeModel } from "@/lib/claude/config";
import {
  isHwpFileName,
  isZipFileName,
} from "@/lib/order-report-summary/hwp-text";
import { extractAttachmentTextForHints } from "@/lib/order-report-summary/attachment-text";
import {
  convertHwpBufferToPdf,
  getHwpConversionSetupHint,
  HwpToPdfError,
} from "@/lib/order-report-summary/hwp-to-pdf";
import { preprocessTextForGemini } from "@/lib/order-report-summary/gemini-text-preprocess";
import { ORDER_REPORT_SUMMARY_PROMPT } from "@/lib/order-report-summary/prompt";
import {
  applyFinancialHints,
  buildFinancialHintPromptBlock,
  extractBaseAmountHintsFromTexts,
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
  buildPdfChunksFromBuffer,
  CLAUDE_MAX_PDF_PAGES_PER_REQUEST,
  CLAUDE_REQUEST_SIZE_WARN_BYTES,
  normalizePdfChunksForClaude,
  type PdfChunkMeta,
} from "@/lib/order-report-summary/pdf-page-limit";
import {
  enrichSummaryWithNoticeMetadata,
  parseOrderReportSummaryData,
  type OrderReportSummaryData,
} from "@/lib/order-report-summary/types";
import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";
import { BID_NOTICE_TYPE_LABELS } from "@/lib/bid-notices/types";
import type {
  SummarizeAttachmentInput,
  SummarizeOrderReportInput,
  SummaryProgressContext,
} from "@/lib/order-report-summary/summarize-input";
import {
  setSummaryAttachmentStatus,
  setSummaryProgressPhase,
} from "@/lib/order-report-summary/summary-progress";

export type { SummarizeAttachmentInput, SummarizeOrderReportInput };

const CLAUDE_INLINE_MAX_BYTES = 20 * 1024 * 1024;

const JSON_OUTPUT_INSTRUCTION = `위 문서를 분석하여 반드시 순수 JSON만 출력하세요.
마크다운 코드블록(\`\`\`), 설명 텍스트, 추론 과정 없이 JSON 객체만 반환하세요.
출력 형식은 system 프롬프트의 "출력 JSON 구조"를 따르세요.`;

const BATCH_MERGE_INSTRUCTION = `이전에 추출한 JSON과 이번에 추가된 PDF 페이지를 함께 분석하세요.
누락된 필드를 보완하고 더 정확한 값이 있으면 갱신한 뒤, system 프롬프트의 출력 JSON 구조에 맞는 완전한 JSON만 출력하세요.
특히 신청자격은 이전 JSON과 새 문서의 조건을 **병합**하세요. 기존 조항을 삭제하지 말고, 새로 발견한 참가자격·제한 조항을 누락 없이 추가하세요.`;

const PROCESSABLE_MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

function getFileExtension(fileName: string): string {
  const base = fileName.replace(/[/\\]/g, "").trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

function resolveAttachmentMimeType(
  fileName: string,
  mimeType: string | null,
): string | null {
  const ext = getFileExtension(fileName);
  if (ext && PROCESSABLE_MIME_BY_EXT[ext]) {
    return PROCESSABLE_MIME_BY_EXT[ext];
  }
  if (mimeType === "application/pdf") return mimeType;
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return mimeType;
  }
  if (mimeType === "text/plain") return mimeType;
  return null;
}

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

function reportAttachmentSkipped(
  progress: SummaryProgressContext | undefined,
  fileName: string,
  detail: string,
): void {
  if (!progress) return;
  setSummaryAttachmentStatus(
    progress.userId,
    progress.noticeId,
    fileName,
    "skipped",
    detail,
  );
}

function reportAttachmentDone(
  progress: SummaryProgressContext | undefined,
  fileName: string,
): void {
  if (!progress) return;
  setSummaryAttachmentStatus(
    progress.userId,
    progress.noticeId,
    fileName,
    "done",
  );
}

export async function collectAttachmentPlan(
  attachments: SummarizeAttachmentInput[],
  progress?: SummaryProgressContext,
): Promise<{
  pdfChunks: PdfChunkMeta[];
  otherBlocks: ClaudeContentBlock[];
  skipped: string[];
  plainTexts: Array<{ fileName: string; text: string }>;
  pdfDescriptionByFile: Map<string, string[]>;
}> {
  const pdfChunks: PdfChunkMeta[] = [];
  const otherBlocks: ClaudeContentBlock[] = [];
  const skipped: string[] = [];
  const plainTexts: Array<{ fileName: string; text: string }> = [];
  const pdfDescriptionByFile = new Map<string, string[]>();
  let sentPdfBytes = 0;

  if (progress) {
    setSummaryProgressPhase(progress.userId, progress.noticeId, "extract");
  }

  for (const attachment of attachments) {
    if (isZipFileName(attachment.fileName)) {
      reportAttachmentSkipped(progress, attachment.fileName, "ZIP 파일 제외");
      continue;
    }

    if (isHwpFileName(attachment.fileName)) {
      if (attachment.buffer.byteLength > CLAUDE_INLINE_MAX_BYTES) {
        const detail = "20MB 초과";
        skipped.push(`${attachment.fileName} (${detail})`);
        reportAttachmentSkipped(progress, attachment.fileName, detail);
        continue;
      }

      try {
        const { pdf, pdfFileName } = await convertHwpBufferToPdf(
          attachment.buffer,
          attachment.fileName,
        );

        const hwpPlain = await extractAttachmentTextForHints(attachment);
        if (hwpPlain?.trim()) {
          plainTexts.push({
            fileName: attachment.fileName,
            text: preprocessTextForGemini(hwpPlain),
          });
        }

        pdfDescriptionByFile.set(attachment.fileName, [
          `[첨부파일: ${attachment.fileName} → PDF: ${pdfFileName}]`,
          "첨부된 PDF 문서의 표에 기재된 금액 항목과 입찰참가자격·신청자격 조항을 시각적으로 찾아 추출하세요.",
          "표·글상자·2열 목록 레이아웃을 확인하세요. 참가자격 조건은 요약하지 말고 빠짐없이 기록하세요.",
        ]);

        const chunks = await buildPdfChunksFromBuffer(attachment.fileName, pdf);
        for (const chunk of chunks) {
          if (chunk.buffer.byteLength > CLAUDE_INLINE_MAX_BYTES) {
            skipped.push(`${buildPdfChunkLabel(chunk)} (20MB 초과)`);
            continue;
          }
          sentPdfBytes += chunk.buffer.byteLength;
          pdfChunks.push(chunk);
        }
        reportAttachmentDone(progress, attachment.fileName);
      } catch (err) {
        const message =
          err instanceof HwpToPdfError
            ? err.message
            : "HWP→PDF 변환 실패";
        skipped.push(`${attachment.fileName} (${message})`);
        reportAttachmentSkipped(progress, attachment.fileName, message);
      }
      continue;
    }

    const attachmentMime = resolveAttachmentMimeType(
      attachment.fileName,
      attachment.mimeType,
    );

    if (!attachmentMime) {
      const detail = "지원하지 않는 형식";
      skipped.push(`${attachment.fileName} (${detail})`);
      reportAttachmentSkipped(progress, attachment.fileName, detail);
      continue;
    }

    if (attachment.buffer.byteLength > CLAUDE_INLINE_MAX_BYTES) {
      const detail = "20MB 초과";
      skipped.push(`${attachment.fileName} (${detail})`);
      reportAttachmentSkipped(progress, attachment.fileName, detail);
      continue;
    }

    const plain = await extractAttachmentTextForHints(attachment);
    if (plain) {
      plainTexts.push({
        fileName: attachment.fileName,
        text: preprocessTextForGemini(plain),
      });
    }

    if (attachmentMime === "text/plain") {
      const fileText = preprocessTextForGemini(
        attachment.buffer.toString("utf-8"),
      );
      otherBlocks.push({
        type: "text",
        text: `[첨부파일: ${attachment.fileName}]\n${fileText}`,
      });
      reportAttachmentDone(progress, attachment.fileName);
      continue;
    }

    if (attachmentMime === "application/pdf") {
      pdfDescriptionByFile.set(attachment.fileName, [
        `[첨부파일: ${attachment.fileName}]`,
        "첨부된 PDF 문서의 표에 기재된 금액 항목과 입찰참가자격·신청자격 조항을 시각적으로 찾아 추출하세요.",
      ]);

      const chunks = await buildPdfChunksFromBuffer(
        attachment.fileName,
        attachment.buffer,
      );
      for (const chunk of chunks) {
        if (chunk.buffer.byteLength > CLAUDE_INLINE_MAX_BYTES) {
          skipped.push(`${buildPdfChunkLabel(chunk)} (20MB 초과)`);
          continue;
        }
        sentPdfBytes += chunk.buffer.byteLength;
        pdfChunks.push(chunk);
      }
      reportAttachmentDone(progress, attachment.fileName);
      continue;
    }

    otherBlocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: attachmentMime,
        data: attachment.buffer.toString("base64"),
      },
    });
    otherBlocks.push({
      type: "text",
      text: `[첨부파일: ${attachment.fileName}]`,
    });
    reportAttachmentDone(progress, attachment.fileName);
  }

  if (sentPdfBytes > CLAUDE_REQUEST_SIZE_WARN_BYTES) {
    const sizeMb = (sentPdfBytes / (1024 * 1024)).toFixed(1);
    console.warn(
      `[order-report-summary] PDF 첨부 총 용량 ${sizeMb}MB — Claude API 요청 크기 제한 초과 가능성이 있습니다.`,
    );
  }

  return { pdfChunks, otherBlocks, skipped, plainTexts, pdfDescriptionByFile };
}

export async function summarizeOrderReportWithClaude(
  input: SummarizeOrderReportInput,
): Promise<{ summary: OrderReportSummaryData; model: string }> {
  const {
    pdfChunks,
    otherBlocks,
    skipped,
    plainTexts,
    pdfDescriptionByFile,
  } = await collectAttachmentPlan(input.attachments, input.progress);

  if (input.progress) {
    setSummaryProgressPhase(input.progress.userId, input.progress.noticeId, "llm");
  }

  if (pdfChunks.length === 0 && otherBlocks.length === 0) {
    const skipNote =
      skipped.length > 0
        ? ` 제외된 파일: ${skipped.join(", ")}`
        : "";
    const hwpHint = skipped.some((s) => /\.hwp/i.test(s))
      ? ` ${getHwpConversionSetupHint()}`
      : "";
    throw new Error(
      `요약 가능한 첨부파일(PDF, DOCX, TXT, HWP→PDF)이 없습니다.${skipNote}${hwpHint}`,
    );
  }

  const baseAmountHints = extractBaseAmountHintsFromTexts(plainTexts);
  const estimatedPriceHints = extractEstimatedPriceHintsFromTexts(plainTexts);
  const qualificationHints = extractQualificationHintsFromTexts(plainTexts);
  const contactHints = extractContactHintsFromTexts(plainTexts);
  const hintBlock = [
    buildFinancialHintPromptBlock(baseAmountHints, estimatedPriceHints),
    buildQualificationHintPromptBlock(qualificationHints),
    buildContactHintPromptBlock(contactHints),
  ]
    .filter(Boolean)
    .join("\n\n");

  const modelName = getClaudeModel();
  const contextBlock = [buildNoticeContext(input.notice), hintBlock]
    .filter(Boolean)
    .join("\n\n");

  // 200k 모델: 요청당 PDF 최대 100페이지 → PDF document 블록은 요청당 1개만 전송
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
    const totalPages = chunk.pageCount;

    const contentBlocks: ClaudeContentBlock[] = [{ type: "text", text: contextBlock }];

    if (batchIndex === 0) {
      contentBlocks.push(...otherBlocks);
    }

    if (pdfBatches.length > 1) {
      contentBlocks.push({
        type: "text",
        text: `=== PDF 분석 배치 ${batchIndex + 1}/${pdfBatches.length} (${totalPages}페이지) ===`,
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

    const text = await generateClaudeJsonContent({
      systemPrompt: ORDER_REPORT_SUMMARY_PROMPT,
      contentBlocks,
    });

    latestSummaryJson = text;
  }

  if (!latestSummaryJson && otherBlocks.length > 0) {
    const contentBlocks: ClaudeContentBlock[] = [
      { type: "text", text: contextBlock },
      ...otherBlocks,
      { type: "text", text: JSON_OUTPUT_INSTRUCTION },
    ];
    latestSummaryJson = await generateClaudeJsonContent({
      systemPrompt: ORDER_REPORT_SUMMARY_PROMPT,
      contentBlocks,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(latestSummaryJson);
  } catch {
    throw new Error("Claude JSON 응답 파싱에 실패했습니다.");
  }

  const generatedAt = new Date();
  const summary = enrichSummaryWithNoticeMetadata(
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
    input.notice,
    generatedAt,
  );

  return {
    summary,
    model: modelName,
  };
}
