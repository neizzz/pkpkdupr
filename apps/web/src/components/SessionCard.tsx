import React from "react";
import { Card } from "@heroui/react";
import { IoPeopleOutline } from "react-icons/io5";
import AvatarGroup from "@/components/AvatarGroup";
import MatchCardHeader from "@/components/MatchCardHeader";
import type { MatchSessionSummaryInfo } from "@/components/Match";

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

  const card = (
    <Card
      className={`w-full rounded-3xl bg-white/95 p-3 shadow-sm ${
        onPress ? "transition-colors hover:bg-amber-50" : ""
      }`}
    >
      <MatchCardHeader
        date={date}
        time={time}
        title={`[세션] ${session.name}`}
        rightGapClassName="gap-0"
        rightContent={
          showMatchCount ? (
            <span className="text-sm font-semibold leading-none">
              총 {session.matchCount}경기
            </span>
          ) : undefined
        }
        showChevron={showChevron}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <AvatarGroup
          items={session.participants.map((participant) => ({
            id: participant.id,
            avatarUrl: participant.avatarUrl,
            name: participant.username,
          }))}
          max={4}
          size="session"
        />
        <span className="flex shrink-0 items-center gap-1 text-xs leading-none font-medium text-[#888]">
          <IoPeopleOutline className="size-4" />
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
