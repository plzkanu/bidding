import { PDFDocument } from "pdf-lib";

/**
 * Claude API: 200k 컨텍스트 모델은 요청당 최대 100 PDF 페이지.
 * pdf-lib·Claude 간 페이지 수 차이를 피하기 위해 여유를 둡니다.
 */
export const CLAUDE_MAX_PDF_PAGES_PER_REQUEST = 95;

/** Claude API 전체 요청 크기 경고 기준 (32MB) */
export const CLAUDE_REQUEST_SIZE_WARN_BYTES = 32 * 1024 * 1024;

export interface PdfChunkMeta {
  fileName: string;
  chunkIndex: number;
  chunkCount: number;
  pageCount: number;
  buffer: Buffer;
}

export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const document = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  return document.getPageCount();
}

/** PDF를 100페이지 단위 청크로 분할하고 페이지 수 메타데이터를 포함 */
export async function buildPdfChunksFromBuffer(
  fileName: string,
  pdfBuffer: Buffer,
  chunkSize: number = CLAUDE_MAX_PDF_PAGES_PER_REQUEST,
): Promise<PdfChunkMeta[]> {
  const source = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = source.getPageCount();

  if (totalPages <= chunkSize) {
    const normalized = await PDFDocument.create();
    const pageIndices = Array.from({ length: totalPages }, (_, index) => index);
    const copiedPages = await normalized.copyPages(source, pageIndices);
    for (const page of copiedPages) {
      normalized.addPage(page);
    }

    return [
      {
        fileName,
        chunkIndex: 0,
        chunkCount: 1,
        pageCount: totalPages,
        buffer: Buffer.from(await normalized.save()),
      },
    ];
  }

  const chunkCount = Math.ceil(totalPages / chunkSize);
  const chunks: PdfChunkMeta[] = [];

  for (let start = 0; start < totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPages);
    const pageIndices = Array.from(
      { length: end - start },
      (_, index) => start + index,
    );

    const target = await PDFDocument.create();
    const copiedPages = await target.copyPages(source, pageIndices);
    for (const page of copiedPages) {
      target.addPage(page);
    }

    chunks.push({
      fileName,
      chunkIndex: chunks.length,
      chunkCount,
      pageCount: end - start,
      buffer: Buffer.from(await target.save()),
    });
  }

  return chunks;
}

/** PDF 청크를 요청당 페이지 한도(100) 이하 배치로 묶음 */
export function groupPdfChunksByPageBudget(
  chunks: PdfChunkMeta[],
  maxPagesPerRequest: number = CLAUDE_MAX_PDF_PAGES_PER_REQUEST,
): PdfChunkMeta[][] {
  const batches: PdfChunkMeta[][] = [];
  let current: PdfChunkMeta[] = [];
  let currentPages = 0;

  for (const chunk of chunks) {
    if (
      currentPages + chunk.pageCount > maxPagesPerRequest &&
      current.length > 0
    ) {
      batches.push(current);
      current = [];
      currentPages = 0;
    }

    current.push(chunk);
    currentPages += chunk.pageCount;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

/** API 호출 직전 청크 버퍼의 실제 페이지 수를 재확인 */
export async function verifyPdfChunkPageCounts(
  chunks: PdfChunkMeta[],
): Promise<PdfChunkMeta[]> {
  const verified: PdfChunkMeta[] = [];

  for (const chunk of chunks) {
    const pageCount = await getPdfPageCount(chunk.buffer);
    verified.push({ ...chunk, pageCount });
  }

  return verified;
}

/** Claude 한도에 맞게 청크 페이지 수를 재확인하고 필요 시 재분할 */
export async function normalizePdfChunksForClaude(
  chunks: PdfChunkMeta[],
  maxPages: number = CLAUDE_MAX_PDF_PAGES_PER_REQUEST,
): Promise<PdfChunkMeta[]> {
  const normalized: PdfChunkMeta[] = [];

  for (const chunk of chunks) {
    const [verified] = await verifyPdfChunkPageCounts([chunk]);
    if (!verified) continue;

    if (verified.pageCount <= maxPages) {
      normalized.push(verified);
      continue;
    }

    const resplit = await buildPdfChunksFromBuffer(
      verified.fileName,
      verified.buffer,
      maxPages,
    );
    normalized.push(...(await verifyPdfChunkPageCounts(resplit)));
  }

  return normalized;
}
