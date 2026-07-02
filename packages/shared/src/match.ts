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

export type MatchStatus = "created" | "completed" | "cancelled";

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

export interface Match {
  id: string;
  type: MatchType;
  creatorPlayerId: string;
  status: MatchStatus;
  teams: [Team, Team];
  scores?: MatchScore[];
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
