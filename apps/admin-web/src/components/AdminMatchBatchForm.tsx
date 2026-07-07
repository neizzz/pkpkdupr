import React, { useEffect, useMemo, useState } from "react";
import {
  MATCH_RESULT_MAX_SCORE_COUNT,
  matchTypeLabels,
  matchTypeValues,
  type MatchScore,
  type MatchType,
} from "@pkpkdupr/shared/match";
import type { Player } from "@pkpkdupr/shared/player";

export interface AdminBatchMatchRequest {
  type: MatchType;
  teams: [
    { name: string; playerIds: string[] },
    { name: string; playerIds: string[] },
  ];
  location: string;
  scheduledAt: string;
  scores: MatchScore[];
}

interface AdminMatchBatchFormProps {
  players: Array<Pick<Player, "id" | "username" | "gender">>;
  isSubmitting: boolean;
  resetKey?: number;
  onSubmit: (matches: AdminBatchMatchRequest[]) => Promise<void>;
}

type ScoreRowDraft = {
  scoreA: string;
  scoreB: string;
};

type SlotRequirement = {
  label: string;
  gender?: Player["gender"];
};

type MatchDraft = {
  id: string;
  type: MatchType;
  location: string;
  scheduledAt: string;
  teams: [string[], string[]];
  scores: ScoreRowDraft[];
};

const createEmptyScoreRow = (): ScoreRowDraft => ({ scoreA: "", scoreB: "" });

const toLocalDateTimeValue = (date = new Date()) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const getSlotRequirements = (
  matchType: MatchType,
): [SlotRequirement[], SlotRequirement[]] => {
  if (matchType === "singles") {
    return [[{ label: "참가자" }], [{ label: "참가자" }]];
  }

  if (matchType === "mixed-doubles") {
    return [
      [
        { label: "남자", gender: "M" },
        { label: "여자", gender: "F" },
      ],
      [
        { label: "남자", gender: "M" },
        { label: "여자", gender: "F" },
      ],
    ];
  }

  const gender = matchType === "men-doubles" ? "M" : "F";
  const label = matchType === "men-doubles" ? "남자" : "여자";

  return [
    [
      { label: `${label} 1`, gender },
      { label: `${label} 2`, gender },
    ],
    [
      { label: `${label} 1`, gender },
      { label: `${label} 2`, gender },
    ],
  ];
};

const createEmptyTeams = (matchType: MatchType): [string[], string[]] => {
  const [teamA, teamB] = getSlotRequirements(matchType);
  return [teamA.map(() => ""), teamB.map(() => "")];
};

