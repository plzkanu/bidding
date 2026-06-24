/** 요약 JSON·DOCX·UI 표시용 텍스트 정리 */

/** XML 1.0에서 허용되지 않는 문자(탭·LF·CR 제외) */
const INVALID_XML_CHAR =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u0084\u0086-\u009F]/g;

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;

function decodeLiteralEscapes(text: string): string {
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ");
}

/** 요약 필드 공통 정리 */
export function sanitizeSummaryText(text: string): string {
  if (!text) return text;

  let result = text.normalize("NFC");
  result = result.replace(/\r\n?/g, "\n");
  result = result.replace(INVALID_XML_CHAR, "");
  result = result.replace(ZERO_WIDTH, "");
  result = result.replace(/\u00A0/g, " ");
  result = result.replace(/\t/g, " ");
  result = decodeLiteralEscapes(result);

  return result;
}

/** 줄바꿈이 포함될 수 있는 필드(신청자격.기준, 공사개요.비고 등) */
export function sanitizeMultilineSummaryText(text: string): string {
  const cleaned = sanitizeSummaryText(text);
  return cleaned
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
