import React, { useMemo } from "react";
import { Card } from "@heroui/react";
import { IoCalendarClearOutline, IoChevronForward } from "react-icons/io5";
import type { Match as SharedMatch, MatchStatus } from "@pkpkdupr/shared/match";
import {
  getMatchTopLevelType,
  matchTopLevelTypeLabels,
} from "@pkpkdupr/shared/match";
import type { PlayerRatingChangeLog } from "@pkpkdupr/shared/player";
import UserChip from "@/components/UserChip";
import { formatRating, getDisplayRatingForMatchType } from "@/utils/dupr";

export type MatchInfo = Omit<
  SharedMatch,
  | "scheduledAt"
  | "createdAt"
  | "updatedAt"
  | "completedAt"
  | "resultSubmittedAt"
  | "session"
  | "approvals"
> & {
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  resultSubmittedAt: string | null;
  session?: {
    name?: string;
    date: string;
  };
  approvals: Array<{
    playerId: string;
    approvedAt: string;
  }>;
  ratingChanges?: PlayerRatingChangeLog[];
};

interface MatchProps {
  match: MatchInfo;
  currentPlayerId?: string;
  onPress?: (match: MatchInfo) => void;
  showChevron?: boolean;
}

const subTextClassName = "text-[#888]";
const titleChipClassName =
  "inline-flex h-6 items-center rounded-full px-2 text-[clamp(0.625rem,2.8vw,0.75rem)] font-semibold leading-none";
const teamChipWidthClass = "w-[clamp(6rem,32vw,10rem)]";

const statusLabelMap: Record<MatchStatus, string> = {
  created: "예정",
  "pending-approval": "합의중",
  completed: "완료",
  cancelled: "취소",
};

const statusBadgeClassMap: Record<MatchStatus, string> = {
  created: "bg-sky-100 text-sky-700",
  "pending-approval": "bg-violet-100 text-violet-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-700",
};

const formatDateOnly = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace(/\.\s/g, ".")
    .replace(/\.$/, "");

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const formatMatchDateTime = (value: string | Date) => {
  const parts = dateTimeFormatter.formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}.${get("month")}.${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
};

const getTeamSetScore = (scores: MatchInfo["scores"], teamIndex: 0 | 1) =>
  (scores ?? []).filter((score) =>
    teamIndex === 0 ? score.scoreA > score.scoreB : score.scoreB > score.scoreA,
  ).length;

const getTeamAverageDupr = (
  match: MatchInfo,
  team: MatchInfo["teams"][number],
) => {
  let total = 0;

  for (const player of team.players) {
    const rating = getDisplayRatingForMatchType(match.type, player.duprRating);
    if (rating == null) return null;
    total += rating;
  }

  return team.players.length > 0 ? total / team.players.length : null;
};

