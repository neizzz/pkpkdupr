import React, { useEffect, useMemo, useRef, useState } from "react";
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
import ChartDataLabels, { type Context } from "chartjs-plugin-datalabels";
import { Line } from "react-chartjs-2";
import type { MemberProfileRatingHistoryPoint } from "@/components/MemberProfile";

ChartJS.register(
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  ChartDataLabels,
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

const accentColor = "#eaff19"; // --color-pkpk-accent-bg
const CHART_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const VISUAL_MERGE_X_PX = 16;
const VISUAL_MERGE_Y_PX = 6;
const CHART_PLOT_HEIGHT_PX = 102;

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

    for (const index of pointIndexes) {
      const point = datasetMeta.data[index] as unknown as
        | { draw: (context: CanvasRenderingContext2D) => void }
        | undefined;
      point?.draw(ctx);
    }
  },
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const points = chart.getDatasetMeta(0).data;

    ctx.save();
    ctx.strokeStyle = "rgba(234, 255, 25, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    for (const index of pointIndexes) {
      const point = points[index];
      if (!point) continue;

      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x, chartArea.bottom);
      ctx.stroke();
    }

    ctx.fillStyle = accentColor;
    ctx.font = "600 11px sans-serif";
    ctx.textBaseline = "top";
    for (const [index, dateLabel] of dateLabels) {
      const point = points[index];
      if (!point) continue;

      ctx.textAlign = point.x < chartArea.left + 24
        ? "left"
        : point.x > chartArea.right - 24
          ? "right"
          : "center";
      ctx.fillText(dateLabel, point.x, chartArea.bottom + 8);
    }
    ctx.restore();
  },
});

const getLabeledPointIndexes = (values: number[]) => {
  if (values.length === 0) return new Set<number>();

  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  // 데이터 라벨과 점 표시는 최고/최저점만 유지한다. projection의 양끝점과
  // 중간 변곡점은 선의 모양만 전달해 모바일 화면이 과밀해지지 않게 한다.
  if (maximum === minimum) return new Set([values.length - 1]);
  return new Set([values.indexOf(maximum), values.indexOf(minimum)]);
};

