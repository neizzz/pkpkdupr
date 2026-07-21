import React from "react";
import { IoCheckmark } from "react-icons/io5";

export type PullToRefreshStatus =
  | "idle"
  | "pulling"
  | "armed"
  | "refreshing"
  | "error";

interface PullToRefreshIndicatorProps {
  distance: number;
  status: PullToRefreshStatus;
  threshold: number;
}

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  distance,
  status,
  threshold,
}) => {
  const isVisible = status !== "idle";
  const progress = Math.min(distance / threshold, 1);
  const isRefreshing = status === "refreshing";
  const isArmed = status === "armed";
  const translateY =
    status === "refreshing" || status === "error"
      ? 90
      : -54 + progress * 144;
  return (
    <div
      aria-hidden={!isVisible}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: `translateY(${translateY}px)`,
        transition:
          status === "pulling" || status === "armed"
            ? "opacity 120ms ease-out"
            : "transform 180ms ease-out, opacity 180ms ease-out",
      }}
    >
      <div
        role="status"
        aria-live="polite"
        aria-label={
          isArmed
            ? "새로고침 준비 완료"
            : status === "refreshing"
              ? "새로고침 중"
              : "새로고침"
        }
        className={`flex size-9 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-transform ${
          isArmed
            ? "scale-110 border-[#409eff] bg-[#409eff]"
            : "border-sky-100/90 bg-white/90"
        }`}
      >
        {isArmed ? (
          <IoCheckmark aria-hidden="true" className="size-5 text-white" />
        ) : (
          <span
            aria-hidden="true"
            className={`size-4 rounded-full border-2 border-sky-100 border-t-[#409eff] ${
              isRefreshing ? "animate-spin" : ""
            }`}
            style={
              isRefreshing
                ? undefined
                : { transform: `rotate(${Math.round(progress * 270)}deg)` }
            }
          />
        )}
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
