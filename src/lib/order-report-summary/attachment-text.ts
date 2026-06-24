import JSZip from "jszip";
import {
  enrichHwpTextForExtraction,
  extractAttachmentPlainText,
  extractHwpDocumentText,
  isHwpFileName,
  isZipFileName,
} from "@/lib/order-report-summary/hwp-text";
import { extractHwpTextViaPython } from "@/lib/order-report-summary/hwp-text-python";
import { EXAONE_MAX_TOTAL_TEXT_CHARS } from "@/lib/order-report-summary/config";
import { preprocessTextForGemini } from "@/lib/order-report-summary/gemini-text-preprocess";
import { sanitizeSummaryText } from "@/lib/order-report-summary/text-sanitize";
import type {
  SummarizeAttachmentInput,
  SummaryProgressContext,
} from "@/lib/order-report-summary/summarize-input";
import {
  setSummaryAttachmentStatus,
  setSummaryProgressPhase,
} from "@/lib/order-report-summary/summary-progress";

const MAX_ATTACHMENT_TEXT_CHARS = 500_000;
const MAX_TOTAL_TEXT_CHARS = 1_200_000;

function getFileExtension(fileName: string): string {
  const base = fileName.replace(/[/\\]/g, "").trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[... 텍스트 일부 생략 ...]`;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file("word/document.xml");
  if (!doc) return "";

  const xml = await doc.async("string");
  const paragraphs = xml
    .split(/<\/w:p>/i)
    .map((block) =>
      decodeXmlEntities(block.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  return paragraphs.join("\n");
}

/** PDF 스트림에서 (text) Tj / [..] TJ 연산자 기반 텍스트 추출 */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const parts: string[] = [];

  const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(raw)) !== null) {
    const text = match[1]
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (text.trim()) parts.push(text);
  }

  const tjArrayRegex = /\[((?:[^\]]|\\.)*)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(raw)) !== null) {
    const inner = match[1];
    const segmentRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
    let segment: RegExpExecArray | null;
    while ((segment = segmentRegex.exec(inner)) !== null) {
      const text = segment[1]
        .replace(/\\n/g, "\n")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (text.trim()) parts.push(text);
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** LG엑사원: HWP/HWPX는 PDF 변환 없이 hwpkit(Python)으로 파일 직접 읽기 */
async function extractHwpTextForExaone(
  attachment: SummarizeAttachmentInput,
): Promise<{ text: string | null; error: string | null }> {
  try {
    const raw = await extractHwpTextViaPython(
      attachment.buffer,
      attachment.fileName,
    );
    const enriched = enrichHwpTextForExtraction(raw);
    if (!enriched?.trim()) {
      return { text: null, error: "추출된 텍스트가 없습니다." };
    }
    return { text: enriched, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "HWP 텍스트 추출에 실패했습니다.";
    return { text: null, error: message };
  }
}

async function extractSingleAttachmentText(
  attachment: SummarizeAttachmentInput,
  options?: { exaoneHwpDirect?: boolean },
): Promise<string | null> {
  const ext = getFileExtension(attachment.fileName);

  if (isHwpFileName(attachment.fileName)) {
    if (options?.exaoneHwpDirect) {
      const { text } = await extractHwpTextForExaone(attachment);
      return text;
    }
    try {
      return await extractHwpDocumentText(attachment.buffer, attachment.fileName);
    } catch {
      return null;
    }
  }

  if (ext === ".txt" || attachment.mimeType === "text/plain") {
    return attachment.buffer.toString("utf-8");
  }

  if (ext === ".docx" || attachment.mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      return await extractDocxText(attachment.buffer);
    } catch {
      return null;
    }
  }

  if (ext === ".pdf" || attachment.mimeType === "application/pdf") {
    return extractPdfText(attachment.buffer);
  }

  const plain = await extractAttachmentPlainText(
    attachment.fileName,
    attachment.buffer,
    attachment.mimeType,
  );
  return plain;
}

/** LLM 힌트·후처리용 첨부 텍스트 추출 (HWP/PDF/DOCX/TXT) */
export async function extractAttachmentTextForHints(
  attachment: SummarizeAttachmentInput,
  options?: { exaoneHwpDirect?: boolean },
): Promise<string | null> {
  return extractSingleAttachmentText(attachment, options);
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

export async function collectAttachmentTextsForExaone(
  attachments: SummarizeAttachmentInput[],
  progress?: SummaryProgressContext,
  options?: { maxTotalChars?: number },
): Promise<{
  sections: Array<{ fileName: string; text: string }>;
  skipped: string[];
}> {
  const sections: Array<{ fileName: string; text: string }> = [];
  const skipped: string[] = [];
  let totalChars = 0;
  const maxTotalChars = options?.maxTotalChars ?? MAX_TOTAL_TEXT_CHARS;

  if (progress) {
    setSummaryProgressPhase(progress.userId, progress.noticeId, "extract");
  }

  for (const attachment of attachments) {
    if (isZipFileName(attachment.fileName)) {
      reportAttachmentSkipped(progress, attachment.fileName, "ZIP 파일 제외");
      continue;
    }

    let raw: string | null = null;
    let extractError: string | null = null;

    if (isHwpFileName(attachment.fileName)) {
      const result = await extractHwpTextForExaone(attachment);
      raw = result.text;
      extractError = result.error;
    } else {
      raw = await extractSingleAttachmentText(attachment, {
        exaoneHwpDirect: true,
      });
    }

    if (!raw?.trim()) {
      const detail =
        extractError?.trim() ||
        (isHwpFileName(attachment.fileName)
          ? "텍스트 추출 불가 (py -m pip install hwpkit lxml, .env.local에 HWP_CONVERT_PYTHON 설정 후 dev 서버 재시작)"
          : "텍스트 추출 불가");
      skipped.push(`${attachment.fileName} (${detail})`);
      reportAttachmentSkipped(progress, attachment.fileName, detail);
      continue;
    }

    const cleaned = sanitizeSummaryText(preprocessTextForGemini(raw.trim()));
    const limited = truncateText(cleaned, MAX_ATTACHMENT_TEXT_CHARS);

    if (totalChars + limited.length > maxTotalChars) {
      const remaining = maxTotalChars - totalChars;
      if (remaining <= 0) {
        const detail = "전체 용량 한도 초과";
        skipped.push(`${attachment.fileName} (${detail})`);
        reportAttachmentSkipped(progress, attachment.fileName, detail);
        continue;
      }
      sections.push({
        fileName: attachment.fileName,
        text: truncateText(limited, remaining),
      });
      totalChars = maxTotalChars;
      const detail = "일부 생략";
      skipped.push(`${attachment.fileName} (${detail})`);
      reportAttachmentDone(progress, attachment.fileName);
      continue;
    }

    sections.push({ fileName: attachment.fileName, text: limited });
    totalChars += limited.length;
    reportAttachmentDone(progress, attachment.fileName);
  }

  return { sections, skipped };
}
