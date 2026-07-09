import React, { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@heroui/react";
import type {
  Match as SharedMatch,
  MatchScore,
  MatchStatus,
} from "@pkpkdupr/shared/match";
import {
  getMaxScoreCountForMatchMode,
  getMatchTopLevelType,
  MATCH_RESULT_MAX_SCORE_COUNT,
  matchModeLabels,
  matchSourceLabels,
  matchTopLevelTypeLabels,
  validateMatchScoresForMode,
} from "@pkpkdupr/shared/match";
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
};

interface MatchProps {
  match: MatchInfo;
  currentPlayerId?: string;
  nowMs?: number;
  onSubmitResult?: (matchId: string, scores: MatchScore[]) => Promise<void>;
  onApproveResult?: (matchId: string) => Promise<void>;
  onCancelApproval?: (matchId: string) => Promise<void>;
  isOnline?: boolean;
  isSubmittingResult?: boolean;
  isApprovingResult?: boolean;
  isCancellingApproval?: boolean;
}

const RECENT_MATCH_THRESHOLD_MS = 10 * 60 * 1000;
const subTextClassName = "text-[#888]";
const titleChipClassName =
  "inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold leading-none";

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

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const formatDateOnly = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace(/\.\s/g, ".")
    .replace(/\.$/, "");

const getScoreLabel = (scores?: MatchInfo["scores"]) => {
  if (!scores?.length) {
    return "스코어 없음";
  }

  return scores.map((score) => `${score.scoreA}:${score.scoreB}`).join(" · ");
};

const getTeamSetScore = (scores: MatchInfo["scores"], teamIndex: 0 | 1) =>
  (scores ?? []).filter((score) =>
    teamIndex === 0 ? score.scoreA > score.scoreB : score.scoreB > score.scoreA,
  ).length;

const getAgeMs = (value: string, nowMs: number) => {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return nowMs - timestamp;
};

const createEmptyScoreRow = () => ({ scoreA: "", scoreB: "" });

