import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Separator } from "@heroui/react";
import type { MatchScore } from "@pkpkdupr/shared/match";
import {
  getMaxScoreCountForMatchMode,
  getMatchTopLevelType,
  MATCH_RESULT_MAX_SCORE_COUNT,
  validateMatchScoresForMode,
} from "@pkpkdupr/shared/match";
import type { PlayerRatingChangeLog } from "@pkpkdupr/shared/player";
import Match, { type MatchInfo } from "@/components/Match";
import DetailPageHeader from "@/components/DetailPageHeader";
import { formatRating } from "@/utils/dupr";

interface MatchDetailProps {
  match: MatchInfo;
  currentPlayerId?: string;
  onSubmitResult?: (matchId: string, scores: MatchScore[]) => Promise<void>;
  onApproveResult?: (matchId: string) => Promise<void>;
  onCancelApproval?: (matchId: string) => Promise<void>;
  isOnline?: boolean;
  isSubmittingResult?: boolean;
  isApprovingResult?: boolean;
  isCancellingApproval?: boolean;
}

const subTextClassName = "text-[#888]";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const createEmptyScoreRow = () => ({ scoreA: "", scoreB: "" });
const SCORE_TABLE_SET_COUNT = 3;

const MatchDetail: React.FC<MatchDetailProps> = ({
  match,
  currentPlayerId,
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
  const isPendingApprovalMatch = match.status === "pending-approval";
  const isCreator = match.creatorPlayerId === currentPlayerId;
  const hasResultScores = !!match.scores?.length;
  const canSubmitResult =
    (match.status === "created" || match.status === "pending-approval") &&
    isCreator &&
    isOnline &&
    !!onSubmitResult;
  const approvalByPlayerId = useMemo(
    () =>
      new Map(match.approvals.map((approval) => [approval.playerId, approval])),
    [match.approvals],
  );
  const hasApproved =
    !!currentPlayerId && approvalByPlayerId.has(currentPlayerId);
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
  const resultActionLabel = hasResultScores ? "결과 수정" : "결과 입력";
  const shouldShowResultForm =
    canSubmitResult && (!hasResultScores || isResultFormOpen);
  const maxScoreCount = getMaxScoreCountForMatchMode(match.mode);
  const canAddScoreRow = scoreRows.length < maxScoreCount;
  const totalPoints = useMemo(
    () =>
      (match.scores ?? []).reduce<[number, number]>(
        ([totalA, totalB], score) => [
          totalA + score.scoreA,
          totalB + score.scoreB,
        ],
        [0, 0],
      ),
    [match.scores],
  );
  const ratingChangeByPlayerId = useMemo(
    () =>
      new Map<string, PlayerRatingChangeLog>(
        (match.ratingChanges ?? []).map((change) => [change.playerId, change]),
      ),
    [match.ratingChanges],
  );
  const ratingCategory = useMemo(
    () =>
      getMatchTopLevelType(match.type) === "singles"
        ? ("singles" as const)
        : ("doubles" as const),
    [match.type],
  );
  const hasRatingChanges =
    match.status === "completed" && (match.ratingChanges?.length ?? 0) > 0;

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
    if (!onSubmitResult) return;

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
    if (!onApproveResult) return;

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
    if (!onCancelApproval) return;

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
    <div className="min-h-full p-2">
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3">
        <DetailPageHeader title="Match Detail" tabKey="match" />

        <Match
          match={match}
          currentPlayerId={currentPlayerId}
          showChevron={false}
        />

        <section>
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${subTextClassName}`}
          >
            Score
          </p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-amber-100 bg-white/80 shadow-sm">
            <table className="w-full table-fixed border-collapse text-sm text-amber-950">
              <colgroup>
                <col className="w-[40%]" />
                {Array.from({ length: SCORE_TABLE_SET_COUNT }, (_, index) => (
                  <col key={index} />
                ))}
                <col />
              </colgroup>
              <thead className="bg-amber-100/60 text-xs font-semibold text-amber-800">
                <tr>
                  <th
                    scope="col"
                    className="border-r border-amber-100 px-2 py-2 text-left"
                  >
                    Sets
                  </th>
                  {Array.from({ length: SCORE_TABLE_SET_COUNT }, (_, index) => (
                    <th
                      key={index}
                      scope="col"
                      className="border-r border-amber-100 px-1 py-2 text-center"
                    >
                      {index + 1}
                    </th>
                  ))}
                  <th scope="col" className="px-1 py-2 text-center">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {match.teams.map((team, teamIndex) => (
                  <tr key={team.id} className="border-t border-amber-100">
                    <th
                      scope="row"
                      className="border-r border-amber-100 px-2 py-3 text-left font-semibold"
                    >
                      <div className="flex min-w-0 items-center">
                        {team.players.map((player, playerIndex) => (
                          <React.Fragment key={player.id}>
                            {playerIndex > 0 ? (
                              <span aria-hidden="true" className="shrink-0">
                                /
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1 truncate">
                              {player.username}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </th>
                    {Array.from(
                      { length: SCORE_TABLE_SET_COUNT },
                      (_, scoreIndex) => {
                        const score = match.scores?.[scoreIndex];
                        const value = score
                          ? teamIndex === 0
                            ? score.scoreA
                            : score.scoreB
                          : "-";

                        return (
                          <td
                            key={scoreIndex}
                            className="border-r border-amber-100 px-1 py-3 text-center font-medium tabular-nums"
                          >
                            {value}
                          </td>
                        );
                      },
                    )}
                    <td className="px-1 py-3 text-center text-base font-bold tabular-nums">
                      {hasResultScores ? totalPoints[teamIndex] : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canSubmitResult ? (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                className="rounded-2xl text-[#409eff]"
                onPress={() => setIsResultFormOpen((value) => !value)}
              >
                {isResultFormOpen
                  ? "닫기"
                  : hasResultScores
                    ? "수정"
                    : "결과 입력"}
              </Button>
            </div>
          ) : null}
        </section>

        {shouldShowResultForm ? (
          <Card className="rounded-3xl bg-white p-3 shadow-sm">
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
                    placeholder="점수"
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
                    placeholder="점수"
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
          </Card>
        ) : null}

        {hasRatingChanges ? (
          <section>
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${subTextClassName}`}
            >
              Rating Change
            </p>
            <Card className="mt-3 rounded-3xl bg-white/95 p-3 shadow-sm">
              {(() => {
                const entries = match.teams
                  .flatMap((team) => team.players)
                  .flatMap((player) => {
                    const change = ratingChangeByPlayerId.get(player.id);
                    return change ? [{ player, change }] : [];
                  });

                return entries.map(({ player, change }, index) => {
                  const previous = change.previousRating[ratingCategory];
                  const next = change.nextRating[ratingCategory];
                  const delta = change.delta[ratingCategory];
                  const deltaSign = delta > 0 ? "+" : "";
                  const deltaColorClass =
                    delta > 0
                      ? "text-emerald-600"
                      : delta < 0
                        ? "text-red-500"
                        : "text-[#888]";

                  return (
                    <React.Fragment key={player.id}>
                      <div className="flex items-center justify-between gap-3 py-0">
                        <p
                          className={`min-w-0 truncate text-sm ${
                            player.id === currentPlayerId
                              ? "font-bold text-amber-950"
                              : "font-medium text-amber-950"
                          }`}
                        >
                          {player.username}
                        </p>
                        <div className="min-w-0 text-right text-xs font-medium tabular-nums">
                          <p className="text-amber-950">
                            {formatRating(previous)}
                            <span className="mx-1 text-[#888]">→</span>
                            <span className="font-semibold">
                              {formatRating(next)}
                            </span>
                          </p>
                          <p className={`mt-0.5 ${deltaColorClass}`}>
                            ({deltaSign}
                            {delta.toFixed(3)})
                          </p>
                        </div>
                      </div>
                      {index < entries.length - 1 ? (
                        <Separator className="-mx-3 w-[calc(100%+1.5rem)]" />
                      ) : null}
                    </React.Fragment>
                  );
                });
              })()}
            </Card>
          </section>
        ) : null}

        <section>
          <div className="flex items-center justify-between gap-3">
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${subTextClassName}`}
            >
              결과 승인
            </p>
            <span className="text-xs font-medium text-[#888]">
              승인 {match.approvals.length}/
              {match.teams.flatMap((team) => team.players).length}
            </span>
          </div>
          <Card className="mt-3 rounded-3xl bg-white/95 p-3 shadow-sm">
            {match.teams
              .flatMap((team) => team.players)
              .map((player, index, players) => {
                const approval = approvalByPlayerId.get(player.id);
                const isMatchCreator = player.id === match.creatorPlayerId;
                const approvalLabel = isMatchCreator
                  ? hasResultScores
                    ? "매치 생성자(자동 승인)"
                    : "매치 생성자(결과 입력 대기)"
                  : approval
                    ? "승인 완료"
                    : "승인 대기";

                return (
                  <React.Fragment key={player.id}>
                    <div className="flex items-center justify-between gap-3 py-0">
                      <p
                        className={`min-w-0 truncate text-sm ${
                          player.id === currentPlayerId
                            ? "font-bold text-amber-950"
                            : "font-medium text-amber-950"
                        }`}
                      >
                        {player.username}
                      </p>
                      <div className="min-w-0 text-right text-xs font-medium">
                        {approval ? (
                          <>
                            <p className="text-emerald-600">{approvalLabel}</p>
                            <p className="mt-0.5 text-[#888]">
                              {formatDateTime(approval.approvedAt)}
                            </p>
                          </>
                        ) : (
                          <p className="text-[#888]">{approvalLabel}</p>
                        )}
                      </div>
                    </div>
                    {index < players.length - 1 ? (
                      <Separator className="-mx-3 w-[calc(100%+1.5rem)]" />
                    ) : null}
                  </React.Fragment>
                );
              })}
          </Card>
          {canApproveResult || canCancelApproval ? (
            <div className="mt-3 flex justify-end gap-2">
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
        </section>

        {!shouldShowResultForm && resultError ? (
          <p className="text-xs font-medium text-red-500">{resultError}</p>
        ) : null}

        <div
          className={`pb-2 text-right text-xs font-medium ${subTextClassName}`}
        >
          <p>Created at {formatDateTime(match.createdAt)}</p>
          <p className="mt-1">Updated at {formatDateTime(match.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
};

export default MatchDetail;
