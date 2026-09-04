/** 입찰참가자격 기준을 항목 단위로 나누어 스캔하기 쉽게 정리 */

const ITEM_MARKER =
  /(?:\((?:가|나|다|라|마|바|사|아|자|차|카|타|파|하)\)\s*|(?:가|나|다|라|마|바|사|아|자|차|카|타|파|하)\.\s*|(?<!\d)\d{1,2}[\.)]\s+|[●○◦·ㆍ•※]\s+)/u;

const LEADING_MARKER = new RegExp(`^${ITEM_MARKER.source}`, "u");

const INLINE_ITEM_SPLIT = new RegExp(`(?<=\\S)\\s+(?=${ITEM_MARKER.source})`, "u");

const BOILERPLATE_LINE = [
  /^다음(?:의|에\s*해당하는)?\s*(?:각\s*호|요건|자격)/u,
  /^입찰에?\s*참가하고자\s*하는\s*자/u,
  /자격을?\s*(?:갖추|충족)(?:어야|해야)\s*한다\.?$/u,
  /^아래의?\s*(?:각\s*호|요건|자격)을?\s*갖춘\s*자/u,
];

const BOILERPLATE_PREFIX =
  /^(?:입찰에?\s*참가하고자\s*하는\s*자는?\s*)?(?:다음(?:의|에\s*해당하는)?\s*(?:각\s*호|요건|자격)[^.。]*다\.?\s*)+/u;

function stripItemMarker(line: string): string {
  return line.replace(LEADING_MARKER, "").trim();
}

function isBoilerplateLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (
    trimmed.length > 40 &&
    /(면허|등록|실적|제한|하도급|공동|PQ|대기업|중소|관내|금액|억원)/u.test(
      trimmed,
    )
  ) {
    return false;
  }
  return BOILERPLATE_LINE.some((pattern) => pattern.test(trimmed));
}

function cleanItemLine(line: string): string {
  let result = stripItemMarker(line)
    .replace(BOILERPLATE_PREFIX, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  result = stripItemMarker(result);
  return result;
}

function splitParagraphIntoItems(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(INLINE_ITEM_SPLIT)
    .map((part) => cleanItemLine(part))
    .filter(Boolean);

  return parts.length > 0 ? parts : [cleanItemLine(trimmed)].filter(Boolean);
}

function dedupeItems(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const key = item.replace(/\s+/g, "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

/** 신청자격.기준을 한 조건당 한 줄의 항목 배열로 변환 */
export function splitQualificationItems(text: string): string[] {
  if (!text.trim()) return [];

  const items: string[] = [];
  for (const paragraph of text.split(/\r?\n/u)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    items.push(...splitParagraphIntoItems(trimmed));
  }

  return dedupeItems(items.filter((item) => !isBoilerplateLine(item)));
}

/** 저장·후처리용: 항목을 줄바꿈으로 다시 합침 */
export function formatQualificationCriteria(text: string): string {
  const items = splitQualificationItems(text);
  return items.length > 0 ? items.join("\n") : text.trim();
}
