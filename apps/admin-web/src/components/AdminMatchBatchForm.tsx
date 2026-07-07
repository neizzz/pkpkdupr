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
  players: Array<Pick<Player, "id" | "username" | "gender" | "status">>;
  isSubmitting: boolean;
  protectedAdminUsername?: string;
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

type FormMode = "manual" | "paste";

type ImportedPreviewRow = {
  sourceRowNumber: number;
  matchNumber: string;
  dateLabel: string;
  usernames: [string, string, string, string];
  inferredType: MatchType | null;
  scoreLabel: string;
  issues: string[];
  payload: AdminBatchMatchRequest | null;
};

type ImportedPreview = {
  headerIssues: string[];
  rows: ImportedPreviewRow[];
  validMatches: AdminBatchMatchRequest[];
  errorCount: number;
};

const IMPORT_DEFAULT_LOCATION = "Imported Sheet Match";
const REQUIRED_IMPORT_HEADERS = [
  "경기번호",
  "날짜",
  "A팀 선수1",
  "A팀 선수2",
  "B팀 선수1",
  "B팀 선수2",
  "A팀 점수",
  "B팀 점수",
] as const;

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

const normalizeHeader = (value: string) => value.replace(/\s+/g, "");

const normalizeImportedUsername = (value: string) => {
  const trimmed = value.trim();
  const markdownLinkMatch = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

  return markdownLinkMatch ? markdownLinkMatch[1].trim() : trimmed;
};

const parseImportedDateToIso = (value: string) => {
  const trimmed = value.trim();
  const koreanDateMatch = trimmed.match(
    /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/,
  );

  if (koreanDateMatch) {
    const [, year, month, day] = koreanDateMatch;
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), 3, 0, 0),
    ).toISOString();
  }

  const fallbackDate = new Date(trimmed);
  if (Number.isNaN(fallbackDate.getTime())) {
    return null;
  }

  return fallbackDate.toISOString();
};