const Match: React.FC<MatchProps> = ({
  match,
  currentPlayerId,
  onPress,
  showChevron = true,
}) => {
  const hasResultScores = !!match.scores?.length;
  const teamSetScores = [
    getTeamSetScore(match.scores, 0),
    getTeamSetScore(match.scores, 1),
  ] as const;
  const displayedTeamSetScores =
    match.status === "created" ? ([0, 0] as const) : teamSetScores;
  const shouldShowTeamSetScores = hasResultScores || match.status === "created";
  const teamAverageDuprs = useMemo(
    () => match.teams.map((team) => getTeamAverageDupr(match, team)),
    [match],
  );
  const displayTitle =
    match.name ?? matchTopLevelTypeLabels[getMatchTopLevelType(match.type)];
  const sessionLabel = match.session
    ? match.session.name
      ? `${match.session.name} · ${formatDateOnly(match.session.date)}`
      : formatDateOnly(match.session.date)
    : null;
  const { date: matchDate, time: matchTime } = formatMatchDateTime(
    match.matchStartsAt,
  );

  const card = (
    <Card
      className={`relative w-full rounded-3xl bg-white/95 p-3 shadow-sm ${
        onPress ? "transition-colors hover:bg-amber-50" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-0.5 text-[clamp(0.625rem,2.8vw,0.75rem)] font-medium tabular-nums ${subTextClassName}`}
          >
            <IoCalendarClearOutline className="size-3.5" />
            {matchDate}
          </span>
          <span
            className={`text-[0.75rem] font-bold leading-none ${subTextClassName}`}
          >
            ·
          </span>
          <span
            className={`text-[clamp(0.625rem,2.8vw,0.75rem)] font-medium tabular-nums ${subTextClassName}`}
          >
            {matchTime}
          </span>
          <span
            className={`text-[0.75rem] font-bold leading-none ${subTextClassName}`}
          >
            ·
          </span>
          <span
            className={`${titleChipClassName} ${statusBadgeClassMap[match.status]}`}
          >
            {statusLabelMap[match.status]}
          </span>
        </div>
        <p className="mt-1 truncate text-[clamp(1rem,4.5vw,1.125rem)] font-semibold text-pkpk-main-font">
          {displayTitle}
        </p>
        {sessionLabel ? (
          <p
            className={`mt-1 text-[clamp(0.625rem,2.8vw,0.75rem)] font-medium ${subTextClassName}`}
          >
            {sessionLabel}
          </p>
        ) : null}
      </div>

      <div className="mt-1 w-full">
        {shouldShowTeamSetScores ? (
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
            {match.teams.map((team, index) => (
              <div
                key={team.id}
                className={`row-start-1 flex min-w-0 flex-col gap-1.5 ${
                  index === 0
                    ? "col-start-1 items-start text-left"
                    : "col-start-3 items-end text-right"
                }`}
              >
                <p
                  className={`${teamChipWidthClass} text-center text-[clamp(0.625rem,2.8vw,0.75rem)] font-bold tabular-nums text-pkpk-dupr-font`}
                >
                  {formatRating(teamAverageDuprs[index])}
                </p>
                <div className="flex min-w-0 flex-col gap-1">
                  {team.players.map((teamPlayer) => (
                    <UserChip
                      key={teamPlayer.id}
                      player={teamPlayer}
                      isMe={teamPlayer.id === currentPlayerId}
                      size="match"
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="col-start-2 row-start-1 flex items-center justify-center gap-1 text-pkpk-main-font">
              <span className="text-[clamp(1.75rem,9vw,2.25rem)] font-black leading-none tracking-tight">
                {displayedTeamSetScores[0]}
              </span>
              <span className="text-[clamp(1.25rem,5vw,1.5rem)] font-bold leading-none text-[#888]">
                :
              </span>
              <span className="text-[clamp(1.75rem,9vw,2.25rem)] font-black leading-none tracking-tight">
                {displayedTeamSetScores[1]}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid w-full grid-cols-2 gap-3">
            {match.teams.map((team, index) => (
              <div
                key={team.id}
                className={`flex min-w-0 flex-col gap-1.5 ${
                  index === 0 ? "items-start text-left" : "items-end text-right"
                }`}
              >
                <p
                  className={`${teamChipWidthClass} text-center text-[clamp(0.625rem,2.8vw,0.75rem)] font-bold tabular-nums text-pkpk-dupr-font`}
                >
                  {formatRating(teamAverageDuprs[index])}
                </p>
                {team.players.map((teamPlayer) => (
                  <UserChip
                    key={teamPlayer.id}
                    player={teamPlayer}
                    isMe={teamPlayer.id === currentPlayerId}
                    size="match"
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {showChevron ? (
        <IoChevronForward
          aria-hidden="true"
          className="absolute right-3 top-3 size-5 text-[#888]"
        />
      ) : null}
    </Card>
  );

  return onPress ? (
    <button
      type="button"
      aria-label={`${displayTitle} 상세 보기`}
      onClick={() => onPress(match)}
      className="w-full text-left"
    >
      {card}
    </button>
  ) : (
    card
  );
};

export default Match;
