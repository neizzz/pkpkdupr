import React from "react";
import { IoCalendarClearOutline, IoChevronForward } from "react-icons/io5";

interface MatchCardHeaderProps {
  date: string;
  time: string;
  title?: string;
  afterTime?: React.ReactNode;
  rightContent?: React.ReactNode;
  rightGapClassName?: string;
  showChevron?: boolean;
}

const MatchCardHeader: React.FC<MatchCardHeaderProps> = ({
  date,
  time,
  title,
  afterTime,
  rightContent,
  rightGapClassName = "gap-0.5",
  showChevron = true,
}) => (
  <div className="min-w-0">
    <div className="flex min-h-6 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1 text-[clamp(0.625rem,2.8vw,0.75rem)] font-bold tabular-nums text-pkpk-sub-font">
        <IoCalendarClearOutline className="size-3.5 shrink-0 [&_*]:stroke-[40]" />
        <span className="relative top-px">{date}</span>
        <span className="-mx-0.5 text-[0.75rem] font-bold leading-none text-pkpk-sub-font/50">
          ·
        </span>
        <span className="relative top-px">{time}</span>
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
    {title ? (
      <p className="mt-1 truncate text-[clamp(1rem,4.5vw,1.125rem)] font-semibold text-pkpk-main-font">
        {title}
      </p>
    ) : null}
  </div>
);

export default MatchCardHeader;
