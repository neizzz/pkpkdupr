import { Player } from "./player.js";

export const matchTypeValues = [
  "mixed-doubles",
  "men-doubles",
  "women-doubles",
  "singles",
] as const;

export type MatchType = (typeof matchTypeValues)[number];

export const matchTypeLabels: Record<MatchType, string> = {
  "mixed-doubles": "Mixed Doubles",
  "men-doubles": "Men Doubles",
  "women-doubles": "Women Doubles",
  singles: "Singles",
};

export const matchSourceValues = [
  "player_created",
  "admin_created_result",
] as const;

export type MatchSource = (typeof matchSourceValues)[number];

export const matchSourceLabels: Record<MatchSource, string> = {
  player_created: "일반 생성",
  admin_created_result: "관리자 입력",
};

export const matchModeValues = ["single-game", "best-of-3"] as const;

export type MatchMode = (typeof matchModeValues)[number];

export const DEFAULT_MATCH_MODE: MatchMode = "single-game";

export const matchModeLabels: Record<MatchMode, string> = {
  "single-game": "단판",
  "best-of-3": "2선승",
};

export const MATCH_RESULT_MAX_SCORE_COUNT = 3;

export type MatchStatus =
  | "created"
  | "pending-approval"
  | "completed"
  | "cancelled";

export interface Team {
  id: string;
  name: string;
  players: Player[];
}

/** 한 세트/게임의 상세 스코어 기록 */
export interface MatchScore {
  scoreA: number;
  scoreB: number;
}

export interface MatchResultApproval {
  playerId: string;
  approvedAt: Date;
}

const getMatchWinCounts = (scores: MatchScore[]) =>
  scores.reduce<[number, number]>(
    (wins, score) => {
      if (score.scoreA > score.scoreB) {
        wins[0] += 1;
      } else if (score.scoreB > score.scoreA) {
        wins[1] += 1;
      }

      return wins;
    },
    [0, 0],
  );

export const getMaxScoreCountForMatchMode = (mode: MatchMode) =>
  mode === "single-game" ? 1 : MATCH_RESULT_MAX_SCORE_COUNT;

export const inferMatchModeFromScores = (scores: MatchScore[]): MatchMode => {
  if (scores.length === 1) {
    return "single-game";
  }

  if (scores.length >= 2 && scores.length <= MATCH_RESULT_MAX_SCORE_COUNT) {
    return "best-of-3";
  }

  throw new Error("매치는 단판 또는 2선승만 지원합니다.");
};

export const validateMatchScoresForMode = (
  mode: MatchMode,
  scores: MatchScore[],
) => {
  if (mode === "single-game") {
    if (scores.length !== 1) {
      throw new Error("단판 매치는 스코어를 1개만 입력해야 합니다.");
    }

    return;
  }

  if (scores.length < 2 || scores.length > MATCH_RESULT_MAX_SCORE_COUNT) {
    throw new Error("2선승 매치는 스코어를 2개 또는 3개 입력해야 합니다.");
  }

  let teamWins: [number, number] = [0, 0];

  for (const [index, score] of scores.entries()) {
    if (score.scoreA > score.scoreB) {
      teamWins = [teamWins[0] + 1, teamWins[1]];
    } else if (score.scoreB > score.scoreA) {
      teamWins = [teamWins[0], teamWins[1] + 1];
    }

    const isDecided = teamWins[0] === 2 || teamWins[1] === 2;

    if (isDecided && index < scores.length - 1) {
      throw new Error(
        "2선승 매치는 승부가 결정된 뒤 추가 스코어를 입력할 수 없습니다.",
      );
    }
  }

  const [teamAWins, teamBWins] = getMatchWinCounts(scores);

  if (teamAWins !== 2 && teamBWins !== 2) {
    throw new Error("2선승 매치는 한 팀이 2게임을 먼저 이겨야 합니다.");
  }
};

export interface Match {
  id: string;
  type: MatchType;
  mode: MatchMode;
  source: MatchSource;
  creatorPlayerId: string;
  status: MatchStatus;
  teams: [Team, Team];
  scores?: MatchScore[];
  resultSubmittedByPlayerId: string | null;
  resultSubmittedAt: Date | null;
  approvals: MatchResultApproval[];
  location?: string;
  scheduledAt: Date;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface MatchResult {
  matchId: string;
  winnerTeamIndex: 0 | 1;
  scores: MatchScore[];
  // 경기 결과에 따라 각 선수의 DUPR 평점이 어떻게 변경되었는지 기록
  ratingChanges: Array<{
    playerId: string;
    oldRating: number;
    newRating: number;
  }>;
}
