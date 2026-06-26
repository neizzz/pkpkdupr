import { Player } from "./player.js";

export type MatchType = "Singles" | "Doubles";
export type MatchStatus = "completed";
// TODO: 추후에 예정, 진행중, 취소 상태를 추가
//   | "scheduled"
//   | "in_progress"
//   | "completed"
//   | "cancelled";

export interface Team {
  id: string;
  name: string;
  players: Player[];
}

export interface MatchScore {
  teamA: number;
  teamB: number;
  games: Array<{
    scoreA: number;
    scoreB: number;
  }>;
}

export interface Match {
  id: string;
  type: MatchType;
  status: MatchStatus;
  teams: [Team, Team];
  scores?: MatchScore[];
  location: string;
  scheduledAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchResult {
  matchId: string;
  winnerTeamIndex: 0 | 1;
  scores: MatchScore[];
  ratingChanges: Array<{
    playerId: string;
    oldRating: number;
    newRating: number;
  }>;
}
