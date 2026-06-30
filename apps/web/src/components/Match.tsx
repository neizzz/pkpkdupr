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
}

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

const Match: React.FC<MatchProps> = ({ match, currentPlayerId }) => {
  const isMyMatch = match.teams.some((team) =>
    team.players.some((teamPlayer) => teamPlayer.id === currentPlayerId),
  );
  const isCompletedMatch = match.status === "completed";

  return (
    <Card
      className={`rounded-3xl bg-white/95 p-3 shadow-sm ${
        isMyMatch ? "ring-2 ring-[#409eff]/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-amber-950">
              {matchTypeLabels[match.type] ?? match.type}
            </p>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClassMap[match.status]}`}
            >
              {statusLabelMap[match.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-amber-700/80">
            {match.location} · {formatDateTime(match.scheduledAt)}
          </p>
        </div>

        {isMyMatch ? (
          <span className="rounded-full bg-[#409eff]/10 px-2 py-1 text-xs font-semibold text-[#409eff]">
            MY MATCH
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {match.teams.map((team, index) => (
          <div key={team.id} className="rounded-2xl bg-gray-50 px-3 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700/70">
                Team {index + 1}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {team.players.map((teamPlayer) => (
                  <UserChip key={teamPlayer.id} player={teamPlayer} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isCompletedMatch ? (
        <div className="mt-4 rounded-2xl bg-amber-50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700/70">
            Score
          </p>
          <p className="mt-1 text-sm font-semibold text-amber-950">
            {getScoreLabel(match.scores)}
          </p>
        </div>
      ) : null}
    </Card>
  );
};

export default Match;
