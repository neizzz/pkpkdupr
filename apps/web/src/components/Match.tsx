import React from "react";
import { Card } from "@heroui/react";
import type { Match as SharedMatch, MatchStatus } from "@pkpkdupr/shared/match";
import { matchTypeLabels } from "@pkpkdupr/shared/match";
import UserChip from "@/components/UserChip";

export type MatchInfo = Omit<
  SharedMatch,
  "scheduledAt" | "createdAt" | "updatedAt" | "completedAt"
> & {
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

interface MatchProps {
  match: MatchInfo;
  currentPlayerId?: string;
  nowMs?: number;
}

const RECENT_MATCH_THRESHOLD_MS = 10 * 60 * 1000;
const subTextClassName = "text-[#888]";
const titleChipClassName =
  "inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold leading-none";

const statusLabelMap: Record<MatchStatus, string> = {
  created: "예정",
  completed: "완료",
  cancelled: "취소",
};

const statusBadgeClassMap: Record<MatchStatus, string> = {
  created: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-700",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const getScoreLabel = (scores?: MatchInfo["scores"]) => {
  if (!scores?.length) {
    return "스코어 없음";
  }

  return scores.map((score) => `${score.scoreA}:${score.scoreB}`).join(" · ");
};

const getAgeMs = (value: string, nowMs: number) => {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return nowMs - timestamp;
};

const Match: React.FC<MatchProps> = ({
  match,
  currentPlayerId,
  nowMs = Date.now(),
}) => {
  const isMyMatch = match.teams.some((team) =>
    team.players.some((teamPlayer) => teamPlayer.id === currentPlayerId),
  );
  const isCompletedMatch = match.status === "completed";
  const createdAgeMs = getAgeMs(match.createdAt, nowMs);
  const isRecentlyCreated =
    createdAgeMs >= 0 && createdAgeMs <= RECENT_MATCH_THRESHOLD_MS;

  return (
    <Card
      className={`rounded-3xl bg-white/95 p-3 shadow-sm ${
        isMyMatch ? "ring-2 ring-[#409eff]/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-amber-950">
              {matchTypeLabels[match.type] ?? match.type}
            </p>
            <span
              className={`${titleChipClassName} ${statusBadgeClassMap[match.status]}`}
            >
              {statusLabelMap[match.status]}
            </span>
            {isRecentlyCreated ? (
              <span
                className={`${titleChipClassName} bg-[#409eff]/10 text-[#409eff]`}
              >
                방금
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          {isMyMatch ? (
            <span className="text-xs font-semibold text-[#888]">MY MATCH</span>
          ) : null}
        </div>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-3">
        {match.teams.map((team, index) => (
          <div key={team.id} className="rounded-2xl bg-gray-50 px-3 py-3">
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${subTextClassName}`}
              >
                Team {index + 1}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {team.players.map((teamPlayer) => (
                  <UserChip
                    key={teamPlayer.id}
                    player={teamPlayer}
                    isMe={teamPlayer.id === currentPlayerId}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isCompletedMatch ? (
        <div className="mt-1 rounded-2xl bg-amber-50 px-3 py-3">
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${subTextClassName}`}
          >
            Score
          </p>
          <p className="mt-1 text-sm font-semibold text-amber-950">
            {getScoreLabel(match.scores)}
          </p>
        </div>
      ) : null}

      <p className={`mt-1 text-right text-xs font-medium ${subTextClassName}`}>
        created at {formatDateTime(match.createdAt)}
      </p>
    </Card>
  );
};

export default Match;
