import React from "react";
import { Card } from "@heroui/react";
import { IoPeopleOutline } from "react-icons/io5";
import AvatarGroup from "@/components/AvatarGroup";
import MatchCardHeader from "@/components/MatchCardHeader";
import type { MatchSessionSummaryInfo } from "@/components/Match";

const sessionChipClassName =
  "inline-flex h-6 items-center rounded-full px-2 text-[clamp(0.625rem,2.8vw,0.75rem)] font-semibold leading-6";

const sessionStatusLabelMap = {
  created: "예정",
  completed: "완료",
} as const;

const sessionStatusBadgeClassMap = {
  created: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
} as const;

interface SessionCardProps {
  session: MatchSessionSummaryInfo;
  onPress?: (session: MatchSessionSummaryInfo) => void;
  showMatchCount?: boolean;
  showChevron?: boolean;
}

const sessionDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h12",
});

const formatSessionDateTime = (value: string) => {
  const parts = sessionDateTimeFormatter.formatToParts(new Date(value));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}.${get("month")}.${get("day")}`,
    time: `${get("dayPeriod")} ${get("hour")}:${get("minute")}`,
  };
};

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onPress,
  showMatchCount = true,
  showChevron = true,
}) => {
  const { date, time } = formatSessionDateTime(session.date);
  const sessionChip = (
    <span
      className={`${sessionChipClassName} gap-1 bg-pkpk-primary-bg/10 text-pkpk-primary-bg`}
    >
      <IoPeopleOutline
        aria-hidden="true"
        className="size-3.5 [&_*]:stroke-[40]"
      />
      세션
    </span>
  );

  const card = (
    <Card
      className={`w-full rounded-3xl border border-pkpk-primary-bg bg-pkpk-session-bg p-3 shadow-sm ${
        onPress ? "transition-colors hover:bg-amber-50" : ""
      }`}
    >
      <MatchCardHeader
        date={date}
        time={time}
        location={session.location}
        title={session.name}
        rightGapClassName="gap-0"
        rightContent={
          showMatchCount ? (
            <span className="text-sm font-semibold leading-none">
              총 {session.matchCount}경기
            </span>
          ) : undefined
        }
        showChevron={showChevron}
        afterTime={
          <>
            <span
              className={`${sessionChipClassName} ${sessionStatusBadgeClassMap[session.status]}`}
            >
              {sessionStatusLabelMap[session.status]}
            </span>
            {sessionChip}
          </>
        }
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <AvatarGroup
          items={session.participants.map((participant) => ({
            id: participant.id,
            avatarUrl: participant.avatarUrl,
            name: participant.username,
          }))}
          max={6}
          size="session"
          ringClassName="ring-pkpk-session-bg"
        />
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium leading-none text-pkpk-primary-bg">
          <IoPeopleOutline className="size-4 [&_*]:stroke-[40]" />
          {session.participants.length}명 참여
        </span>
      </div>
    </Card>
  );

  return onPress ? (
    <button
      type="button"
      aria-label={`${session.name} 세션 상세 보기`}
      className="w-full text-left"
      onClick={() => onPress(session)}
    >
      {card}
    </button>
  ) : (
    card
  );
};

export default SessionCard;