const Match: React.FC<MatchProps> = ({
  match,
  currentPlayerId,
  nowMs = Date.now(),
  onSubmitResult,
  onApproveResult,
  onCancelApproval,
  isOnline = true,
  isSubmittingResult = false,
  isApprovingResult = false,
  isCancellingApproval = false,
}) => {
  const [scoreRows, setScoreRows] = useState(() => [createEmptyScoreRow()]);
  const [resultError, setResultError] = useState<string | null>(null);
  const [isResultFormOpen, setIsResultFormOpen] = useState(false);
  const isMyMatch = match.teams.some((team) =>
    team.players.some((teamPlayer) => teamPlayer.id === currentPlayerId),
  );
  const isCompletedMatch = match.status === "completed";
  const isPendingApprovalMatch = match.status === "pending-approval";
  const isCreator = match.creatorPlayerId === currentPlayerId;
  const hasResultScores = !!match.scores?.length;
  const teamSetScores = [
    getTeamSetScore(match.scores, 0),
    getTeamSetScore(match.scores, 1),
  ] as const;
  const shouldShowTeamSetScores = hasResultScores || match.status === "created";
  const displayedTeamSetScores =
    match.status === "created" ? ([0, 0] as const) : teamSetScores;
  const teamDuprSums = useMemo(
    () =>
      match.teams.map((team) => {
        let total = 0;

        for (const player of team.players) {
          const rating = getDisplayRatingForMatchType(
            match.type,
            player.duprRating,
          );

          if (rating == null) {
            return null;
          }

          total += rating;
        }

        return total;
      }),
    [match.teams, match.type],
  );
  const canSubmitResult =
    (match.status === "created" || match.status === "pending-approval") &&
    isCreator &&
    isOnline &&
    !!onSubmitResult;
  const approvedPlayerIds = useMemo(
    () => new Set(match.approvals.map((approval) => approval.playerId)),
    [match.approvals],
  );
  const participantIds = useMemo(
    () =>
      match.teams.flatMap((team) => team.players.map((player) => player.id)),
    [match.teams],
  );
  const hasApproved =
    !!currentPlayerId && approvedPlayerIds.has(currentPlayerId);
  const canApproveResult =
    isPendingApprovalMatch &&
    isMyMatch &&
    !hasApproved &&
    isOnline &&
    !!onApproveResult;
  const canCancelApproval =
    isPendingApprovalMatch &&
    isMyMatch &&
    hasApproved &&
    isOnline &&
    !!onCancelApproval;
  const createdAgeMs = getAgeMs(match.createdAt, nowMs);
  const isRecentlyCreated =
    createdAgeMs >= 0 && createdAgeMs <= RECENT_MATCH_THRESHOLD_MS;
  const resultActionLabel = hasResultScores ? "결과 수정" : "결과 입력";
  const shouldShowResultForm =
    canSubmitResult && (!hasResultScores || isResultFormOpen);
  const maxScoreCount = getMaxScoreCountForMatchMode(match.mode);
  const canAddScoreRow = scoreRows.length < maxScoreCount;
  const displayTitle = match.name ?? matchTopLevelTypeLabels[getMatchTopLevelType(match.type)];
  const sessionLabel = match.session
    ? match.session.name
      ? `${match.session.name} · ${formatDateOnly(match.session.date)}`
      : formatDateOnly(match.session.date)
    : null;

  useEffect(() => {
    setScoreRows(
      match.scores?.length
        ? match.scores.map((score) => ({
            scoreA: String(score.scoreA),
            scoreB: String(score.scoreB),
          }))
        : [createEmptyScoreRow()],
    );
    setResultError(null);
    setIsResultFormOpen(false);
  }, [match.id, match.scores]);

  const updateScoreRow = (
    index: number,
    field: keyof ReturnType<typeof createEmptyScoreRow>,
    value: string,
  ) => {
    setScoreRows((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const handleSubmitResult = async () => {
    if (!onSubmitResult) {
      return;
    }

    try {
      if (scoreRows.length > MATCH_RESULT_MAX_SCORE_COUNT) {
        throw new Error(
          `스코어는 최대 ${MATCH_RESULT_MAX_SCORE_COUNT}개까지 입력할 수 있어요.`,
        );
      }

      const scores = scoreRows.map((row, index) => {
        const scoreA = Number(row.scoreA);
        const scoreB = Number(row.scoreB);

        if (
          !Number.isInteger(scoreA) ||
          !Number.isInteger(scoreB) ||
          scoreA < 0 ||
          scoreB < 0 ||
          scoreA === scoreB
        ) {
          throw new Error(`${index + 1}번째 스코어를 확인해주세요.`);
        }

        return { scoreA, scoreB };
      });

      validateMatchScoresForMode(match.mode, scores);

      setResultError(null);
      await onSubmitResult(match.id, scores);
    } catch (err) {
      setResultError(
        err instanceof Error ? err.message : "결과를 입력하지 못했어요.",
      );
    }
  };

  const handleApproveResult = async () => {
    if (!onApproveResult) {
      return;
    }

    try {
      setResultError(null);
      await onApproveResult(match.id);
    } catch (err) {
      setResultError(
        err instanceof Error ? err.message : "결과를 승인하지 못했어요.",
      );
    }
  };

  const handleCancelApproval = async () => {
    if (!onCancelApproval) {
      return;
    }

    try {
      setResultError(null);
      await onCancelApproval(match.id);
    } catch (err) {
      setResultError(
        err instanceof Error ? err.message : "합의를 취소하지 못했어요.",
      );
    }
  };

  return (
    <Card className="rounded-3xl bg-white/95 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-amber-950">
              {displayTitle}
            </p>
            <span
              className={`${titleChipClassName} bg-amber-100 text-amber-800`}
            >
              {matchModeLabels[match.mode]}
            </span>
            <span
              className={`${titleChipClassName} ${statusBadgeClassMap[match.status]}`}
            >
              {statusLabelMap[match.status]}
            </span>
            {match.source === "admin_created_result" ? (
              <span
                className={`${titleChipClassName} bg-indigo-100 text-indigo-700`}
              >
                {matchSourceLabels[match.source]}
              </span>
            ) : null}
            {isRecentlyCreated ? (
              <span
                className={`${titleChipClassName} bg-[#409eff]/10 text-[#409eff]`}
              >
                방금
              </span>
            ) : null}
          </div>
          {sessionLabel ? (
            <p className={`mt-1 text-xs font-medium ${subTextClassName}`}>
              {sessionLabel}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          {isMyMatch ? (
            <span className="text-xs font-semibold text-[#888]">MY MATCH</span>
          ) : null}
        </div>
      </div>

      <div>
        <div className={`relative ${shouldShowTeamSetScores ? "h-10" : ""}`}>
          <div className="grid h-full grid-cols-2 items-center gap-3">
            <p
              className={`text-center text-xs font-semibold uppercase tracking-wide ${subTextClassName}`}
            >
              Team A
            </p>
            <p
              className={`text-center text-xs font-semibold uppercase tracking-wide ${subTextClassName}`}
            >
              Team B
            </p>
          </div>
          {shouldShowTeamSetScores ? (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 text-amber-950">
              <span className="absolute right-1/2 top-1/2 -translate-y-1/2 pr-3 text-4xl font-black leading-none tracking-tight">
                {displayedTeamSetScores[0]}
              </span>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-bold leading-none text-[#888]">
                :
              </span>
              <span className="absolute left-1/2 top-1/2 -translate-y-1/2 pl-3 text-4xl font-black leading-none tracking-tight">
                {displayedTeamSetScores[1]}
              </span>
            </div>
          ) : null}
        </div>

        <div className="-mt-1 grid grid-cols-2 items-center gap-3">
          {teamDuprSums.map((teamDuprSum, index) => (
            <p
              key={match.teams[index]?.id ?? index}
              className="text-center text-xs font-medium tabular-nums text-[#888] underline decoration-current underline-offset-2"
            >
              {formatRating(teamDuprSum)}
            </p>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 justify-items-center gap-3">
          {match.teams.map((team) => (
            <div
              key={team.id}
              className="flex min-w-0 flex-col items-center gap-2 text-center"
            >
              {team.players.map((teamPlayer) => {
                const isCreatorPlayer = teamPlayer.id === match.creatorPlayerId;

                return (
                  <div
                    key={teamPlayer.id}
                    className="relative inline-flex min-w-0 max-w-full"
                  >
                    {isCreatorPlayer ? (
                      <span
                        aria-label="매치 생성자"
                        role="img"
                        className="absolute right-full top-1/2 mr-1 -translate-y-1/2 leading-none"
                      >
                        👑
                      </span>
                    ) : null}
                    <UserChip
                      player={teamPlayer}
                      isMe={teamPlayer.id === currentPlayerId}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {isCompletedMatch || isPendingApprovalMatch ? (
        <button
          type="button"
          className={`mt-1 w-full rounded-2xl bg-amber-50 px-3 py-3 text-left ${
            canSubmitResult
              ? "cursor-pointer transition-colors hover:bg-amber-100/70"
              : ""
          }`}
          onClick={() => {
            if (canSubmitResult) {
              setIsResultFormOpen((value) => !value);
            }
          }}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${subTextClassName}`}
          >
            Score
          </p>
          <p className="mt-1 text-lg font-bold leading-tight text-amber-950">
            {getScoreLabel(match.scores)}
          </p>
          {isPendingApprovalMatch || canSubmitResult ? (
            <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-[#888]">
              {isPendingApprovalMatch ? (
                <span>
                  승인 {match.approvals.length}/{participantIds.length}
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
              {canSubmitResult ? (
                <span className="font-semibold text-[#409eff]">
                  {isResultFormOpen ? "닫기" : "수정"}
                </span>
              ) : hasApproved ? (
                <span className="font-semibold text-emerald-600">
                  승인 완료
                </span>
              ) : null}
            </div>
          ) : null}
        </button>
      ) : null}

      {shouldShowResultForm ? (
        <div className="mt-2 rounded-2xl border border-border bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
            {hasResultScores ? "Edit Result" : "Result"}
          </p>
          <p className="mt-1 text-xs text-[#888]">
            {match.mode === "single-game"
              ? "단판은 스코어 1개만 입력할 수 있어요."
              : "2선승은 2개 또는 3개 스코어를 입력할 수 있어요."}
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {scoreRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs font-semibold text-[#888]">
                  G{index + 1}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.scoreA}
                  onChange={(event) =>
                    updateScoreRow(index, "scoreA", event.target.value)
                  }
                  className="app-mobile-input min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-base font-semibold text-amber-950 outline-none"
                  placeholder="Team A"
                />
                <span className="text-sm font-semibold text-[#888]">:</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.scoreB}
                  onChange={(event) =>
                    updateScoreRow(index, "scoreB", event.target.value)
                  }
                  className="app-mobile-input min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-base font-semibold text-amber-950 outline-none"
                  placeholder="Team B"
                />
              </div>
            ))}
          </div>
          {resultError ? (
            <p className="mt-2 text-xs font-medium text-red-500">
              {resultError}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="rounded-2xl text-[#409eff]"
              onPress={() => {
                setScoreRows((rows) =>
                  rows.length >= MATCH_RESULT_MAX_SCORE_COUNT
                    ? rows
                    : [...rows, createEmptyScoreRow()],
                );
              }}
              isDisabled={isSubmittingResult || !canAddScoreRow}
            >
              {match.mode === "single-game" ? "단판" : "세트 추가"}
            </Button>
            <Button
              size="sm"
              className="rounded-2xl bg-[#409eff] font-semibold text-white"
              onPress={() => void handleSubmitResult()}
              isDisabled={isSubmittingResult}
            >
              {resultActionLabel}
            </Button>
          </div>
        </div>
      ) : null}

      {canApproveResult || canCancelApproval ? (
        <div className="mt-2 flex justify-end gap-2">
          {canCancelApproval ? (
            <Button
              size="sm"
              variant="secondary"
              className="rounded-2xl text-amber-700"
              onPress={() => void handleCancelApproval()}
              isDisabled={isCancellingApproval}
            >
              합의 취소
            </Button>
          ) : null}
          {canApproveResult ? (
            <Button
              size="sm"
              className="rounded-2xl bg-[#409eff] font-semibold text-white"
              onPress={() => void handleApproveResult()}
              isDisabled={isApprovingResult}
            >
              결과 승인
            </Button>
          ) : null}
        </div>
      ) : null}

      {!shouldShowResultForm && resultError ? (
        <p className="mt-2 text-xs font-medium text-red-500">{resultError}</p>
      ) : null}

      <p className={`mt-1 text-right text-xs font-medium ${subTextClassName}`}>
        created at {formatDateTime(match.createdAt)}
      </p>
    </Card>
  );
};

export default Match;
