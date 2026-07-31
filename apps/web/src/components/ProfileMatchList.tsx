import React from "react";
import { IoChevronForward, IoLocationOutline } from "react-icons/io5";
import type { MatchInfo } from "@/components/Match";
import RatingDeltaChip from "@/components/RatingDeltaChip";
import SkeletonBlock from "@/components/SkeletonBlock";

export type ProfileMatchOutcome = "win" | "loss" | "unknown";

export interface ProfileMatchListItem {
  match: MatchInfo;
  opponentName: string;
  outcome: ProfileMatchOutcome;
  ratingDelta: number | null;
}

interface ProfileMatchListProps {
  matches: ProfileMatchListItem[];
  isLoading?: boolean;
  variant?: "card" | "plain";
  emptyMessage: string;
  onPressMatch?: (match: MatchInfo) => void;
}

const matchDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

const formatMatchDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { month: "-", day: "-" };
  }

  const parts = Object.fromEntries(
    matchDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    month: parts.month ?? "-",
    day: parts.day ?? "-",
  };
};

const getOutcomeLabel = (outcome: ProfileMatchOutcome) => {
  if (outcome === "win") return "승리";
  if (outcome === "loss") return "패배";
  return "결과 확인";
};

const getOutcomeClassName = (outcome: ProfileMatchOutcome) => {
  if (outcome === "win") return "text-emerald-700";
  if (outcome === "loss") return "text-error";
  return "text-pkpk-sub-font";
};

const ProfileMatchListSkeleton: React.FC<{ variant: "card" | "plain" }> = ({
  variant,
}) => (
  <div
    role="status"
    aria-label="최근 매치 로딩 중"
    className={
      variant === "card"
        ? "overflow-hidden rounded-2xl border border-border bg-white"
        : "overflow-hidden"
    }
  >
    {Array.from({ length: 3 }, (_, index) => (
      <div
        key={index}
        className={`relative flex items-center gap-3 px-3 py-3 ${
          index > 0
            ? variant === "card"
              ? "before:absolute before:inset-x-3 before:top-0 before:border-t before:border-border before:content-['']"
              : "border-t border-border"
            : ""
        }`}
      >
        <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border pr-3">
          <SkeletonBlock className="h-3 w-8" />
          <SkeletonBlock className="h-6 w-7" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-32 max-w-full" />
          <SkeletonBlock className="h-3 w-24 max-w-full" />
        </div>
        <SkeletonBlock className="h-6 w-8 rounded-full" />
        <SkeletonBlock className="h-6 w-12 rounded-full" />
      </div>
    ))}
  </div>
);

const ProfileMatchList: React.FC<ProfileMatchListProps> = ({
  matches,
  isLoading = false,
  variant = "card",
  emptyMessage,
  onPressMatch,
}) => {
  if (isLoading) {
    return <ProfileMatchListSkeleton variant={variant} />;
  }

  if (!matches.length) {
    return (
      <div
        className={
          variant === "card"
            ? "rounded-2xl border border-dashed border-border bg-white px-4 py-6 text-center"
            : "px-4 py-6 text-center"
        }
      >
        <p className="text-sm font-medium text-pkpk-sub-font">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={
        variant === "card"
          ? "overflow-hidden rounded-2xl border border-border bg-white"
          : "overflow-hidden"
      }
    >
      {matches.map((item, index) => {
        const { month, day } = formatMatchDate(item.match.matchStartsAt);
        const opponentLabel = item.opponentName;
        const content = (
          <>
            <div className="flex w-12 shrink-0 flex-col items-center border-r border-border pr-3 text-center">
              <span className="text-[0.625rem] font-bold leading-none text-[#1f2f6f]/70">
                {month}
              </span>
              <span className="mt-1 text-xl font-bold leading-none tabular-nums text-[#1f2f6f]">
                {day}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-pkpk-main-font">
                <span className="mr-1 font-normal text-pkpk-sub-font">vs</span>
                {opponentLabel}
              </p>
              <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-pkpk-sub-font">
                <IoLocationOutline aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">{item.match.location || "장소 미정"}</span>
              </p>
            </div>
            <span
              className={`shrink-0 text-xs font-bold ${getOutcomeClassName(
                item.outcome,
              )}`}
            >
              {getOutcomeLabel(item.outcome)}
            </span>
            <RatingDeltaChip
              delta={item.ratingDelta ?? 0}
              hasData={item.ratingDelta !== null}
            />
            <IoChevronForward
              aria-hidden="true"
              className="size-4 shrink-0 text-pkpk-detail-font"
            />
          </>
        );

        const rowClassName = `relative flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors ${
          index > 0
            ? variant === "card"
              ? "before:absolute before:inset-x-3 before:top-0 before:border-t before:border-border before:content-['']"
              : "border-t border-border"
            : ""
        } ${onPressMatch ? "hover:bg-pkpk-primary-bg/5 active:bg-pkpk-primary-bg/10" : ""}`;

        return onPressMatch ? (
          <button
            key={item.match.id}
            type="button"
            className={rowClassName}
            onClick={() => onPressMatch(item.match)}
            aria-label={`${opponentLabel} 매치 상세 보기`}
          >
            {content}
          </button>
        ) : (
          <div key={item.match.id} className={rowClassName}>
            {content}
          </div>
        );
      })}
    </div>
  );
};

export default ProfileMatchList;
