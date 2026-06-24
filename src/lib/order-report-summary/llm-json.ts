/** LLM이 반환한 텍스트에서 JSON 객체 추출·파싱 */

function stripMarkdownFence(text: string): string {
  return text
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();
}

function extractJsonObjectCandidate(text: string): string {
  const trimmed = stripMarkdownFence(text);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

/** 잘린 JSON 끝을 닫아 복구 시도 */
function closeTruncatedJson(candidate: string): string {
  let text = candidate.trim();
  if (!text) return text;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      const expected = stack.pop();
      if (expected !== ch) {
        break;
      }
    }
  }

  if (inString) {
    text += '"';
  }

  while (stack.length > 0) {
    text += stack.pop();
  }

  return text;
}

export function parseLlmJsonResponse(text: string): unknown {
  const candidates = [
    stripMarkdownFence(text),
    extractJsonObjectCandidate(text),
    closeTruncatedJson(extractJsonObjectCandidate(text)),
  ];

  const unique = [...new Set(candidates.filter(Boolean))];
  let lastError: Error | null = null;

  for (const candidate of unique) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("JSON 파싱에 실패했습니다.");
}
