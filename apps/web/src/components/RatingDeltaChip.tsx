import React from "react";
import { Chip } from "@heroui/react";
import { IoArrowDown, IoArrowUp } from "react-icons/io5";

interface RatingDeltaChipProps {
  delta: number;
  hasData?: boolean;
  isEvaluating?: boolean;
  appearance?: "default" | "rating";
}

const RatingDeltaChip: React.FC<RatingDeltaChipProps> = ({
  delta,
  hasData = true,
  isEvaluating = false,
  appearance = "default",
}) => {
  const chipClassName =
    appearance === "rating"
      ? "app-pill !h-6 px-1.5 opacity-90 shadow-none"
      : "app-pill h-6 px-1.5";
  const ratingBackgroundClassName =
    appearance === "rating"
      ? delta > 0
        ? "!bg-[#35c759]"
        : delta < 0
          ? "!bg-[#f55757]"
          : "!bg-white/30"
      : "";
  const textSizeClassName =
    appearance === "rating"
      ? "text-[clamp(calc(0.72rem*var(--app-font-scale)),calc(3.2cqw*var(--app-font-scale)),calc(0.96rem*var(--app-font-scale)))] leading-none"
      : "text-[calc(11px*var(--app-font-scale))]";
  const ratingTextClassName =
    appearance === "rating"
      ? delta > 0
        ? "text-emerald-300"
        : delta < 0
          ? "text-rose-300"
          : "text-white"
      : "";
  const iconClassName = appearance === "rating" ? "size-4" : "size-3";

  if (isEvaluating) {
    return (
      <Chip
        size="sm"
        variant="soft"
        color="warning"
        className={`${chipClassName} ${
          appearance === "rating" ? "!bg-amber-400/80" : ""
        }`}
      >
        <span
          className={`flex items-center font-semibold ${textSizeClassName} ${
            appearance === "rating" ? "text-white" : "text-amber-700"
          }`}
        >
          평가중
        </span>
      </Chip>
    );
  }

  if (!hasData) {
    return (
      <Chip
        size="sm"
        variant="soft"
        color="default"
        className={`${chipClassName} ${ratingBackgroundClassName}`}
      >
        <span
          className={`flex items-center gap-0.5 font-semibold tabular-nums ${textSizeClassName} ${
            appearance === "rating" ? "text-white" : "text-slate-400"
          }`}
        >
          - 0.000
        </span>
      </Chip>
    );
  }

  const color =
    delta > 0 ? ("success" as const) : delta < 0 ? ("danger" as const) : ("default" as const);
  const Icon = delta > 0 ? IoArrowUp : delta < 0 ? IoArrowDown : null;

  return (
    <Chip
      size="sm"
      variant="soft"
      color={color}
      className={`${chipClassName} ${ratingBackgroundClassName}`}
    >
      <span
        className={`flex items-center gap-0.5 font-semibold tabular-nums ${textSizeClassName} ${
          appearance === "rating" ? "text-white" : ratingTextClassName
        }`}
      >
        {Icon ? <Icon className={iconClassName} /> : null}
        {Math.abs(delta).toFixed(3)}
      </span>
    </Chip>
  );
};

export default RatingDeltaChip;
