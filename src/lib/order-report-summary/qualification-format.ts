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

const QUALIFICATION_CATEGORY_ORDER = [
  "면허·등록",
  "면허",
  "실적",
  "기업규모",
  "유자격",
  "지역제한",
  "PQ·서류",
  "신인도",
  "공동·하도급",
  "참가제한",
];

const OTHER_DROP_PATTERNS = [
  /시스템.{0,24}(이용|사용|등록|장애|문의)/u,
  /이용자\s*안내/u,
  /장애\s*문의/u,
  /문의(?:는|처|처로)/u,
  /미숙지/u,
  /불이익은?\s*(입찰자|응찰자|본인)/u,
  /책임은?\s*(입찰자|응찰자|본인)/u,
  /참고\s*(하시기|바람)/u,
];

const OTHER_RESTRICTION_PATTERNS = [
  /담합/u,
  /공정거래/u,
  /조세\s*포탈/u,
  /세금\s*포탈/u,
  /포탈\s*세액/u,
  /해외\s*금융\s*계좌/u,
  /입찰\s*참가\s*정지/u,
  /입찰\s*참가\s*제한/u,
  /계약\s*(해지|취소)/u,
  /손해\s*배상/u,
  /영구\s*(배제|퇴출)/u,
  /윤리.{0,16}(위반|제\s*15)/u,
  /관세법/u,
  /지방세기본법/u,
  /외국환거래법/u,
  /면탈/u,
  /환급받은\s*세액/u,
  /자본거래/u,
  /신고의무를?\s*위반/u,
];

const OTHER_CONDENSE_RULES: ReadonlyArray<{ test: RegExp; line: string }> = [
  { test: /등록\s*마감/u, line: "입찰참가 등록마감일 기준 자격 충족" },
  { test: /공인인증서/u, line: "나라장터 입찰 시 공인인증서 필요" },
  {
    test: /나라장터|전자상거래|물품공급업체/u,
    line: "나라장터·한수원 전자상거래 사전 등록(2~4일 소요)",
  },
  { test: /추가\s*서류|마감\s*후/u, line: "마감 후 추가서류 제출 불가" },
  {
    test: /완납|4대\s*보험|국민연금|건강보험/u,
    line: "대금 청구 시 4대보험·국세·지방세 완납증명 제출",
  },
  {
    test: /인지세/u,
    line: "낙찰 시 인지세 납부(홈택스), 세액 50% 환급",
  },
  {
    test: /윤리\s*행동\s*강령|윤리행동강령/u,
    line: "윤리행동강령 준수서약서 제출 및 준수",
  },
];

export function isOtherQualificationCategory(label: string): boolean {
  return /기타/.test(label.replace(/\s+/g, ""));
}

function isRestrictionQualificationCategory(label: string): boolean {
  return /참가\s*제한|참여\s*제한|결격/.test(label);
}

function normalizeCategoryKey(label: string): string {
  return label.replace(/[\s·\-]/g, "");
}

function categoryOrderIndex(label: string): number {
  if (isOtherQualificationCategory(label)) return 10_000;
  const key = normalizeCategoryKey(label);
  const index = QUALIFICATION_CATEGORY_ORDER.findIndex((item) => {
    const itemKey = normalizeCategoryKey(item);
    return key === itemKey || key.includes(itemKey) || itemKey.includes(key);
  });
  return index >= 0 ? index : 5_000;
}

function hangulCount(text: string): number {
  return text.match(/[가-힣]/gu)?.length ?? 0;
}

function isDateOrAmendmentNoise(item: string): boolean {
  const compact = item.replace(/\s+/g, "");
  const hangul = hangulCount(item);
  if (hangul <= 4 && /\d{4}/.test(item) && /개정|년|월/.test(item)) {
    return true;
  }
  if (/^\(?\d{1,2}\.?,?\s*\d{4}/.test(item) && hangul <= 4) {
    return true;
  }
  if (/개정\)?\s*$/.test(compact) && hangul <= 4) {
    return true;
  }
  if (/^\(?\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}/.test(item) && hangul <= 6) {
    return true;
  }
  return false;
}

