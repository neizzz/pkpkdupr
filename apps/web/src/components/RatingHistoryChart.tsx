import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  type Plugin,
  type ScriptableContext,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { MemberProfileRatingHistoryPoint } from "@/components/MemberProfile";

ChartJS.register(
  Filler,
  LinearScale,
  LineElement,
  PointElement,
);

interface RatingHistoryChartProps {
  history: MemberProfileRatingHistoryPoint[];
  label: string;
}

const datePartsFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

const getDateParts = (value: Date) =>
  Object.fromEntries(
    datePartsFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

const isToday = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const dateParts = getDateParts(date);
  const todayParts = getDateParts(new Date());

  return (
    dateParts.year === todayParts.year &&
    dateParts.month === todayParts.month &&
    dateParts.day === todayParts.day
  );
};

const formatDate = (value: string) => {
  if (isToday(value)) return "오늘";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const dateParts = getDateParts(date);

  return `${dateParts.month}.${dateParts.day}`;
};

const getKoreaDateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const dateParts = getDateParts(date);
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};

const accentColor = "#eaff19"; // --color-pkpk-accent-bg
const CHART_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const CHART_LABEL_HORIZONTAL_PADDING_PX = 18;
const CHART_LABEL_RIGHT_PADDING_PX = 28;
const CHART_RATING_LABEL_FONT = "700 11px sans-serif";
const CHART_DATE_LABEL_FONT = "600 11px sans-serif";
const CHART_RATING_LABEL_MARGIN_PX = 2;
const CHART_RATING_LABEL_HEIGHT_PX = 13;
const CHART_LINE_CLEARANCE_PX = 3;
const CHART_POINT_CLEARANCE_PX = 5;
const CHART_GUIDE_CLEARANCE_PX = 2;
const CHART_CURVE_SAMPLE_COUNT = 24;

type RatingLabelKind = "maximum" | "minimum" | "today";

interface ChartPoint {
  x: number;
  y: number;
}

interface MonotoneChartPoint extends ChartPoint {
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
}

interface LineSegment {
  start: ChartPoint;
  end: ChartPoint;
}

interface LabelRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface RatingLabelTarget {
  index: number;
  kind: RatingLabelKind;
  isToday: boolean;
}

interface RatingLabelPlacement extends LabelRect {
  centerX: number;
  centerY: number;
}

const isChartPoint = (point: unknown): point is MonotoneChartPoint =>
  typeof point === "object" &&
  point != null &&
  Number.isFinite((point as ChartPoint).x) &&
  Number.isFinite((point as ChartPoint).y);

const rectanglesOverlap = (left: LabelRect, right: LabelRect) =>
  left.left < right.right &&
  left.right > right.left &&
  left.top < right.bottom &&
  left.bottom > right.top;

const getPointObstacle = (point: ChartPoint): LabelRect => ({
  left: point.x - CHART_POINT_CLEARANCE_PX,
  right: point.x + CHART_POINT_CLEARANCE_PX,
  top: point.y - CHART_POINT_CLEARANCE_PX,
  bottom: point.y + CHART_POINT_CLEARANCE_PX,
});

const getFiniteCoordinate = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? value ?? fallback : fallback;

const getMonotoneCurvePoint = (
  start: MonotoneChartPoint,
  end: MonotoneChartPoint,
  progress: number,
): ChartPoint => {
  const startControlX = getFiniteCoordinate(start.cp2x, start.x);
  const startControlY = getFiniteCoordinate(start.cp2y, start.y);
  const endControlX = getFiniteCoordinate(end.cp1x, end.x);
  const endControlY = getFiniteCoordinate(end.cp1y, end.y);
  const remaining = 1 - progress;

  return {
    x:
      remaining ** 3 * start.x +
      3 * remaining ** 2 * progress * startControlX +
      3 * remaining * progress ** 2 * endControlX +
      progress ** 3 * end.x,
    y:
      remaining ** 3 * start.y +
      3 * remaining ** 2 * progress * startControlY +
      3 * remaining * progress ** 2 * endControlY +
      progress ** 3 * end.y,
  };
};

