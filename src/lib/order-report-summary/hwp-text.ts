import {
  CharCode,
  CharControl,
  CharControls,
  GenShapeObjectControl,
  parse,
  TableControl,
  type Control,
  type HWPChar,
  type Paragraph,
} from "@hwp.js/parser";
import JSZip from "jszip";
import { extractHwpTextViaPython } from "@/lib/order-report-summary/hwp-text-python";
import { preprocessAttachmentTextForHints } from "@/lib/order-report-summary/text-hints";
import { sanitizeSummaryText } from "@/lib/order-report-summary/text-sanitize";

const MAX_HWP_TEXT_CHARS = 500_000;

function getFileExtension(fileName: string): string {
  const base = fileName.replace(/[/\\]/g, "").trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

function charToText(char: HWPChar): string {
  if (char instanceof CharCode) {
    return char.toString();
  }
  if (char instanceof CharControl) {
    switch (char.control) {
      case CharControls.LineBreak:
      case CharControls.ParaBreak:
        return "\n";
      case CharControls.FixedWidthSpace:
      case CharControls.KeepWordSpace:
        return " ";
      default:
        return "";
    }
  }
  return "";
}

function extractParagraphText(paragraph: Paragraph): string {
  const parts: string[] = [];

  for (const char of paragraph.chars) {
    parts.push(charToText(char));
  }

  for (const control of paragraph.controls) {
    parts.push(extractControlText(control));
  }

  return parts.join("");
}

function extractParagraphListText(
  paragraphs: Iterable<Paragraph> & { length: number },
): string {
  const parts: string[] = [];
  for (const paragraph of paragraphs) {
    const text = extractParagraphText(paragraph).trim();
    if (text) {
      parts.push(text);
    }
  }
  return parts.join("\n");
}

/** 표 행을 항목명·값 쌍으로도 출력 (2열 표 대응) */
function formatTableRowPairs(cols: string[]): string[] {
  const trimmed = cols.map((col) => col.trim()).filter(Boolean);
  if (trimmed.length < 2) return [];

  const label = trimmed[0]
    .replace(/^[·ㆍ○●◦\-•*\s]+/, "")
    .replace(/\s*[:：]\s*$/, "")
    .trim();
  const value = trimmed
    .slice(1)
    .join(" ")
    .replace(/^\s*[:：]\s*/, "")
    .trim();

  if (!label || !value) return [];
  return [`${label} : ${value}`];
}

function extractTableText(table: TableControl): string {
  const { rows, cols } = table.record;
  if (rows <= 0 || cols <= 0) {
    return table.cells
      .map((cell) => extractParagraphListText(cell.paragraphs).trim())
      .filter(Boolean)
      .join("\n");
  }

  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ""),
  );

  for (const cell of table.cells) {
    const text = extractParagraphListText(cell.paragraphs)
      .replace(/\n+/g, " ")
      .trim();
    if (!text) continue;

    const row = Math.min(Math.max(cell.row, 0), rows - 1);
    const col = Math.min(Math.max(cell.column, 0), cols - 1);

    if (grid[row][col]) {
      grid[row][col] = `${grid[row][col]} ${text}`;
    } else {
      grid[row][col] = text;
    }

    for (let r = row; r < row + Math.max(cell.rowSpan, 1) && r < rows; r += 1) {
      for (
        let c = col;
        c < col + Math.max(cell.colSpan, 1) && c < cols;
        c += 1
      ) {
        if (r === row && c === col) continue;
        if (!grid[r][c]) {
          grid[r][c] = text;
        }
      }
    }
  }

  const rowLines: string[] = [];
  const pairLines: string[] = [];

  for (const row of grid) {
    if (!row.some((cell) => cell.trim())) continue;

    const tsv = row.join("\t");
    rowLines.push(tsv);
    pairLines.push(...formatTableRowPairs(row));
  }

  return [...rowLines, ...pairLines].join("\n");
}

function extractControlText(control: Control): string {
  if (control instanceof TableControl) {
    return extractTableText(control);
  }

  if (control instanceof GenShapeObjectControl) {
    const parts: string[] = [];
    if (control.drawText) {
      parts.push(extractParagraphListText(control.drawText.paragraphs));
    }
    return parts.filter(Boolean).join("\n");
  }

  return "";
}

function normalizeExtractedHwpText(text: string): string {
  return sanitizeSummaryText(
    text
      .replace(/\u0000/g, "")
      .replace(/\uFEFF/g, "")
      .replace(/[\u200B-\u200D\u2060]/g, "")
      .replace(/\uFFE6/g, "₩")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function extractHwpBinaryText(buffer: Buffer): string {
  const document = parse(new Uint8Array(buffer));
  const sections = document.sections.map((section) =>
    section.paragraphs
      .map((paragraph) => extractParagraphText(paragraph))
      .filter(Boolean)
      .join("\n"),
  );
  return sections.filter(Boolean).join("\n\n");
}

async function extractHwpxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const chunks: string[] = [];

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir || !/\.xml$/i.test(name)) continue;
    const xml = await file.async("string");
    const text = xml
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      chunks.push(text);
    }
  }

  return chunks.join("\n\n");
}

export function isHwpFileName(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return ext === ".hwp" || ext === ".hwpx";
}

export function isZipFileName(fileName: string): boolean {
  return getFileExtension(fileName) === ".zip";
}

/** Gemini·힌트 추출용: HWP 표/글상자 정규화 + 금액 항목 보강 */
export function enrichHwpTextForExtraction(rawText: string): string {
  const normalized = normalizeExtractedHwpText(rawText);
  const enriched = preprocessAttachmentTextForHints(normalized);
  if (enriched.length <= normalized.length) return normalized;

  const suffix = enriched.slice(normalized.length).trim();
  if (!suffix) return normalized;

  return `${normalized}\n\n=== 표·항목 정규화 ===\n${suffix}`;
}

export async function extractHwpDocumentText(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const ext = getFileExtension(fileName);
  let text = "";

  try {
    if (ext === ".hwpx") {
      text = await extractHwpxText(buffer);
    } else {
      text = extractHwpBinaryText(buffer);
    }
  } catch {
    text = "";
  }

  if (!text.trim()) {
    text = await extractHwpTextViaPython(buffer, fileName);
  }

  const normalized = enrichHwpTextForExtraction(text);
  if (!normalized) {
    throw new Error("HWP에서 추출한 텍스트가 없습니다.");
  }

  if (normalized.length > MAX_HWP_TEXT_CHARS) {
    return `${normalized.slice(0, MAX_HWP_TEXT_CHARS)}\n\n[... 텍스트 일부 생략 ...]`;
  }

  return normalized;
}

/** Gemini 힌트·후처리용: HWP/PDF 등에서 추출한 순수 텍스트 */
export async function extractAttachmentPlainText(
  fileName: string,
  buffer: Buffer,
  mimeType: string | null,
): Promise<string | null> {
  if (isHwpFileName(fileName)) {
    try {
      return await extractHwpDocumentText(buffer, fileName);
    } catch {
      return null;
    }
  }

  const ext = getFileExtension(fileName);
  if (ext === ".txt" || mimeType === "text/plain") {
    return preprocessAttachmentTextForHints(buffer.toString("utf8"));
  }

  return null;
}