const buildImportedPreview = (
  rawText: string,
  players: Array<Pick<Player, "id" | "username" | "gender" | "status">>,
  protectedAdminUsername: string,
): ImportedPreview | null => {
  if (!rawText.trim()) {
    return null;
  }

  const normalizedText = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalizedText) {
    return null;
  }

  const lines = normalizedText
    .split("\n")
    .map((line) => line.replace(/\r/g, ""))
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return null;
  }

  const headers = lines[0].split("\t").map((header) => header.trim());
  const headerIndexByKey = new Map(
    headers.map((header, index) => [normalizeHeader(header), index]),
  );
  const headerIssues = REQUIRED_IMPORT_HEADERS.filter(
    (header) => !headerIndexByKey.has(normalizeHeader(header)),
  ).map((header) => `필수 헤더가 없습니다: ${header}`);

  if (headerIssues.length > 0) {
    return {
      headerIssues,
      rows: [],
      validMatches: [],
      errorCount: headerIssues.length,
    };
  }

  const getCell = (columns: string[], header: (typeof REQUIRED_IMPORT_HEADERS)[number]) =>
    columns[headerIndexByKey.get(normalizeHeader(header)) ?? -1]?.trim() ?? "";

  const playerByUsername = new Map(
    players.map((player) => [player.username, player]),
  );
  const rows: ImportedPreviewRow[] = lines.slice(1).map((line, rowIndex) => {
    const columns = line.split("\t");
    const matchNumber = getCell(columns, "경기번호");
    const dateLabel = getCell(columns, "날짜");
    const usernames = [
      normalizeImportedUsername(getCell(columns, "A팀 선수1")),
      normalizeImportedUsername(getCell(columns, "A팀 선수2")),
      normalizeImportedUsername(getCell(columns, "B팀 선수1")),
      normalizeImportedUsername(getCell(columns, "B팀 선수2")),
    ] as [string, string, string, string];
    const scoreA = Number(getCell(columns, "A팀 점수"));
    const scoreB = Number(getCell(columns, "B팀 점수"));
    const issues: string[] = [];

    usernames.forEach((username, participantIndex) => {
      if (!username) {
        issues.push(`${participantIndex + 1}번째 참가자명이 비어 있습니다.`);
        return;
      }

      const matchedPlayer = playerByUsername.get(username);
      if (!matchedPlayer) {
        issues.push(`존재하지 않는 사용자입니다: ${username}`);
        return;
      }

      if (matchedPlayer.username === protectedAdminUsername) {
        issues.push(`관리자 계정은 참가자로 사용할 수 없습니다: ${username}`);
      }

      if (matchedPlayer.status !== "active") {
        issues.push(`비활성 사용자입니다: ${username}`);
      }
    });

    if (new Set(usernames.filter(Boolean)).size !== usernames.filter(Boolean).length) {
      issues.push("같은 경기에서 참가자가 중복되었습니다.");
    }

    if (
      !Number.isInteger(scoreA) ||
      !Number.isInteger(scoreB) ||
      scoreA < 0 ||
      scoreB < 0 ||
      scoreA === scoreB
    ) {
      issues.push("점수가 유효하지 않습니다.");
    }

    const scheduledAt = parseImportedDateToIso(dateLabel);
    if (!scheduledAt) {
      issues.push(`날짜를 파싱할 수 없습니다: ${dateLabel}`);
    }

    const participantPlayers = usernames.map((username) =>
      playerByUsername.get(username),
    );

    let inferredType: MatchType | null = null;
    if (participantPlayers.every(Boolean)) {
      const teamA = participantPlayers.slice(0, 2) as Array<
        Pick<Player, "gender" | "id">
      >;
      const teamB = participantPlayers.slice(2, 4) as Array<
        Pick<Player, "gender" | "id">
      >;
      const allPlayers = [...teamA, ...teamB];
      const menCount = allPlayers.filter((player) => player.gender === "M").length;
      const womenCount = allPlayers.filter((player) => player.gender === "F").length;
      const isMixedTeam = (team: Array<Pick<Player, "gender">>) =>
        team.length === 2 &&
        team.some((player) => player.gender === "M") &&
        team.some((player) => player.gender === "F");

      if (isMixedTeam(teamA) && isMixedTeam(teamB)) {
        inferredType = "mixed-doubles";
      } else if (menCount === 4) {
        inferredType = "men-doubles";
      } else if (womenCount === 4) {
        inferredType = "women-doubles";
      } else {
        issues.push("성별 조합으로 종목을 추론할 수 없습니다.");
      }
    }

    const payload =
      issues.length === 0 &&
      scheduledAt &&
      inferredType &&
      participantPlayers.every(Boolean)
        ? {
            type: inferredType,
            teams: [
              {
                name: "Team A",
                playerIds: participantPlayers
                  .slice(0, 2)
                  .map((player) => player!.id),
              },
              {
                name: "Team B",
                playerIds: participantPlayers
                  .slice(2, 4)
                  .map((player) => player!.id),
              },
            ] as [
              { name: string; playerIds: string[] },
              { name: string; playerIds: string[] },
            ],
            location: IMPORT_DEFAULT_LOCATION,
            scheduledAt,
            scores: [{ scoreA, scoreB }],
          }
        : null;

    return {
      sourceRowNumber: rowIndex + 2,
      matchNumber,
      dateLabel,
      usernames,
      inferredType,
      scoreLabel: `${Number.isFinite(scoreA) ? scoreA : "-"}:${Number.isFinite(scoreB) ? scoreB : "-"}`,
      issues,
      payload,
    };
  });

  const validMatches = rows
    .map((row) => row.payload)
    .filter((payload): payload is AdminBatchMatchRequest => Boolean(payload));
  const errorCount =
    headerIssues.length + rows.reduce((count, row) => count + row.issues.length, 0);

  return {
    headerIssues,
    rows,
    validMatches,
    errorCount,
  };
};