const getMonotoneCurveSegments = (
  points: Array<MonotoneChartPoint | undefined>,
): LineSegment[] => {
  const segments: LineSegment[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;

    let previous = start;
    for (let sample = 1; sample <= CHART_CURVE_SAMPLE_COUNT; sample += 1) {
      const current = getMonotoneCurvePoint(
        start,
        end,
        sample / CHART_CURVE_SAMPLE_COUNT,
      );
      segments.push({ start: previous, end: current });
      previous = current;
    }
  }

  return segments;
};

const expandRect = (rect: LabelRect, amount: number): LabelRect => ({
  left: rect.left - amount,
  right: rect.right + amount,
  top: rect.top - amount,
  bottom: rect.bottom + amount,
});

const isPointInsideRect = (point: ChartPoint, rect: LabelRect) =>
  point.x >= rect.left &&
  point.x <= rect.right &&
  point.y >= rect.top &&
  point.y <= rect.bottom;

const getCrossProduct = (
  origin: ChartPoint,
  first: ChartPoint,
  second: ChartPoint,
) =>
  (first.x - origin.x) * (second.y - origin.y) -
  (first.y - origin.y) * (second.x - origin.x);

const isPointOnSegment = (
  point: ChartPoint,
  start: ChartPoint,
  end: ChartPoint,
) =>
  point.x >= Math.min(start.x, end.x) &&
  point.x <= Math.max(start.x, end.x) &&
  point.y >= Math.min(start.y, end.y) &&
  point.y <= Math.max(start.y, end.y);

const lineSegmentsIntersect = (first: LineSegment, second: LineSegment) => {
  const firstStart = getCrossProduct(first.start, first.end, second.start);
  const firstEnd = getCrossProduct(first.start, first.end, second.end);
  const secondStart = getCrossProduct(second.start, second.end, first.start);
  const secondEnd = getCrossProduct(second.start, second.end, first.end);

  if (
    (firstStart === 0 && isPointOnSegment(second.start, first.start, first.end)) ||
    (firstEnd === 0 && isPointOnSegment(second.end, first.start, first.end)) ||
    (secondStart === 0 && isPointOnSegment(first.start, second.start, second.end)) ||
    (secondEnd === 0 && isPointOnSegment(first.end, second.start, second.end))
  ) {
    return true;
  }

  return (
    (firstStart < 0) !== (firstEnd < 0) &&
    (secondStart < 0) !== (secondEnd < 0)
  );
};

const lineSegmentIntersectsRect = (segment: LineSegment, rect: LabelRect) => {
  if (isPointInsideRect(segment.start, rect) || isPointInsideRect(segment.end, rect)) {
    return true;
  }

  const topLeft = { x: rect.left, y: rect.top };
  const topRight = { x: rect.right, y: rect.top };
  const bottomRight = { x: rect.right, y: rect.bottom };
  const bottomLeft = { x: rect.left, y: rect.bottom };

  return [
    { start: topLeft, end: topRight },
    { start: topRight, end: bottomRight },
    { start: bottomRight, end: bottomLeft },
    { start: bottomLeft, end: topLeft },
  ].some((edge) => lineSegmentsIntersect(segment, edge));
};

const getRatingLabelPlacement = (
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
): RatingLabelPlacement => {
  const width =
    ctx.measureText(text).width + CHART_RATING_LABEL_MARGIN_PX * 2;
  const height = CHART_RATING_LABEL_HEIGHT_PX + CHART_RATING_LABEL_MARGIN_PX * 2;

  return {
    centerX,
    centerY,
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
  };
};

