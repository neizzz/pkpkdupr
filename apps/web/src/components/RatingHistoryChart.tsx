import React, { useEffect, useMemo, useState } from "react";
import {
  CategoryScale,
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
  CategoryScale,
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
    ctx.restore();
  },
});

const getLabeledPointIndexes = (values: number[]) => {
  if (values.length === 0) return new Set<number>();

  const currentIndex = values.length - 1;
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  const indexes = new Set([currentIndex]);

  if (maximum !== minimum) {
    indexes.add(values.indexOf(maximum));
    indexes.add(values.indexOf(minimum));
  }

  return indexes;
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

  const historyWithToday = useMemo(() => {
    const latestPoint = history[history.length - 1];
    if (!latestPoint || isToday(latestPoint.createdAt)) return history;

    return [
      ...history,
      {
        rating: latestPoint.rating,
        createdAt: new Date().toISOString(),
        source: "current" as const,
      },
    ];
  }, [history]);
  const values = useMemo(
    () => historyWithToday.map((point) => point.rating),
    [historyWithToday],
  );
  const displayHistory = useMemo(
    () =>
      historyWithToday.length === 1
        ? [null, historyWithToday[0]]
        : historyWithToday,
    [historyWithToday],
  );
  const valueOffset = historyWithToday.length === 1 ? 1 : 0;
  const dateLabelIndexes = useMemo(
    () => {
      const indexes = new Set(
        [...getLabeledPointIndexes(values)].map((index) => index + valueOffset),
      );
      displayHistory.forEach((point, index) => {
        if (point?.source === "official-adjustment") {
          indexes.add(index);
        }
      });
      return indexes;
    },
    [displayHistory, valueOffset, values],
  );
  const ratingLabelIndexes = useMemo(() => {
    const indexes = new Set(dateLabelIndexes);
    const currentIndex = displayHistory.length - 1;
    const currentPoint = displayHistory[currentIndex];
    const previousPoint = displayHistory[currentIndex - 1];

    // 마지막 점이 실제 경기 변화가 아닌 오늘 연장선이면 날짜만 보여준다.
    if (
      currentPoint?.source === "current" &&
      previousPoint?.rating === currentPoint.rating
    ) {
      indexes.delete(currentIndex);
    }

    return indexes;
  }, [dateLabelIndexes, displayHistory]);
  const chartDecorationPlugin = useMemo(
    () => createChartDecorationPlugin(dateLabelIndexes),
    [dateLabelIndexes],
  );
  const labels = useMemo(
    () => displayHistory.map((point) => point?.createdAt ?? ""),
    [displayHistory],
  );
  const chartValues = useMemo(
    () => displayHistory.map((point) => point?.rating ?? null),
    [displayHistory],
  );

  const data = useMemo<ChartData<"line">>(
    () => ({
      labels,
      datasets: [
        {
          data: chartValues,
          borderColor: accentColor,
          backgroundColor: createAreaGradient,
          borderWidth: 2,
          fill: true,
          pointBackgroundColor: (context) =>
            displayHistory[context.dataIndex]?.source === "official-adjustment"
              ? "#ffffff"
              : accentColor,
          pointBorderColor: accentColor,
          pointBorderWidth: 2,
          pointStyle: (context) =>
            displayHistory[context.dataIndex]?.source === "official-adjustment"
              ? "rectRot"
              : "circle",
          pointHoverRadius: (context) =>
            dateLabelIndexes.has(context.dataIndex) ? 5 : 0,
          pointRadius: (context) =>
            dateLabelIndexes.has(context.dataIndex) ? 3 : 0,
          tension: 0.28,
        },
      ],
    }),
    [chartValues, dateLabelIndexes, displayHistory, labels],
  );

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: { top: 18, right: 8, bottom: 0, left: 4 },
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          align: "top",
          anchor: "end",
          clip: false,
          color: accentColor,
          display: (context: Context) =>
            ratingLabelIndexes.has(context.dataIndex),
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
          reverse: false,
          border: { display: false },
          grid: {
            display: false,
            drawTicks: false,
          },
          ticks: {
            autoSkip: false,
            color: accentColor,
            font: (context) => ({
              size: 11,
              weight: isToday(displayHistory[context.index]?.createdAt ?? "")
                ? 700
                : 600,
            }),
            maxRotation: 0,
            minRotation: 0,
            padding: 8,
            callback: (_value, index) => {
              const point = displayHistory[index];
              if (!dateLabelIndexes.has(index) || !point) return "";
              return point.source === "official-adjustment"
                ? "공식 레이팅 반영"
                : formatDate(point.createdAt);
            },
          },
        },
        y: {
          display: false,
          grace: "12%",
        },
      },
    }),
    [dateLabelIndexes, displayHistory, ratingLabelIndexes],
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