const createEmptyDraft = (): MatchDraft => ({
  id: `admin-batch-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: "singles",
  location: "",
  scheduledAt: toLocalDateTimeValue(),
  teams: createEmptyTeams("singles"),
  scores: [createEmptyScoreRow()],
});

const AdminMatchBatchForm: React.FC<AdminMatchBatchFormProps> = ({
  players,
  isSubmitting,
  resetKey = 0,
  onSubmit,
}) => {
  const [drafts, setDrafts] = useState<MatchDraft[]>(() => [createEmptyDraft()]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts([createEmptyDraft()]);
    setError(null);
  }, [resetKey]);

  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const updateDraft = (draftId: string, updater: (draft: MatchDraft) => MatchDraft) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => (draft.id === draftId ? updater(draft) : draft)),
    );
  };

  const handleDraftTypeChange = (draftId: string, type: MatchType) => {
    updateDraft(draftId, (draft) => ({
      ...draft,
      type,
      teams: createEmptyTeams(type),
    }));
  };

  const handlePlayerChange = (
    draftId: string,
    teamIndex: 0 | 1,
    slotIndex: number,
    playerId: string,
  ) => {
    updateDraft(draftId, (draft) => ({
      ...draft,
      teams: draft.teams.map((team, index) =>
        index !== teamIndex
          ? team
          : team.map((selectedPlayerId, currentSlotIndex) =>
              currentSlotIndex === slotIndex ? playerId : selectedPlayerId,
            ),
      ) as [string[], string[]],
    }));
  };

  const handleScoreChange = (
    draftId: string,
    scoreIndex: number,
    field: keyof ScoreRowDraft,
    value: string,
  ) => {
    updateDraft(draftId, (draft) => ({
      ...draft,
      scores: draft.scores.map((scoreRow, currentIndex) =>
        currentIndex === scoreIndex ? { ...scoreRow, [field]: value } : scoreRow,
      ),
    }));
  };

  const getSelectablePlayers = (
    draft: MatchDraft,
    teamIndex: 0 | 1,
    slotIndex: number,
  ) => {
    const [teamARequirements, teamBRequirements] = getSlotRequirements(draft.type);
    const slotRequirement =
      (teamIndex === 0 ? teamARequirements : teamBRequirements)[slotIndex];
    const selectedIds = new Set(
      draft.teams.flatMap((team, currentTeamIndex) =>
        team.filter(
          (playerId, currentSlotIndex) =>
            playerId &&
            !(currentTeamIndex === teamIndex && currentSlotIndex === slotIndex),
        ),
      ),
    );

    return players.filter((player) => {
      if (slotRequirement?.gender && player.gender !== slotRequirement.gender) {
        return false;
      }
      return !selectedIds.has(player.id);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      const payload = drafts.map((draft, draftIndex) => {
        const label = `${draftIndex + 1}번째 경기`;
        const scheduledDate = new Date(draft.scheduledAt);
        if (Number.isNaN(scheduledDate.getTime())) {
          throw new Error(`${label}: 경기 시간을 확인해주세요.`);
        }

        const playerIds = draft.teams.flat();
        if (playerIds.some((playerId) => !playerId)) {
          throw new Error(`${label}: 참가자를 모두 선택해주세요.`);
        }

        if (new Set(playerIds).size !== playerIds.length) {
          throw new Error(`${label}: 같은 참가자를 중복 선택할 수 없습니다.`);
        }

        const missingPlayer = playerIds.find((playerId) => !playersById.has(playerId));
        if (missingPlayer) {
          throw new Error(`${label}: 현재 회원 목록에 없는 참가자가 포함되어 있습니다.`);
        }

        if (draft.scores.length === 0) {
          throw new Error(`${label}: 한 개 이상의 스코어를 입력해주세요.`);
        }

        if (draft.scores.length > MATCH_RESULT_MAX_SCORE_COUNT) {
          throw new Error(
            `${label}: 스코어는 최대 ${MATCH_RESULT_MAX_SCORE_COUNT}개까지 입력할 수 있습니다.`,
          );
        }

        const scores = draft.scores.map((scoreRow, scoreIndex) => {
          const scoreA = Number(scoreRow.scoreA);
          const scoreB = Number(scoreRow.scoreB);

          if (
            !Number.isInteger(scoreA) ||
            !Number.isInteger(scoreB) ||
            scoreA < 0 ||
            scoreB < 0 ||
            scoreA === scoreB
          ) {
            throw new Error(`${label}: ${scoreIndex + 1}번째 스코어를 확인해주세요.`);
          }

          return { scoreA, scoreB };
        });

        return {
          type: draft.type,
          teams: [
            { name: "Team A", playerIds: [...draft.teams[0]] },
            { name: "Team B", playerIds: [...draft.teams[1]] },
          ] as [
            { name: string; playerIds: string[] },
            { name: string; playerIds: string[] },
          ],
          location: draft.location.trim(),
          scheduledAt: scheduledDate.toISOString(),
          scores,
        };
      });

      await onSubmit(payload);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "경기 저장에 실패했습니다.",
      );
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-700">
            경기 결과 일괄 입력
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            관리자 입력 경기는 즉시 완료 처리되며, 현재 회원 목록에서만 참가자를 선택할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDrafts((currentDrafts) => [...currentDrafts, createEmptyDraft()]);
              setError(null);
            }}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50"
          >
            경기 추가
          </button>
        </div>
      </div>

      {players.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          선택 가능한 활성 회원이 없습니다. 먼저 회원을 생성하거나 inactive 상태를 해제해주세요.
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        {drafts.map((draft, draftIndex) => {
          const [teamARequirements, teamBRequirements] = getSlotRequirements(draft.type);

          return (
            <div
              key={draft.id}
              className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-800">
                  경기 #{draftIndex + 1}
                </h3>
                <button
                  type="button"
                  disabled={drafts.length === 1}
                  onClick={() =>
                    setDrafts((currentDrafts) =>
                      currentDrafts.length === 1
                        ? currentDrafts
                        : currentDrafts.filter(
                            (currentDraft) => currentDraft.id !== draft.id,
                          ),
                    )
                  }
                  className="text-sm font-medium text-red-500 disabled:text-slate-300"
                >
                  삭제
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종목
                  </label>
                  <select
                    value={draft.type}
                    onChange={(event) =>
                      handleDraftTypeChange(draft.id, event.target.value as MatchType)
                    }
                    className="w-full rounded-lg border bg-white px-4 py-2"
                  >
                    {matchTypeValues.map((matchType) => (
                      <option key={matchType} value={matchType}>
                        {matchTypeLabels[matchType]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    장소
                  </label>
                  <input
                    type="text"
                    value={draft.location}
                    onChange={(event) =>
                      updateDraft(draft.id, (currentDraft) => ({
                        ...currentDraft,
                        location: event.target.value,
                      }))
                    }
                    placeholder="Court TBD"
                    className="w-full rounded-lg border bg-white px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    경기 시간
                  </label>
                  <input
                    type="datetime-local"
                    value={draft.scheduledAt}
                    onChange={(event) =>
                      updateDraft(draft.id, (currentDraft) => ({
                        ...currentDraft,
                        scheduledAt: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border bg-white px-4 py-2"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {([
                  { title: "Team A", requirements: teamARequirements, teamIndex: 0 as const },
                  { title: "Team B", requirements: teamBRequirements, teamIndex: 1 as const },
                ] as const).map(({ title, requirements, teamIndex }) => (
                  <div
                    key={title}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <h4 className="font-semibold text-slate-700">{title}</h4>
                    <div className="mt-3 space-y-3">
                      {requirements.map((requirement, slotIndex) => (
                        <div key={`${title}-${slotIndex}`}>
                          <label className="mb-1 block text-sm text-gray-600">
                            {requirement.label}
                          </label>
                          <select
                            value={draft.teams[teamIndex][slotIndex] ?? ""}
                            onChange={(event) =>
                              handlePlayerChange(
                                draft.id,
                                teamIndex,
                                slotIndex,
                                event.target.value,
                              )
                            }
                            className="w-full rounded-lg border bg-white px-4 py-2"
                          >
                            <option value="">참가자 선택</option>
                            {getSelectablePlayers(draft, teamIndex, slotIndex).map(
                              (player) => (
                                <option key={player.id} value={player.id}>
                                  {player.username} ({player.gender === "M" ? "남" : "여"})
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-700">스코어</h4>
                    <p className="text-xs text-slate-500">
                      최대 {MATCH_RESULT_MAX_SCORE_COUNT}개까지 입력할 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={draft.scores.length >= MATCH_RESULT_MAX_SCORE_COUNT}
                    onClick={() =>
                      updateDraft(draft.id, (currentDraft) => ({
                        ...currentDraft,
                        scores: [...currentDraft.scores, createEmptyScoreRow()],
                      }))
                    }
                    className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium disabled:text-slate-300"
                  >
                    스코어 추가
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {draft.scores.map((scoreRow, scoreIndex) => (
                    <div key={`${draft.id}-score-${scoreIndex}`} className="flex gap-2">
                      <span className="w-12 self-center text-sm font-medium text-slate-500">
                        G{scoreIndex + 1}
                      </span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={scoreRow.scoreA}
                        onChange={(event) =>
                          handleScoreChange(
                            draft.id,
                            scoreIndex,
                            "scoreA",
                            event.target.value,
                          )
                        }
                        className="w-full rounded-lg border px-4 py-2"
                        placeholder="Team A"
                      />
                      <span className="self-center text-slate-400">:</span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={scoreRow.scoreB}
                        onChange={(event) =>
                          handleScoreChange(
                            draft.id,
                            scoreIndex,
                            "scoreB",
                            event.target.value,
                          )
                        }
                        className="w-full rounded-lg border px-4 py-2"
                        placeholder="Team B"
                      />
                      <button
                        type="button"
                        disabled={draft.scores.length === 1}
                        onClick={() =>
                          updateDraft(draft.id, (currentDraft) => ({
                            ...currentDraft,
                            scores:
                              currentDraft.scores.length === 1
                                ? currentDraft.scores
                                : currentDraft.scores.filter(
                                    (_, currentScoreIndex) =>
                                      currentScoreIndex !== scoreIndex,
                                  ),
                          }))
                        }
                        className="px-3 py-2 text-sm font-medium text-red-500 disabled:text-slate-300"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || players.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {isSubmitting ? "저장 중..." : "경기 결과 일괄 저장"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default AdminMatchBatchForm;