const getRatingLabelCandidateOffsets = (
  kind: RatingLabelKind,
  isTodayPoint: boolean,
  point: ChartPoint,
  chartArea: { left: number; right: number; top: number; bottom: number },
) => {
  // 오늘 점은 극값과 겹치더라도 수치의 중심을 점의 중심에 맞춘다. 아래쪽은
  // 날짜 가이드선과 충돌하기 쉬우므로 위쪽 후보를 우선한다.
  if (isTodayPoint) {
    return [
      [0, -15],
      [0, -27],
      [0, 15],
      [0, 27],
    ] satisfies Array<[number, number]>;
  }

  const inwardDirection =
    point.x <= (chartArea.left + chartArea.right) / 2 ? 1 : -1;
  const topCandidates: Array<[number, number]> = [
    [0, -15],
    [inwardDirection * 20, -14],
    [-inwardDirection * 20, -14],
    [inwardDirection * 28, -22],
    [-inwardDirection * 28, -22],
    [0, -27],
    [inwardDirection * 22, 0],
    [-inwardDirection * 22, 0],
    [inwardDirection * 32, -6],
    [-inwardDirection * 32, -6],
    [inwardDirection * 20, 14],
    [-inwardDirection * 20, 14],
  ];
  const bottomCandidates: Array<[number, number]> = [
    [inwardDirection * 20, 14],
    [-inwardDirection * 20, 14],
    [inwardDirection * 28, 22],
    [-inwardDirection * 28, 22],
    [0, 27],
    [inwardDirection * 22, 0],
    [-inwardDirection * 22, 0],
    [inwardDirection * 32, 6],
    [-inwardDirection * 32, 6],
    [0, 15],
    [inwardDirection * 20, -14],
    [-inwardDirection * 20, -14],
  ];

  if (kind === "maximum") return topCandidates;
  if (kind === "minimum") return bottomCandidates;

  return point.y <= (chartArea.top + chartArea.bottom) / 2
    ? topCandidates
    : bottomCandidates;
};

const getTodayPointIndex = (
  history: MemberProfileRatingHistoryPoint[],
) => {
  const latestTodayIndex = history.reduce(
    (latestIndex, point, index) =>
      isToday(point.createdAt) ? index : latestIndex,
    -1,
  );

  // RatingHistoryChart는 현재 평점을 끝점으로 보정한다. projection 압축으로
  // source 또는 날짜 판별이 남지 않아도 끝점은 오늘의 강조 점으로 유지한다.
  return latestTodayIndex >= 0 ? latestTodayIndex : history.length - 1;
};

const getRatingLabelTargets = (
  history: MemberProfileRatingHistoryPoint[],
): RatingLabelTarget[] => {
  if (history.length === 0) return [];

  const values = history.map((point) => point.rating);
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  const todayCurrentIndex = getTodayPointIndex(history);
  const getExtremumIndex = (rating: number) =>
    todayCurrentIndex >= 0 && values[todayCurrentIndex] === rating
      ? todayCurrentIndex
      : values.indexOf(rating);
  const targets = new Map<number, RatingLabelKind>();

  if (maximum === minimum) {
    targets.set(getExtremumIndex(maximum), "maximum");
  } else {
    targets.set(getExtremumIndex(maximum), "maximum");
    targets.set(getExtremumIndex(minimum), "minimum");
  }

  if (todayCurrentIndex >= 0 && !targets.has(todayCurrentIndex)) {
    targets.set(todayCurrentIndex, "today");
  }

  const priority: Record<RatingLabelKind, number> = {
    maximum: 0,
    minimum: 1,
    today: 2,
  };
  return [...targets]
    .map(([index, kind]) => ({
      index,
      kind,
      isToday: index === todayCurrentIndex,
    }))
    .sort((left, right) => priority[left.kind] - priority[right.kind]);
};

const isInsideLabelBounds = (rect: LabelRect, bounds: LabelRect) =>
  rect.left >= bounds.left &&
  rect.right <= bounds.right &&
  rect.top >= bounds.top &&
  rect.bottom <= bounds.bottom;