const AdminMatchBatchForm: React.FC<AdminMatchBatchFormProps> = ({
  players,
  isSubmitting,
  protectedAdminUsername = "admin",
  resetKey = 0,
  onSubmit,
}) => {
  const [mode, setMode] = useState<FormMode>("manual");
  const [drafts, setDrafts] = useState<MatchDraft[]>(() => [createEmptyDraft()]);
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts([createEmptyDraft()]);
    setPastedText("");
    setError(null);
    setMode("manual");
  }, [resetKey]);

  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const selectablePlayers = useMemo(
    () =>
      players.filter(
        (player) =>
          player.status === "active" &&
          player.username !== protectedAdminUsername,
      ),
    [players, protectedAdminUsername],
  );
  const importedPreview = useMemo(
    () => buildImportedPreview(pastedText, players, protectedAdminUsername),
    [pastedText, players, protectedAdminUsername],
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

    return selectablePlayers.filter((player) => {
      if (slotRequirement?.gender && player.gender !== slotRequirement.gender) {
        return false;
      }
      return !selectedIds.has(player.id);
    });
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
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

  const handleImportedSubmit = async () => {
    setError(null);

    if (!importedPreview) {
      setError("붙여넣은 시트 데이터가 없습니다.");
      return;
    }

    if (importedPreview.headerIssues.length > 0) {
      setError(importedPreview.headerIssues[0]);
      return;
    }

    if (importedPreview.rows.length === 0) {
      setError("저장할 경기 행이 없습니다.");
      return;
    }

    if (importedPreview.errorCount > 0) {
      setError("파싱/검증 에러를 모두 해결한 뒤 저장해주세요.");
      return;
    }

    try {
      await onSubmit(importedPreview.validMatches);
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
            수동 입력 또는 Google Sheets 표 복붙으로 관리자 경기 결과를 즉시 완료 처리할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("manual");
            setError(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            mode === "manual"
              ? "bg-blue-600 text-white"
              : "border border-slate-300 bg-white text-slate-700"
          }`}
        >
          수동 입력
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("paste");
            setError(null);
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            mode === "paste"
              ? "bg-blue-600 text-white"
              : "border border-slate-300 bg-white text-slate-700"
          }`}
        >
          시트 붙여넣기
        </button>
      </div>

      {selectablePlayers.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          선택 가능한 활성 회원이 없습니다. 먼저 회원을 생성하거나 inactive 상태를 해제해주세요.
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {mode === "manual" ? (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          {drafts.map((draft, draftIndex) => {
            const [teamARequirements, teamBRequirements] = getSlotRequirements(
              draft.type,
            );

            return (
              <div
                key={draft.id}
                className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-800">
                    경기 #{draftIndex + 1}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDrafts((currentDrafts) => [
                          ...currentDrafts,
                          createEmptyDraft(),
                        ]);
                        setError(null);
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
                    >
                      경기 추가
                    </button>
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
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      종목
                    </label>
                    <select
                      value={draft.type}
                      onChange={(event) =>
                        handleDraftTypeChange(
                          draft.id,
                          event.target.value as MatchType,
                        )
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
                    {
                      title: "Team A",
                      requirements: teamARequirements,
                      teamIndex: 0 as const,
                    },
                    {
                      title: "Team B",
                      requirements: teamBRequirements,
                      teamIndex: 1 as const,
                    },
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
                      <div
                        key={`${draft.id}-score-${scoreIndex}`}
                        className="flex gap-2"
                      >
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
              disabled={isSubmitting || selectablePlayers.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {isSubmitting ? "저장 중..." : "경기 결과 일괄 저장"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Sheets 표 붙여넣기
            </label>
            <textarea
              value={pastedText}
              onChange={(event) => {
                setPastedText(event.target.value);
                setError(null);
              }}
              rows={10}
              placeholder="시트에서 복사한 표를 그대로 붙여넣으세요."
              className="w-full rounded-lg border bg-white px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-2 text-xs text-slate-500">
              필수 헤더: {REQUIRED_IMPORT_HEADERS.join(" / ")}
            </p>
          </div>

          {importedPreview ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-800">파싱 미리보기</h3>
                  <p className="text-sm text-slate-500">
                    총 {importedPreview.rows.length}행 · 유효 {importedPreview.validMatches.length}행 · 에러 {importedPreview.errorCount}개
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleImportedSubmit()}
                  disabled={
                    isSubmitting ||
                    importedPreview.errorCount > 0 ||
                    importedPreview.validMatches.length === 0
                  }
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {isSubmitting ? "저장 중..." : "미리보기 데이터 저장"}
                </button>
              </div>

              {importedPreview.headerIssues.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {importedPreview.headerIssues.map((issue) => (
                    <div key={issue}>{issue}</div>
                  ))}
                </div>
              ) : null}

              {importedPreview.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 pr-3">행</th>
                        <th className="pb-2 pr-3">경기번호</th>
                        <th className="pb-2 pr-3">날짜</th>
                        <th className="pb-2 pr-3">참가자</th>
                        <th className="pb-2 pr-3">종목</th>
                        <th className="pb-2 pr-3">점수</th>
                        <th className="pb-2">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedPreview.rows.map((row) => (
                        <tr key={`${row.sourceRowNumber}-${row.matchNumber}`} className="border-b align-top">
                          <td className="py-3 pr-3 text-slate-500">{row.sourceRowNumber}</td>
                          <td className="py-3 pr-3">{row.matchNumber || "-"}</td>
                          <td className="py-3 pr-3">{row.dateLabel || "-"}</td>
                          <td className="py-3 pr-3">
                            <div className="space-y-1">
                              <div>A: {row.usernames[0] || "-"}, {row.usernames[1] || "-"}</div>
                              <div>B: {row.usernames[2] || "-"}, {row.usernames[3] || "-"}</div>
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            {row.inferredType ? matchTypeLabels[row.inferredType] : "-"}
                          </td>
                          <td className="py-3 pr-3 font-semibold text-slate-700">
                            {row.scoreLabel}
                          </td>
                          <td className="py-3">
                            {row.issues.length === 0 ? (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                저장 가능
                              </span>
                            ) : (
                              <ul className="space-y-1 text-xs text-red-600">
                                {row.issues.map((issue) => (
                                  <li key={issue}>• {issue}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">붙여넣은 데이터가 없습니다.</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default AdminMatchBatchForm;
