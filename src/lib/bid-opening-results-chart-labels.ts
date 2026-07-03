import { formatChartRateLabel } from "@/lib/bid-opening-results-chart";

export interface ChartLabelInput {
  id: string;
  x: number;
  anchorY: number;
  value: number;
  color: string;
  preferredPlacement: "above" | "below";
  priority: number;
}

export interface ChartLabelLayout {
  id: string;
  x: number;
  value: number;
  color: string;
  rectX: number;
  rectY: number;
  width: number;
  height: number;
  visible: boolean;
}

const LABEL_HEIGHT = 22;
const LABEL_PADDING_X = 16;
const CHAR_WIDTH = 7.2;
const COLLISION_PADDING = 3;

function measureLabelWidth(value: number): number {
  return formatChartRateLabel(value).length * CHAR_WIDTH + LABEL_PADDING_X;
}

function boxesOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  return !(
    a.right + COLLISION_PADDING <= b.left ||
    a.left >= b.right + COLLISION_PADDING ||
    a.bottom + COLLISION_PADDING <= b.top ||
    a.top >= b.bottom + COLLISION_PADDING
  );
}

/** 데이터 포인트 수·시리즈 수에 따라 정적 라벨 표시 여부 */
export function shouldShowValueLabelsByDefault(
  pointCount: number,
  seriesCount: number,
): boolean {
  return pointCount * seriesCount <= 20;
}

/** 포인트가 많을 때 표시할 x 인덱스 (전체 또는 간격 두기) */
export function getVisibleLabelIndices(
  pointCount: number,
  forceAll: boolean,
): Set<number> {
  if (forceAll || pointCount <= 10) {
    return new Set(Array.from({ length: pointCount }, (_, i) => i));
  }
  if (pointCount <= 18) {
    return new Set(
      Array.from({ length: pointCount }, (_, i) => i).filter(
        (i) => i === 0 || i === pointCount - 1 || i % 2 === 0,
      ),
    );
  }
  const step = Math.max(2, Math.ceil(pointCount / 10));
  const indices = new Set<number>([0, pointCount - 1]);
  for (let i = 0; i < pointCount; i += step) {
    indices.add(i);
  }
  return indices;
}

/** x축 눈금 — 겹침 방지를 위해 일부만 표시 */
export function getVisibleXAxisIndices(pointCount: number): Set<number> {
  if (pointCount <= 16) {
    return new Set(Array.from({ length: pointCount }, (_, i) => i));
  }
  if (pointCount <= 30) {
    return new Set(
      Array.from({ length: pointCount }, (_, i) => i).filter(
        (i) => i === 0 || i === pointCount - 1 || i % 2 === 1,
      ),
    );
  }
  const step = Math.max(2, Math.ceil(pointCount / 14));
  const indices = new Set<number>([0, pointCount - 1]);
  for (let i = 0; i < pointCount; i += step) {
    indices.add(i);
  }
  return indices;
}

export function layoutChartDataLabels(
  inputs: ChartLabelInput[],
  plotBounds: { width: number; height: number },
): ChartLabelLayout[] {
  const sorted = [...inputs].sort(
    (a, b) => a.x - b.x || a.priority - b.priority,
  );
  const placed: ChartLabelLayout[] = [];
  const occupied: Array<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  }> = [];

  for (const input of sorted) {
    const width = measureLabelWidth(input.value);
    const height = LABEL_HEIGHT;
    const offsets = buildPlacementOffsets(input.preferredPlacement);
    let chosen: ChartLabelLayout | null = null;

    for (const offset of offsets) {
      const rectY =
        input.preferredPlacement === "above"
          ? input.anchorY - height - 10 + offset
          : input.anchorY + 10 + offset;
      const rectX = input.x - width / 2;
      const box = {
        left: rectX,
        right: rectX + width,
        top: rectY,
        bottom: rectY + height,
      };

      if (box.left < -4 || box.right > plotBounds.width + 4) continue;
      if (box.top < -4 || box.bottom > plotBounds.height + 4) continue;

      const collides = occupied.some((other) => boxesOverlap(box, other));
      if (!collides) {
        chosen = {
          id: input.id,
          x: input.x,
          value: input.value,
          color: input.color,
          rectX,
          rectY,
          width,
          height,
          visible: true,
        };
        occupied.push(box);
        break;
      }
    }

    placed.push(
      chosen ?? {
        id: input.id,
        x: input.x,
        value: input.value,
        color: input.color,
        rectX: input.x - width / 2,
        rectY:
          input.preferredPlacement === "above"
            ? input.anchorY - height - 10
            : input.anchorY + 10,
        width,
        height,
        visible: false,
      },
    );
  }

  return placed;
}

function buildPlacementOffsets(preferred: "above" | "below"): number[] {
  const steps = [0, -28, 28, -56, 56, -84, 84, -112, 112];
  if (preferred === "below") {
    return steps;
  }
  return steps.map((step) => -step);
}