const getRatingLabelCollisionScore = (
  placement: RatingLabelPlacement,
  bounds: LabelRect,
  points: Array<ChartPoint | undefined>,
  lineSegments: LineSegment[],
  guideRects: LabelRect[],
  dateLabelRects: LabelRect[],
  placedLabelRects: LabelRect[],
) => {
  if (!isInsideLabelBounds(placement, bounds)) return Number.POSITIVE_INFINITY;

  let score = 0;
  for (const point of points) {
    if (!point) continue;
    if (rectanglesOverlap(placement, getPointObstacle(point))) score += 24;
  }
  for (const segment of lineSegments) {
    if (
      lineSegmentIntersectsRect(
        segment,
        expandRect(placement, CHART_LINE_CLEARANCE_PX),
      )
    ) {
      score += 8;
    }
  }
  for (const guide of guideRects) {
    if (rectanglesOverlap(placement, guide)) score += 16;
  }
  for (const dateLabel of dateLabelRects) {
    if (rectanglesOverlap(placement, dateLabel)) score += 24;
  }
  for (const label of placedLabelRects) {
    if (rectanglesOverlap(placement, label)) score += 100;
  }

  return score;
};

const layoutRatingLabels = (
  ctx: CanvasRenderingContext2D,
  chart: { width: number; chartArea: LabelRect },
  points: Array<MonotoneChartPoint | undefined>,
  pointIndexes: Set<number>,
  dateLabelRects: LabelRect[],
  targets: RatingLabelTarget[],
  labelTexts: Map<number, string>,
) => {
  const lineSegments = getMonotoneCurveSegments(points);
  const guideRects = [...pointIndexes].flatMap((index) => {
    const point = points[index];
    if (!point) return [];
    return [
      {
        left: point.x - CHART_GUIDE_CLEARANCE_PX,
        right: point.x + CHART_GUIDE_CLEARANCE_PX,
        top: point.y,
        bottom: chart.chartArea.bottom,
      },
    ];
  });
  const bounds: LabelRect = {
    left: CHART_RATING_LABEL_MARGIN_PX,
    right: chart.width - CHART_RATING_LABEL_MARGIN_PX,
    top: CHART_RATING_LABEL_MARGIN_PX,
    bottom: chart.chartArea.bottom + 4,
  };
  const placedLabelRects: LabelRect[] = [];
  const placements = new Map<number, RatingLabelPlacement>();

  for (const target of targets) {
    const point = points[target.index];
    const text = labelTexts.get(target.index);
    if (!point || !text) continue;

    const candidates = getRatingLabelCandidateOffsets(
      target.kind,
      target.isToday,
      point,
      chart.chartArea,
    ).map(([offsetX, offsetY]) =>
      getRatingLabelPlacement(ctx, text, point.x + offsetX, point.y + offsetY),
    );
    const scoredCandidates = candidates.map((placement) => ({
      placement,
      score: getRatingLabelCollisionScore(
        placement,
        bounds,
        points,
        lineSegments,
        guideRects,
        dateLabelRects,
        placedLabelRects,
      ),
    }));
    const collisionFree = scoredCandidates.find(({ score }) => score === 0);
    // 최고·최저도 충돌 위치로 물러서지 않는다. 위·아래 여백과 추가 대각선
    // 후보 안에서 실제 곡선과 분리된 위치만 표시한다.
    if (!collisionFree) continue;

    placements.set(target.index, collisionFree.placement);
    placedLabelRects.push(collisionFree.placement);
  }

  return placements;
};

const getHighlightedPointIndexes = (
  pointIndexes: Set<number>,
  pointCount: number,
) => {
  const indexes = new Set(pointIndexes);
  // 현재 평점은 항상 chartValues의 끝점이다. decoration plugin이 이전 props를
  // 유지하는 렌더 주기에도 이 점은 반드시 강조한다.
  if (pointCount > 0) indexes.add(pointCount - 1);
  return indexes;
};

const createAreaGradient = (context: ScriptableContext<"line">) => {
  const { chart } = context;
  const { chartArea } = chart;
  if (!chartArea) return "rgba(234, 255, 25, 0.22)";

  const gradient = chart.ctx.createLinearGradient(
    0,
    chartArea.top,
    0,
    chartArea.bottom,
  );
  gradient.addColorStop(0, "rgba(234, 255, 25, 0.32)");
  gradient.addColorStop(1, "rgba(234, 255, 25, 0)");
  return gradient;
};

