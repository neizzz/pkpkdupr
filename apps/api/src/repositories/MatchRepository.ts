import type { Match, MatchScore, Team } from "@pkpkdupr/shared/match";
import { Player, PlayerDupr } from "@pkpkdupr/shared/player";

const cloneScores = (scores?: MatchScore[]): MatchScore[] | undefined =>
  scores?.map(({ scoreA, scoreB }) => ({ scoreA, scoreB }));

const cloneDupr = (duprRating: PlayerDupr): PlayerDupr => ({
  total: duprRating.total,
  doubles: {
    mixed: duprRating.doubles.mixed,
    men: duprRating.doubles.men,
    women: duprRating.doubles.women,
  },
  singles: duprRating.singles,
});

const clonePlayer = (player: Player): Player => ({
  ...player,
  duprRating: cloneDupr(player.duprRating),
  createdAt: new Date(player.createdAt),
  updatedAt: new Date(player.updatedAt),
});

const cloneTeam = (team: Team): Team => ({
  ...team,
  players: team.players.map(clonePlayer),
});

const cloneMatch = (match: Match): Match => ({
  ...match,
  teams: [cloneTeam(match.teams[0]), cloneTeam(match.teams[1])],
  scores: cloneScores(match.scores),
  scheduledAt: new Date(match.scheduledAt),
  completedAt: match.completedAt ? new Date(match.completedAt) : null,
  createdAt: new Date(match.createdAt),
  updatedAt: new Date(match.updatedAt),
});

const createDupr = (total: number): PlayerDupr => ({
  total,
  doubles: {
    mixed: total + 0.012,
    men: total - 0.008,
    women: total + 0.004,
  },
  singles: total - 0.016,
});

const createPlayer = (
  id: string,
  username: string,
  gender: Player["gender"],
  totalRating: number,
  status: Player["status"] = "active",
): Player => {
  const createdAt = new Date("2026-06-01T09:00:00+09:00");

  return {
    id,
    username,
    gender,
    status,
    duprRating: createDupr(totalRating),
    createdAt,
    updatedAt: createdAt,
  };
};

const mockPlayers = {
  alice: createPlayer("dev-player-alice", "dev_alice", "F", 3.62),
  bob: createPlayer("dev-player-bob", "dev_bob", "M", 4.11),
  chris: createPlayer(
    "dev-player-chris",
    "dev_chris_inactive",
    "M",
    2.98,
    "inactive",
  ),
  admin: createPlayer("admin-player", "admin", "M", 4.35),
};

const mockMatches: Match[] = [
  {
    id: "dev-match-open-play-001",
    type: "mixed-doubles",
    creatorPlayerId: mockPlayers.alice.id,
    status: "completed",
    teams: [
      {
        id: "dev-team-sunrise",
        name: "Sunrise",
        players: [mockPlayers.alice, mockPlayers.bob],
      },
      {
        id: "dev-team-smash",
        name: "Smash Bros",
        players: [mockPlayers.admin, mockPlayers.chris],
      },
    ],
    scores: [
      { scoreA: 11, scoreB: 8 },
      { scoreA: 11, scoreB: 6 },
    ],
    location: "Dev Court A",
    scheduledAt: new Date("2026-06-05T19:00:00+09:00"),
    completedAt: new Date("2026-06-05T20:10:00+09:00"),
    createdAt: new Date("2026-06-05T18:00:00+09:00"),
    updatedAt: new Date("2026-06-05T20:10:00+09:00"),
  },
  {
    id: "dev-match-ladder-002",
    type: "singles",
    creatorPlayerId: mockPlayers.alice.id,
    status: "created",
    teams: [
      {
        id: "dev-team-alice",
        name: "Alice",
        players: [mockPlayers.alice],
      },
      {
        id: "dev-team-admin",
        name: "Admin",
        players: [mockPlayers.admin],
      },
    ],
    scores: [],
    location: "Dev Court B",
    scheduledAt: new Date("2026-06-07T09:30:00+09:00"),
    completedAt: null,
    createdAt: new Date("2026-06-06T13:20:00+09:00"),
    updatedAt: new Date("2026-06-06T13:20:00+09:00"),
  },
  {
    id: "dev-match-cancelled-003",
    type: "mixed-doubles",
    creatorPlayerId: mockPlayers.bob.id,
    status: "cancelled",
    teams: [
      {
        id: "dev-team-north",
        name: "North Court",
        players: [mockPlayers.bob, mockPlayers.admin],
      },
      {
        id: "dev-team-south",
        name: "South Court",
        players: [mockPlayers.alice, mockPlayers.chris],
      },
    ],
    scores: [],
    location: "Dev Court C",
    scheduledAt: new Date("2026-06-08T20:00:00+09:00"),
    completedAt: null,
    createdAt: new Date("2026-06-07T10:00:00+09:00"),
    updatedAt: new Date("2026-06-07T18:10:00+09:00"),
  },
];

/**
 * MatchRepository - 경기 데이터 저장소
 *
 * 모든 경기의 CRUD 작업을 담당합니다.
 */
export class MatchRepository {
  /** ID로 단일 경기 조회 */
  async findById(matchId: string): Promise<Match | undefined> {
    const match = mockMatches.find((item) => item.id === matchId);
    return match ? cloneMatch(match) : undefined;
  }

  /** 신규 경기 추가 */
  async create(
    match: Omit<Match, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ): Promise<Match> {
    const now = new Date();
    const nextMatch: Match = {
      ...match,
      id: match.id ?? `match-${Date.now()}`,
      teams: [cloneTeam(match.teams[0]), cloneTeam(match.teams[1])],
      scores: cloneScores(match.scores),
      scheduledAt: new Date(match.scheduledAt),
      completedAt: match.completedAt ? new Date(match.completedAt) : null,
      createdAt: now,
      updatedAt: now,
    };

    mockMatches.unshift(nextMatch);
    return cloneMatch(nextMatch);
  }

  /** 특정 플레이어의 경기 이력 조회 */
  async findByPlayerId(
    playerId: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ matches: Match[]; total: number }> {
    const filteredMatches = mockMatches.filter((match) =>
      match.teams.some((team) =>
        team.players.some((player) => player.id === playerId),
      ),
    );

    const start = page * limit;
    const pagedMatches = filteredMatches
      .slice(start, start + limit)
      .map(cloneMatch);

    return {
      matches: pagedMatches,
      total: filteredMatches.length,
    };
  }

  /** 모든 경기 목록 */
  async findAll(
    page: number = 0,
    limit: number = 20,
  ): Promise<{ matches: Match[]; total: number }> {
    const start = page * limit;
    const pagedMatches = mockMatches.slice(start, start + limit).map(cloneMatch);

    return {
      matches: pagedMatches,
      total: mockMatches.length,
    };
  }
}
