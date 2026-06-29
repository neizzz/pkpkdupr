import { Player } from "./player.js";

export type MatchType = "Singles" | "Doubles";
export type MatchStatus = "created" | "completed" | "cancelled";

export interface Team {
  id: string;
  name: string;
  players: Player[];
}

/** 한 경기(Set/Game)의 스코어 기록 */
export interface MatchScore {
  // Team A가 해당 게임에서 취득한 최종 점수
  teamA: number;
  // Team B가 해당 게임에서 취득한 최종 점수
  teamB: number;
  // 경기 내 각 세트의 상세 스코어 (scoreA, scoreB = 해당 세트의 A팀/B팀 득점)
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
  // TODO: 예약 기능이 들어오면, completedAt은 optional이 됨.
  //   scheduledAt: Date;
  createdAt: Date;
  completedAt: Date;
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