const createChartDecorationPlugin = (
  pointIndexes: Set<number>,
  dateLabels: Map<number, string>,
  ratingLabelTargets: RatingLabelTarget[],
  ratingLabelTexts: Map<number, string>,
): Plugin<"line"> => ({
  id: "ratingHistoryChartDecorations",
  afterDatasetDraw(chart, args) {
    if (args.index !== 0) return;

    const { ctx, chartArea } = chart;
    const datasetMeta = chart.getDatasetMeta(args.index);
    const edgeFade = ctx.createLinearGradient(
      chartArea.left,
      0,
      chartArea.right,
      0,
    );
    edgeFade.addColorStop(0, "rgba(0, 0, 0, 0)");
    edgeFade.addColorStop(0.08, "rgba(0, 0, 0, 1)");
    edgeFade.addColorStop(0.92, "rgba(0, 0, 0, 1)");
    edgeFade.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      chartArea.left,
      chartArea.top,
      chartArea.right - chartArea.left,
      chartArea.bottom - chartArea.top,
    );
    ctx.clip();
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = edgeFade;
    ctx.fillRect(
      chartArea.left,
      chartArea.top,
      chartArea.right - chartArea.left,
      chartArea.bottom - chartArea.top,
    );
    ctx.restore();

    const line = datasetMeta.dataset as
      | {
          options: { fill: boolean | string };
          draw: (context: CanvasRenderingContext2D) => void;
        }
      | undefined;
    if (!line) return;

    const previousFill = line.options.fill;
    line.options.fill = false;
    line.draw(ctx);
    line.options.fill = previousFill;
  },
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const points = chart.getDatasetMeta(0).data;
    const highlightedPointIndexes = getHighlightedPointIndexes(
      pointIndexes,
      points.length,
    );
    const chartPoints = points.map((point) =>
      isChartPoint(point) ? point : undefined,
    );

    ctx.save();
    ctx.strokeStyle = "rgba(234, 255, 25, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    for (const index of highlightedPointIndexes) {
      const point = points[index];
      if (!point) continue;

      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x, chartArea.bottom);
      ctx.stroke();
    }

    ctx.fillStyle = accentColor;
    ctx.font = CHART_DATE_LABEL_FONT;
    ctx.textBaseline = "top";
    const dateLabelRects: LabelRect[] = [];
    const labelsToDraw = new Map(dateLabels);
    if (points.length > 0) labelsToDraw.set(points.length - 1, "오늘");
    for (const [index, dateLabel] of labelsToDraw) {
      const point = points[index];
      if (!point) continue;

      ctx.textAlign = "center";
      ctx.fillText(dateLabel, point.x, chartArea.bottom + 8);
      const width = ctx.measureText(dateLabel).width;
      dateLabelRects.push({
        left: point.x - width / 2,
        right: point.x + width / 2,
        top: chartArea.bottom + 8,
        bottom: chartArea.bottom + 8 + CHART_RATING_LABEL_HEIGHT_PX,
      });
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = accentColor;
    ctx.font = CHART_RATING_LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const placements = layoutRatingLabels(
      ctx,
      chart,
      chartPoints,
      highlightedPointIndexes,
      dateLabelRects,
      ratingLabelTargets,
      ratingLabelTexts,
    );
    for (const [index, placement] of placements) {
      const text = ratingLabelTexts.get(index);
      if (!text) continue;
      ctx.fillText(text, placement.centerX, placement.centerY);
    }
    ctx.restore();

    // 가이드선과 라벨을 모두 그린 뒤 강조 점을 다시 올려, Chart.js의
    // pointRadius 캐시나 후속 canvas draw에 오늘 끝점이 가려지지 않게 한다.
    ctx.save();
    ctx.fillStyle = accentColor;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    for (const index of highlightedPointIndexes) {
      const point = chartPoints[index];
      if (!point) continue;

      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  },
});