function isLowValueOtherItem(item: string): boolean {
  if (isDateOrAmendmentNoise(item)) return true;
  return hangulCount(item) < 8;
}

function isRestrictionLikeOtherItem(item: string): boolean {
  return OTHER_RESTRICTION_PATTERNS.some((pattern) => pattern.test(item));
}

function condenseRestrictionItem(item: string): string {
  if (/담합/.test(item)) {
    return "담합 인정 시 입찰제한·계약해지·손해배상";
  }
  if (
    /조세\s*포탈|세금\s*포탈|해외\s*금융|관세법|지방세기본법|외국환거래법|면탈|포탈\s*세액|자본거래/.test(
      item,
    )
  ) {
    return "세금 포탈·관세 면탈·해외금융계좌 미신고(5억원 이상) 배제";
  }
  return item;
}

function condenseOtherItem(item: string): string | null {
  if (isDateOrAmendmentNoise(item) || isRestrictionLikeOtherItem(item)) {
    return null;
  }
  for (const rule of OTHER_CONDENSE_RULES) {
    if (rule.test.test(item)) return rule.line;
  }
  if (OTHER_DROP_PATTERNS.some((pattern) => pattern.test(item))) {
    return null;
  }
  if (isLowValueOtherItem(item)) {
    return null;
  }
  return item;
}

export function sortQualificationRows<T extends { 구분: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const diff = categoryOrderIndex(a.구분) - categoryOrderIndex(b.구분);
    if (diff !== 0) return diff;
    return a.구분.localeCompare(b.구분, "ko");
  });
}

/** 기타를 맨 아래로 두고, 기타 항목은 실무 유의사항만 짧게 남김 */
export function sortAndRefineQualificationRows<
  T extends { 구분: string; 기준: string },
>(rows: T[]): T[] {
  const byCategory = new Map<string, { 구분: string; items: string[] }>();
  const restrictionItems: string[] = [];
  let restrictionLabel = "참가제한";
  const otherItems: string[] = [];

  for (const row of rows) {
    const items = splitQualificationItems(row.기준);
    if (items.length === 0) continue;

    if (isOtherQualificationCategory(row.구분)) {
      for (const item of items) {
        if (isRestrictionLikeOtherItem(item)) {
          restrictionItems.push(condenseRestrictionItem(item));
          continue;
        }
        const condensed = condenseOtherItem(item);
        if (condensed) otherItems.push(condensed);
      }
      continue;
    }

    if (isRestrictionQualificationCategory(row.구분)) {
      restrictionLabel = row.구분;
      for (const item of items) {
        if (isDateOrAmendmentNoise(item)) continue;
        restrictionItems.push(
          isRestrictionLikeOtherItem(item)
            ? condenseRestrictionItem(item)
            : item,
        );
      }
      continue;
    }

    const existing = byCategory.get(row.구분);
    if (existing) {
      existing.items.push(...items);
    } else {
      byCategory.set(row.구분, { 구분: row.구분, items: [...items] });
    }
  }

  const result: T[] = [...byCategory.values()].map((entry) => ({
    ...({} as T),
    구분: entry.구분,
    기준: dedupeItems(entry.items).join("\n"),
  }));

  const uniqueRestrictions = dedupeItems(restrictionItems);
  if (uniqueRestrictions.length > 0) {
    result.push({
      ...({} as T),
      구분: restrictionLabel,
      기준: uniqueRestrictions.join("\n"),
    } as T);
  }

  const uniqueOther = dedupeItems(otherItems);
  if (uniqueOther.length > 0) {
    result.push({
      ...({} as T),
      구분: "기타",
      기준: uniqueOther.join("\n"),
    } as T);
  }

  return sortQualificationRows(result);
}
