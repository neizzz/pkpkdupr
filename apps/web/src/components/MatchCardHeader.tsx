import React from "react";
import {
  IoCalendarClearOutline,
  IoChevronForward,
  IoLocationOutline,
} from "react-icons/io5";

interface MatchCardHeaderProps {
  date: string;
  time: string;
  location?: string;
  courtName?: string;
  title?: string;
  afterTime?: React.ReactNode;
  rightContent?: React.ReactNode;
  rightGapClassName?: string;
  showChevron?: boolean;
}

const MatchCardHeader: React.FC<MatchCardHeaderProps> = ({
  date,
  time,
  location,
  courtName,
  title,
  afterTime,
  rightContent,
  rightGapClassName = "gap-0.5",
  showChevron = true,
}) => (
  <div className="min-w-0">
    <div className="flex min-h-6 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-[clamp(calc(0.625rem*var(--app-font-scale)),calc(2.8vw*var(--app-font-scale)),calc(0.75rem*var(--app-font-scale)))] font-semibold tabular-nums text-pkpk-sub-font">
        <IoCalendarClearOutline className="size-3.5 shrink-0 [&_*]:stroke-[40]" />
        <span className="relative top-px shrink-0 whitespace-nowrap">{date}</span>
        <span className="-mx-0.5 text-[calc(0.75rem*var(--app-font-scale))] font-semibold leading-none text-pkpk-sub-font/50">
          ·
        </span>
        <span className="relative top-px shrink-0 whitespace-nowrap">{time}</span>
        {afterTime ? afterTime : null}
      </div>
      {(rightContent || showChevron) && (
        <div
          className={`flex shrink-0 items-center ${rightGapClassName} text-pkpk-sub-font`}
        >
          {rightContent}
          {showChevron ? (
            <IoChevronForward aria-hidden="true" className="size-5" />
          ) : null}
        </div>
      )}
    </div>
    {location || courtName ? (
      <div className="mt-0 flex min-w-0 items-center gap-1 text-[clamp(calc(0.625rem*var(--app-font-scale)),calc(2.8vw*var(--app-font-scale)),calc(0.75rem*var(--app-font-scale)))] font-medium tabular-nums text-pkpk-sub-font">
        <IoLocationOutline
          aria-hidden="true"
          className="size-3.5 shrink-0 [&_*]:stroke-[40]"
        />
        <span className="relative top-px truncate">
          {location ? <span>{location}</span> : null}
          {location && courtName ? (
            <span className="text-pkpk-sub-font/50"> · </span>
          ) : null}
          {courtName ? <span className="font-semibold">{courtName}</span> : null}
        </span>
      </div>
    ) : null}
    {title ? (
      <p className="mt-1 truncate text-[clamp(calc(1.3rem*var(--app-font-scale)),calc(5.75vw*var(--app-font-scale)),calc(1.4rem*var(--app-font-scale)))] font-semibold text-pkpk-main-font">
        {title}
      </p>
    ) : null}
  </div>
);

export default MatchCardHeader;