const getLabeledPointIndexes = (
  history: MemberProfileRatingHistoryPoint[],
) => {
  if (history.length === 0) return new Set<number>();

  const values = history.map((point) => point.rating);
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  const todayCurrentIndex = getTodayPointIndex(history);
  const getExtremumIndex = (rating: number) =>
    todayCurrentIndex >= 0 && values[todayCurrentIndex] === rating
      ? todayCurrentIndex
      : values.indexOf(rating);
  // 최고/최저점과 오늘의 현재 레이팅만 강조한다. 오늘 값이 극값과 같으면
  // 같은 수치 라벨을 중복하지 않고 오늘 점에서 대표한다.
  const pointIndexes = new Set<number>();
  if (maximum === minimum) {
    pointIndexes.add(getExtremumIndex(maximum));
  } else {
    pointIndexes.add(getExtremumIndex(maximum));
    pointIndexes.add(getExtremumIndex(minimum));
  }

  if (todayCurrentIndex >= 0) pointIndexes.add(todayCurrentIndex);

  return pointIndexes;
};

const getPointTimestamp = (point: MemberProfileRatingHistoryPoint) => {
  const timestamp = new Date(point.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

/**
 * 차트에서는 같은 KST 날짜에 발생한 여러 변동을 가장 늦은 평점 하나로
 * 축약한다. 원본 projection과 경기 이력은 그대로 유지하며, 오늘의 current
 * 점은 같은 시각의 매치 점보다 우선한다.
 */
const keepLatestRatingPointPerKoreaDate = (
  history: MemberProfileRatingHistoryPoint[],
): MemberProfileRatingHistoryPoint[] => {
  const latestByDate = new Map<
    string,
    { point: MemberProfileRatingHistoryPoint; index: number }
  >();

  for (const [index, point] of history.entries()) {
    const dateKey = getKoreaDateKey(point.createdAt) ?? `invalid-${index}`;
    const previous = latestByDate.get(dateKey);
    if (!previous) {
      latestByDate.set(dateKey, { point, index });
      continue;
    }

    const pointTimestamp = getPointTimestamp(point);
    const previousTimestamp = getPointTimestamp(previous.point);
    const sourcePriority = point.source === "current" ? 1 : 0;
    const previousSourcePriority = previous.point.source === "current" ? 1 : 0;
    const isPreferredAtSameTime =
      pointTimestamp === previousTimestamp &&
      (sourcePriority > previousSourcePriority ||
        (sourcePriority === previousSourcePriority && index > previous.index));

    if (pointTimestamp > previousTimestamp || isPreferredAtSameTime) {
      latestByDate.set(dateKey, { point, index });
    }
  }

  return [...latestByDate.values()]
    .sort(
      (left, right) =>
        getPointTimestamp(left.point) - getPointTimestamp(right.point) ||
        left.index - right.index,
    )
    .map(({ point }) => point);
};

const RatingHistoryChart: React.FC<RatingHistoryChartProps> = ({
  history,
  label,
}) => {
  const [isEntered, setIsEntered] = useState(false);
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsEntered(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const chartNow = useMemo(() => new Date(), [history]);

  const historyWithToday = useMemo(() => {
    const latestPoint = history[history.length - 1];
    if (
      !latestPoint ||
      (latestPoint.source === "current" && isToday(latestPoint.createdAt))
    ) {
      return history;
    }

    return [
      ...history,
      {
        rating: latestPoint.rating,
        createdAt: chartNow.toISOString(),
        source: "current" as const,
      },
    ];
  }, [chartNow, history]);
  const visibleHistory = useMemo(
    () => keepLatestRatingPointPerKoreaDate(historyWithToday),
    [historyWithToday],
  );
  const chartWindowEnd = useMemo(
    () => Math.max(
      chartNow.getTime(),
      ...visibleHistory.map(getPointTimestamp),
    ),
    [chartNow, visibleHistory],
  );
  const chartWindowStart = useMemo(() => {
    const earliestTimestamp = Math.min(
      ...visibleHistory.map(getPointTimestamp),
    );
    return earliestTimestamp < chartWindowEnd
      ? earliestTimestamp
      : chartWindowEnd - CHART_WINDOW_MS;
  }, [chartWindowEnd, visibleHistory]);
  const displayHistory = useMemo(
    () =>
      visibleHistory.length === 1
        ? [null, visibleHistory[0]]
        : visibleHistory,
    [visibleHistory],
  );
  const valueOffset = visibleHistory.length === 1 ? 1 : 0;
  const dateLabelIndexes = useMemo(
    () => {
      const indexes = new Set(
        [...getLabeledPointIndexes(visibleHistory)].map(
          (index) => index + valueOffset,
        ),
      );
      // 차트의 끝점은 historyWithToday가 보정한 현재 평점이다. projection의
      // source 압축 여부와 관계없이 오늘 점·가이드선·날짜를 항상 남긴다.
      if (displayHistory.length > 0) {
        indexes.add(displayHistory.length - 1);
      }
      return indexes;
    },
    [displayHistory.length, valueOffset, visibleHistory],
  );
  const dateLabels = useMemo(() => {
    const labels = new Map<number, string>();
    for (const index of dateLabelIndexes) {
      const point = displayHistory[index];
      if (point) labels.set(index, formatDate(point.createdAt));
    }
    return labels;
  }, [dateLabelIndexes, displayHistory]);
  const ratingLabelTargets = useMemo(
    () =>
      getRatingLabelTargets(visibleHistory).map((target) => ({
        ...target,
        index: target.index + valueOffset,
      })),
    [valueOffset, visibleHistory],
  );
  const ratingLabelTexts = useMemo(() => {
    const texts = new Map<number, string>();
    for (const { index } of ratingLabelTargets) {
      const point = displayHistory[index];
      if (point) texts.set(index, point.rating.toFixed(3));
    }
    return texts;
  }, [displayHistory, ratingLabelTargets]);
  const chartDecorationPlugin = useMemo(
    () =>
      createChartDecorationPlugin(
        dateLabelIndexes,
        dateLabels,
        ratingLabelTargets,
        ratingLabelTexts,
      ),
    [dateLabelIndexes, dateLabels, ratingLabelTargets, ratingLabelTexts],
  );
  const chartValues = useMemo(
    () => displayHistory.map((point) => ({
      x: point ? getPointTimestamp(point) : chartWindowStart,
      y: point?.rating ?? null,
    })),
    [chartWindowStart, displayHistory],
  );

  const data = useMemo<ChartData<"line", Array<{ x: number; y: number | null }>>>(
    () => ({
      datasets: [
        {
          data: chartValues,
          borderColor: accentColor,
          backgroundColor: createAreaGradient,
          borderWidth: 2,
          cubicInterpolationMode: "monotone",
          fill: true,
          pointBackgroundColor: accentColor,
          pointBorderColor: accentColor,
          pointBorderWidth: 2,
          pointStyle: "circle",
          pointHoverRadius: (context) =>
            dateLabelIndexes.has(context.dataIndex) ? 5 : 0,
          pointRadius: (context) =>
            dateLabelIndexes.has(context.dataIndex) ? 3 : 0,
        },
      ],
    }),
    [chartValues, dateLabelIndexes],
  );

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: {
          top: 18,
          right: CHART_LABEL_RIGHT_PADDING_PX,
          bottom: 20,
          left: CHART_LABEL_HORIZONTAL_PADDING_PX,
        },
      },
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          type: "linear",
          min: chartWindowStart,
          max: chartWindowEnd,
          reverse: false,
          border: { display: false },
          grid: {
            display: false,
            drawTicks: false,
          },
          ticks: {
            display: false,
          },
        },
        y: {
          display: false,
          grace: "40%",
        },
      },
    }),
    [chartWindowEnd, chartWindowStart],
  );

  if (history.length === 0) {
    return (
      <div className="mt-2 flex h-36 items-center justify-center px-4 text-center text-sm font-medium text-pkpk-secondary-font/70">
        평점 이력이 없습니다.
      </div>
    );
  }

  return (
    <div
      className="mt-2 h-36 min-w-0"
      style={{
        opacity: isEntered ? 1 : 0,
        transform: isEntered ? "translateY(0)" : "translateY(12px)",
        transition: "transform 220ms ease-out, opacity 220ms ease-out",
      }}
    >
      <Line
        aria-label={`${label} 평점 이력 그래프`}
        data={data}
        options={options}
        plugins={[chartDecorationPlugin]}
      />
    </div>
  );
};

export default RatingHistoryChart;