const getPointTimestamp = (point: MemberProfileRatingHistoryPoint) => {
  const timestamp = new Date(point.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

/**
 * 원본 projection은 보존하되, 실제 렌더 영역에서 거의 같은 좌표를 차지하는
 * 인접점은 최신 지점으로 합친다. 단독 최고/최저점은 차트 의미를 위해 유지한다.
 */
const collapseVisuallyOverlappingPoints = (
  history: MemberProfileRatingHistoryPoint[],
  chartWidth: number,
): MemberProfileRatingHistoryPoint[] => {
  if (history.length < 2 || chartWidth <= 0) return history;

  const values = history.map((point) => point.rating);
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  const ratingRange = Math.max(maximum - minimum, 0.01) * 1.24;
  const isOnlyExtremum = (index: number) => {
    if (maximum === minimum) return false;
    const rating = history[index]?.rating;
    if (rating !== maximum && rating !== minimum) return false;
    return values.filter((value) => value === rating).length === 1;
  };

  const collapsed: Array<{ point: MemberProfileRatingHistoryPoint; index: number }> = [];
  for (const [index, point] of history.entries()) {
    const previous = collapsed[collapsed.length - 1];
    if (!previous) {
      collapsed.push({ point, index });
      continue;
    }

    const horizontalDistance =
      (Math.abs(getPointTimestamp(point) - getPointTimestamp(previous.point)) /
        CHART_WINDOW_MS) *
      chartWidth;
    const verticalDistance =
      (Math.abs(point.rating - previous.point.rating) / ratingRange) *
      CHART_PLOT_HEIGHT_PX;
    const overlapsVisually =
      horizontalDistance <= VISUAL_MERGE_X_PX &&
      verticalDistance <= VISUAL_MERGE_Y_PX;

    if (
      overlapsVisually &&
      !isOnlyExtremum(previous.index) &&
      !isOnlyExtremum(index)
    ) {
      collapsed[collapsed.length - 1] = { point, index };
    } else {
      collapsed.push({ point, index });
    }
  }

  return collapsed.map(({ point }) => point);
};

const RatingHistoryChart: React.FC<RatingHistoryChartProps> = ({
  history,
  label,
}) => {
  const [isEntered, setIsEntered] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsEntered(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;

    const updateWidth = () => {
      const nextWidth = element.getBoundingClientRect().width;
      setChartWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) < 1 ? currentWidth : nextWidth,
      );
    };
    updateWidth();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
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
  const chartWindowEnd = useMemo(
    () => Math.max(
      chartNow.getTime(),
      ...historyWithToday.map(getPointTimestamp),
    ),
    [chartNow, historyWithToday],
  );
  const visibleHistory = useMemo(
    () => collapseVisuallyOverlappingPoints(historyWithToday, chartWidth),
    [chartWidth, historyWithToday],
  );
  const values = useMemo(
    () => visibleHistory.map((point) => point.rating),
    [visibleHistory],
  );
  const displayHistory = useMemo(
    () =>
      visibleHistory.length === 1
        ? [null, visibleHistory[0]]
        : visibleHistory,
    [visibleHistory],
  );
  const valueOffset = visibleHistory.length === 1 ? 1 : 0;
  const dateLabelIndexes = useMemo(
    () =>
      new Set(
        [...getLabeledPointIndexes(values)].map((index) => index + valueOffset),
      ),
    [valueOffset, values],
  );
  const dateLabels = useMemo(() => {
    const labels = new Map<number, string>();
    for (const index of dateLabelIndexes) {
      const point = displayHistory[index];
      if (point) labels.set(index, formatDate(point.createdAt));
    }
    return labels;
  }, [dateLabelIndexes, displayHistory]);
  const chartDecorationPlugin = useMemo(
    () => createChartDecorationPlugin(dateLabelIndexes, dateLabels),
    [dateLabelIndexes, dateLabels],
  );
  const chartValues = useMemo(
    () => displayHistory.map((point) => ({
      x: point ? getPointTimestamp(point) : chartWindowEnd - CHART_WINDOW_MS,
      y: point?.rating ?? null,
    })),
    [chartWindowEnd, displayHistory],
  );

  const data = useMemo<ChartData<"line", Array<{ x: number; y: number | null }>>>(
    () => ({
      datasets: [
        {
          data: chartValues,
          borderColor: accentColor,
          backgroundColor: createAreaGradient,
          borderWidth: 2,
          fill: true,
          pointBackgroundColor: accentColor,
          pointBorderColor: accentColor,
          pointBorderWidth: 2,
          pointStyle: "circle",
          pointHoverRadius: (context) =>
            dateLabelIndexes.has(context.dataIndex) ? 5 : 0,
          pointRadius: (context) =>
            dateLabelIndexes.has(context.dataIndex) ? 3 : 0,
          tension: 0.28,
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
        padding: { top: 18, right: 8, bottom: 20, left: 4 },
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          align: "top",
          anchor: "end",
          clip: false,
          color: accentColor,
          display: (context: Context) =>
            dateLabelIndexes.has(context.dataIndex),
          font: { size: 11, weight: 700 },
          formatter: (_value: unknown, context: Context) => {
            const point = displayHistory[context.dataIndex];
            return point ? point.rating.toFixed(3) : "";
          },
          padding: 0,
          textAlign: "center",
        },
      },
      scales: {
        x: {
          type: "linear",
          min: chartWindowEnd - CHART_WINDOW_MS,
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
          grace: "12%",
        },
      },
    }),
    [chartWindowEnd, dateLabelIndexes, displayHistory],
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
      ref={chartContainerRef}
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
