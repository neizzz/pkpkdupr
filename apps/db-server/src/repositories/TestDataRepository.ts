import type { PlayerDupr } from "@pkpkdupr/shared/player";
import { and, eq } from "drizzle-orm";
import {
  matchParticipants,
  matchResultApprovals,
  matchSessions,
  matches,
  matchScores,
  playerCreationLogs,
  playerRatingChangeLogs,
  playerStatusChangeLogs,
} from "../db/schema";
import type { CreatePlayerCreationLogInput } from "./PlayerCreationLogRepository";
import { PlayerCreationLogRepository } from "./PlayerCreationLogRepository";
import type { CreatePlayerStatusChangeLogInput } from "./PlayerStatusChangeLogRepository";
import { PlayerStatusChangeLogRepository } from "./PlayerStatusChangeLogRepository";
import type { CreateStoredPlayerInput } from "./PlayerRepository";
import { PlayerRepository } from "./PlayerRepository";

const DEV_PASSWORD_HASH =
  "$2b$10$YwUchh/fxRAeCFxtLM5QW.YsBqK3BvgFBkEM2AxPHaaNnpaB62aEW"; // dev1234
const TEST_PASSWORD_HASH =
  "$2b$10$GISrPxsWRYCfWRrsnRBbu.iTuxCX6hsJ4UiKDmqVNmSYahHTK1hQq"; // test123qwe

const createDupr = (seed: number): PlayerDupr => ({
  singles: seed - 0.013,
  doubles: seed + 0.004,
});

const devPlayerIdByLegacyId: Record<string, string> = {
  "dev-player-alice": "Pdev0001",
  "dev-player-bob": "Pdev0002",
  "dev-player-cara": "Pdev0003",
  "dev-player-dana": "Pdev0004",
  "dev-player-ella": "Pdev0005",
  "dev-player-finn": "Pdev0006",
  "dev-player-gabe": "Pdev0007",
  "dev-player-hugo": "Pdev0008",
  "dev-player-chris": "Pdev0009",
};

const devMatchIdByLegacyId: Record<string, string> = {
  "dev-match-open-play-001": "Mdev0001",
  "dev-match-ladder-002": "Mdev0002",
  "dev-session-open-play-001": "Mdev0003",
  "dev-session-open-play-002": "Mdev0004",
  "dev-session-open-play-003": "Mdev0005",
};

const toDevPlayerId = (id: string) => devPlayerIdByLegacyId[id] ?? id;
const toDevMatchId = (id: string) => devMatchIdByLegacyId[id] ?? id;
const DEV_OPEN_PLAY_SESSION_ID = "Sdev0001";

const mockPlayers: CreateStoredPlayerInput[] = [
  {
    id: "dev-player-alice",
    username: "dev_alice",
    gender: "F",
    status: "active",
    duprRating: createDupr(3.62),
    passwordHash: DEV_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-06-01T09:00:00+09:00"),
    updatedAt: new Date("2026-06-01T09:00:00+09:00"),
  },
  {
    id: "dev-player-bob",
    username: "dev_bob",
    gender: "M",
    status: "active",
    duprRating: createDupr(4.11),
    passwordHash: DEV_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-06-02T10:30:00+09:00"),
    updatedAt: new Date("2026-06-02T10:30:00+09:00"),
  },
  {
    id: "dev-player-cara",
    username: "dev_cara",
    gender: "F",
    status: "active",
    duprRating: createDupr(3.49),
    passwordHash: DEV_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-06-02T11:00:00+09:00"),
    updatedAt: new Date("2026-06-02T11:00:00+09:00"),
  },
  {
    id: "dev-player-dana",
    username: "dev_dana",
    gender: "F",
    status: "active",
    duprRating: createDupr(3.77),
    passwordHash: DEV_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-06-02T11:30:00+09:00"),
    updatedAt: new Date("2026-06-02T11:30:00+09:00"),
  },
  {
    id: "dev-player-ella",
    username: "dev_ella",
    gender: "F",
    status: "active",
    duprRating: createDupr(3.92),
    passwordHash: DEV_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-06-02T12:00:00+09:00"),
    updatedAt: new Date("2026-06-02T12:00:00+09:00"),
  },
  {
    id: "dev-player-finn",
    username: "dev_finn",
    gender: "M",
    status: "active",
    duprRating: createDupr(4.05),
    passwordHash: DEV_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-06-02T12:30:00+09:00"),
    updatedAt: new Date("2026-06-02T12:30:00+09:00"),
  },
  {
    id: "dev-player-gabe",
    username: "dev_gabe",
    gender: "M",
    status: "active",
    duprRating: createDupr(3.86),
    passwordHash: DEV_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-06-02T13:00:00+09:00"),
    updatedAt: new Date("2026-06-02T13:00:00+09:00"),
  },
  {
    id: "dev-player-hugo",
    username: "dev_hugo",
    gender: "M",
    status: "active",
    duprRating: createDupr(4.21),
    passwordHash: DEV_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-06-02T13:30:00+09:00"),
    updatedAt: new Date("2026-06-02T13:30:00+09:00"),
  },
  {
    id: "dev-player-chris",
    username: "dev_chris_inactive",
    gender: "M",
    status: "inactive",
    duprRating: createDupr(2.98),
    passwordHash: DEV_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-06-03T14:15:00+09:00"),
    updatedAt: new Date("2026-06-04T08:45:00+09:00"),
  },
  {
    id: "Ptest001",
    username: "test1",
    gender: "F",
    status: "active",
    duprRating: createDupr(3.176),
    passwordHash: TEST_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-07-20T09:00:00+09:00"),
    updatedAt: new Date("2026-07-21T19:10:00+09:00"),
  },
  {
    id: "Ptest002",
    username: "test2",
    gender: "M",
    status: "active",
    duprRating: createDupr(3.482),
    passwordHash: TEST_PASSWORD_HASH,
    isFirstLogin: false,
    createdAt: new Date("2026-07-18T09:00:00+09:00"),
    updatedAt: new Date("2026-07-22T20:15:00+09:00"),
  },
];

const mockCreationLogs: CreatePlayerCreationLogInput[] = mockPlayers.map(
  (player) => ({
    id: `dev-creation-log-${player.id}`,
    playerId: player.id,
    createdByPlayerId: null,
    createdByUsername: "dev-seed",
    creationSource: "admin_register",
    createdAt: player.createdAt,
  }),
);

const mockStatusLogs: CreatePlayerStatusChangeLogInput[] = [
  {
    id: "dev-status-log-chris-inactive",
    playerId: "dev-player-chris",
    previousStatus: "active",
    nextStatus: "inactive",
    changedByPlayerId: "dev-player-alice",
    changedByUsername: "dev-seed",
    changedAt: new Date("2026-06-04T08:45:00+09:00"),
  },
];

const mockMatches = [
  {
    id: "dev-match-open-play-001",
    type: "mixed-doubles",
    source: "player_created",
    creatorPlayerId: "dev-player-alice",
    status: "completed",
    location: "Dev Court A",
    matchStartsAt: new Date("2026-06-05T19:00:00+09:00"),
    completedAt: new Date("2026-06-05T20:10:00+09:00"),
    resultSubmittedByPlayerId: "dev-player-alice",
    resultSubmittedAt: new Date("2026-06-05T20:05:00+09:00"),
    createdAt: new Date("2026-06-05T18:00:00+09:00"),
    updatedAt: new Date("2026-06-05T20:10:00+09:00"),
  },
  {
    id: "dev-match-ladder-002",
    type: "singles",
    source: "player_created",
    creatorPlayerId: "dev-player-alice",
    status: "created",
    location: "Dev Court B",
    matchStartsAt: new Date("2026-06-07T09:30:00+09:00"),
    completedAt: null,
    resultSubmittedByPlayerId: null,
    resultSubmittedAt: null,
    createdAt: new Date("2026-06-06T13:20:00+09:00"),
    updatedAt: new Date("2026-06-06T13:20:00+09:00"),
  },
  {
    id: "dev-session-open-play-001",
    type: "mixed-doubles",
    source: "admin_created_result",
    creatorPlayerId: "dev-player-alice",
    sessionId: DEV_OPEN_PLAY_SESSION_ID,
    sessionName: "일요일 오픈 플레이",
    sessionDate: new Date("2026-07-19T09:00:00+09:00"),
    status: "completed",
    location: "Dev Court A",
    matchStartsAt: new Date("2026-07-19T09:00:00+09:00"),
    completedAt: new Date("2026-07-19T09:25:00+09:00"),
    resultSubmittedByPlayerId: "dev-player-alice",
    resultSubmittedAt: new Date("2026-07-19T09:25:00+09:00"),
    createdAt: new Date("2026-07-19T08:40:00+09:00"),
    updatedAt: new Date("2026-07-19T09:25:00+09:00"),
  },
  {
    id: "dev-session-open-play-002",
    type: "mixed-doubles",
    source: "admin_created_result",
    creatorPlayerId: "dev-player-bob",
    sessionId: DEV_OPEN_PLAY_SESSION_ID,
    sessionName: "일요일 오픈 플레이",
    sessionDate: new Date("2026-07-19T09:00:00+09:00"),
    status: "completed",
    location: "Dev Court B",
    matchStartsAt: new Date("2026-07-19T09:35:00+09:00"),
    completedAt: new Date("2026-07-19T10:00:00+09:00"),
    resultSubmittedByPlayerId: "dev-player-bob",
    resultSubmittedAt: new Date("2026-07-19T10:00:00+09:00"),
    createdAt: new Date("2026-07-19T08:41:00+09:00"),
    updatedAt: new Date("2026-07-19T10:00:00+09:00"),
  },
  {
    id: "dev-session-open-play-003",
    type: "mixed-doubles",
    source: "admin_created_result",
    creatorPlayerId: "dev-player-alice",
    sessionId: DEV_OPEN_PLAY_SESSION_ID,
    sessionName: "일요일 오픈 플레이",
    sessionDate: new Date("2026-07-19T09:00:00+09:00"),
    status: "completed",
    location: "Dev Court C",
    matchStartsAt: new Date("2026-07-19T10:10:00+09:00"),
    completedAt: new Date("2026-07-19T10:35:00+09:00"),
    resultSubmittedByPlayerId: "dev-player-alice",
    resultSubmittedAt: new Date("2026-07-19T10:35:00+09:00"),
    createdAt: new Date("2026-07-19T08:42:00+09:00"),
    updatedAt: new Date("2026-07-19T10:35:00+09:00"),
  },
  {
    id: "Mtest001",
    type: "mixed-doubles",
    source: "player_created",
    creatorPlayerId: "Ptest001",
    status: "completed",
    location: "Dev Court A",
    matchStartsAt: new Date("2026-07-21T18:30:00+09:00"),
    completedAt: new Date("2026-07-21T19:10:00+09:00"),
    resultSubmittedByPlayerId: "Ptest001",
    resultSubmittedAt: new Date("2026-07-21T19:10:00+09:00"),
    createdAt: new Date("2026-07-21T18:00:00+09:00"),
    updatedAt: new Date("2026-07-21T19:10:00+09:00"),
  },
  {
    id: "Mtest002",
    type: "mixed-doubles",
    source: "player_created",
    creatorPlayerId: "Ptest002",
    status: "completed",
    location: "Dev Court B",
    matchStartsAt: new Date("2026-07-20T19:00:00+09:00"),
    completedAt: new Date("2026-07-20T19:45:00+09:00"),
    resultSubmittedByPlayerId: "Ptest002",
    resultSubmittedAt: new Date("2026-07-20T19:45:00+09:00"),
    createdAt: new Date("2026-07-20T18:30:00+09:00"),
    updatedAt: new Date("2026-07-20T19:45:00+09:00"),
  },
  {
    id: "Mtest003",
    type: "mixed-doubles",
    source: "player_created",
    creatorPlayerId: "Ptest002",
    status: "completed",
    location: "Dev Court C",
    matchStartsAt: new Date("2026-07-22T19:30:00+09:00"),
    completedAt: new Date("2026-07-22T20:15:00+09:00"),
    resultSubmittedByPlayerId: "Ptest002",
    resultSubmittedAt: new Date("2026-07-22T20:15:00+09:00"),
    createdAt: new Date("2026-07-22T19:00:00+09:00"),
    updatedAt: new Date("2026-07-22T20:15:00+09:00"),
  },
];

const mockMatchScores = [
  {
    id: "dev-match-score-open-play-001-game-1",
    matchId: "dev-match-open-play-001",
    scoreA: 11,
    scoreB: 8,
  },
  {
    id: "dev-match-score-open-play-001-game-2",
    matchId: "dev-match-open-play-001",
    scoreA: 11,
    scoreB: 6,
  },
  {
    id: "dev-session-open-play-001-game-1",
    matchId: "dev-session-open-play-001",
    scoreA: 11,
    scoreB: 7,
  },
  {
    id: "dev-session-open-play-002-game-1",
    matchId: "dev-session-open-play-002",
    scoreA: 8,
    scoreB: 11,
  },
  {
    id: "dev-session-open-play-003-game-1",
    matchId: "dev-session-open-play-003",
    scoreA: 11,
    scoreB: 9,
  },
  {
    id: "Mtest001-score-1",
    matchId: "Mtest001",
    scoreA: 11,
    scoreB: 8,
  },
  {
    id: "Mtest002-score-1",
    matchId: "Mtest002",
    scoreA: 11,
    scoreB: 9,
  },
  {
    id: "Mtest003-score-1",
    matchId: "Mtest003",
    scoreA: 8,
    scoreB: 11,
  },
];

const mockMatchParticipants = [
  {
    id: "dev-match-open-play-001-team-0-alice",
    matchId: "dev-match-open-play-001",
    teamIndex: 0,
    playerId: "dev-player-alice",
  },
  {
    id: "dev-match-open-play-001-team-0-bob",
    matchId: "dev-match-open-play-001",
    teamIndex: 0,
    playerId: "dev-player-bob",
  },
  {
    id: "dev-match-open-play-001-team-1-cara",
    matchId: "dev-match-open-play-001",
    teamIndex: 1,
    playerId: "dev-player-cara",
  },
  {
    id: "dev-match-open-play-001-team-1-finn",
    matchId: "dev-match-open-play-001",
    teamIndex: 1,
    playerId: "dev-player-finn",
  },
  {
    id: "dev-match-ladder-002-team-0-alice",
    matchId: "dev-match-ladder-002",
    teamIndex: 0,
    playerId: "dev-player-alice",
  },
  {
    id: "dev-match-ladder-002-team-1-hugo",
    matchId: "dev-match-ladder-002",
    teamIndex: 1,
    playerId: "dev-player-hugo",
  },
  {
    id: "dev-session-open-play-001-team-0-alice",
    matchId: "dev-session-open-play-001",
    teamIndex: 0,
    playerId: "dev-player-alice",
  },
  {
    id: "dev-session-open-play-001-team-0-bob",
    matchId: "dev-session-open-play-001",
    teamIndex: 0,
    playerId: "dev-player-bob",
  },
  {
    id: "dev-session-open-play-001-team-1-cara",
    matchId: "dev-session-open-play-001",
    teamIndex: 1,
    playerId: "dev-player-cara",
  },
  {
    id: "dev-session-open-play-001-team-1-finn",
    matchId: "dev-session-open-play-001",
    teamIndex: 1,
    playerId: "dev-player-finn",
  },
  {
    id: "dev-session-open-play-002-team-0-bob",
    matchId: "dev-session-open-play-002",
    teamIndex: 0,
    playerId: "dev-player-bob",
  },
  {
    id: "dev-session-open-play-002-team-0-gabe",
    matchId: "dev-session-open-play-002",
    teamIndex: 0,
    playerId: "dev-player-gabe",
  },
  {
    id: "dev-session-open-play-002-team-1-dana",
    matchId: "dev-session-open-play-002",
    teamIndex: 1,
    playerId: "dev-player-dana",
  },
  {
    id: "dev-session-open-play-002-team-1-hugo",
    matchId: "dev-session-open-play-002",
    teamIndex: 1,
    playerId: "dev-player-hugo",
  },
  {
    id: "dev-session-open-play-003-team-0-alice",
    matchId: "dev-session-open-play-003",
    teamIndex: 0,
    playerId: "dev-player-alice",
  },
  {
    id: "dev-session-open-play-003-team-0-ella",
    matchId: "dev-session-open-play-003",
    teamIndex: 0,
    playerId: "dev-player-ella",
  },
  {
    id: "dev-session-open-play-003-team-1-finn",
    matchId: "dev-session-open-play-003",
    teamIndex: 1,
    playerId: "dev-player-finn",
  },
  {
    id: "dev-session-open-play-003-team-1-gabe",
    matchId: "dev-session-open-play-003",
    teamIndex: 1,
    playerId: "dev-player-gabe",
  },
  {
    id: "Mtest001-team-0-Ptest001",
    matchId: "Mtest001",
    teamIndex: 0,
    playerId: "Ptest001",
  },
  {
    id: "Mtest001-team-0-alice",
    matchId: "Mtest001",
    teamIndex: 0,
    playerId: "dev-player-alice",
  },
  {
    id: "Mtest001-team-1-bob",
    matchId: "Mtest001",
    teamIndex: 1,
    playerId: "dev-player-bob",
  },
  {
    id: "Mtest001-team-1-cara",
    matchId: "Mtest001",
    teamIndex: 1,
    playerId: "dev-player-cara",
  },
  {
    id: "Mtest002-team-0-Ptest002",
    matchId: "Mtest002",
    teamIndex: 0,
    playerId: "Ptest002",
  },
  {
    id: "Mtest002-team-0-dana",
    matchId: "Mtest002",
    teamIndex: 0,
    playerId: "dev-player-dana",
  },
  {
    id: "Mtest002-team-1-finn",
    matchId: "Mtest002",
    teamIndex: 1,
    playerId: "dev-player-finn",
  },
  {
    id: "Mtest002-team-1-hugo",
    matchId: "Mtest002",
    teamIndex: 1,
    playerId: "dev-player-hugo",
  },
  {
    id: "Mtest003-team-0-Ptest002",
    matchId: "Mtest003",
    teamIndex: 0,
    playerId: "Ptest002",
  },
  {
    id: "Mtest003-team-0-ella",
    matchId: "Mtest003",
    teamIndex: 0,
    playerId: "dev-player-ella",
  },
  {
    id: "Mtest003-team-1-bob",
    matchId: "Mtest003",
    teamIndex: 1,
    playerId: "dev-player-bob",
  },
  {
    id: "Mtest003-team-1-gabe",
    matchId: "Mtest003",
    teamIndex: 1,
    playerId: "dev-player-gabe",
  },
];

const mockMatchResultApprovals = [
  "dev-player-alice",
  "dev-player-bob",
  "dev-player-cara",
  "dev-player-finn",
].map((playerId) => ({
  id: `dev-match-open-play-001-approval-${playerId}`,
  matchId: "dev-match-open-play-001",
  playerId,
  approvedAt: new Date("2026-06-05T20:10:00+09:00"),
}));

interface MockRatingChangeLog {
  id: string;
  playerId: string;
  source: "match_completed";
  sourceLogId: string;
  previousRating: PlayerDupr;
  nextRating: PlayerDupr;
  delta: PlayerDupr;
  createdAt: Date;
}

interface TestRatingHistoryFixture {
  matchId: string;
  playerId: "Ptest001" | "Ptest002";
  playedAt: Date;
  scoreA: number;
  scoreB: number;
  previousDoubles: number;
  nextDoubles: number;
}

interface RatingHistoryFixture {
  matchId: string;
  playedAt: Date;
  scoreA: number;
  scoreB: number;
  previousDoubles: number;
  nextDoubles: number;
}

const TEST_ACCOUNT_USERNAME = "test";

const mockPlayerRatingChangeLogs: MockRatingChangeLog[] = [
  {
    id: "dev-rating-test1-001",
    playerId: "Ptest001",
    source: "match_completed" as const,
    sourceLogId: "match-completed-Mtest001-test1",
    previousRating: { singles: 3.152, doubles: 3.154 },
    nextRating: { singles: 3.152, doubles: 3.18 },
    delta: { singles: 0, doubles: 0.026 },
    createdAt: new Date("2026-07-21T19:10:00+09:00"),
  },
  {
    id: "dev-rating-test2-001",
    playerId: "Ptest002",
    source: "match_completed" as const,
    sourceLogId: "match-completed-Mtest002-test2",
    previousRating: { singles: 3.469, doubles: 3.445 },
    nextRating: { singles: 3.469, doubles: 3.472 },
    delta: { singles: 0, doubles: 0.027 },
    createdAt: new Date("2026-07-20T19:45:00+09:00"),
  },
  {
    id: "dev-rating-test2-002",
    playerId: "Ptest002",
    source: "match_completed" as const,
    sourceLogId: "match-completed-Mtest003-test2",
    previousRating: { singles: 3.469, doubles: 3.472 },
    nextRating: { singles: 3.469, doubles: 3.486 },
    delta: { singles: 0, doubles: 0.014 },
    createdAt: new Date("2026-07-22T20:15:00+09:00"),
  },
];

const additionalTestRatingFixtures: TestRatingHistoryFixture[] = [
  {
    matchId: "Mtest004",
    playerId: "Ptest001",
    playedAt: new Date("2026-07-16T19:10:00+09:00"),
    scoreA: 11,
    scoreB: 8,
    previousDoubles: 3.14,
    nextDoubles: 3.158,
  },
  {
    matchId: "Mtest005",
    playerId: "Ptest001",
    playedAt: new Date("2026-07-17T19:20:00+09:00"),
    scoreA: 8,
    scoreB: 11,
    previousDoubles: 3.158,
    nextDoubles: 3.145,
  },
  {
    matchId: "Mtest006",
    playerId: "Ptest001",
    playedAt: new Date("2026-07-19T19:00:00+09:00"),
    scoreA: 11,
    scoreB: 9,
    previousDoubles: 3.145,
    nextDoubles: 3.166,
  },
  {
    matchId: "Mtest007",
    playerId: "Ptest002",
    playedAt: new Date("2026-07-17T20:00:00+09:00"),
    scoreA: 11,
    scoreB: 7,
    previousDoubles: 3.425,
    nextDoubles: 3.44,
  },
  {
    matchId: "Mtest008",
    playerId: "Ptest002",
    playedAt: new Date("2026-07-18T20:10:00+09:00"),
    scoreA: 11,
    scoreB: 9,
    previousDoubles: 3.44,
    nextDoubles: 3.461,
  },
  {
    matchId: "Mtest009",
    playerId: "Ptest002",
    playedAt: new Date("2026-07-19T20:20:00+09:00"),
    scoreA: 7,
    scoreB: 11,
    previousDoubles: 3.461,
    nextDoubles: 3.449,
  },
];

const namedTestAccountRatingFixtures: RatingHistoryFixture[] = [
  {
    matchId: "Mhist001",
    playedAt: new Date("2026-07-16T19:10:00+09:00"),
    scoreA: 11,
    scoreB: 8,
    previousDoubles: 3,
    nextDoubles: 3.022,
  },
  {
    matchId: "Mhist002",
    playedAt: new Date("2026-07-17T19:20:00+09:00"),
    scoreA: 8,
    scoreB: 11,
    previousDoubles: 3.022,
    nextDoubles: 2.987,
  },
  {
    matchId: "Mhist003",
    playedAt: new Date("2026-07-18T19:00:00+09:00"),
    scoreA: 11,
    scoreB: 9,
    previousDoubles: 2.987,
    nextDoubles: 3.041,
  },
  {
    matchId: "Mhist004",
    playedAt: new Date("2026-07-19T19:10:00+09:00"),
    scoreA: 9,
    scoreB: 11,
    previousDoubles: 3.041,
    nextDoubles: 3.012,
  },
  {
    matchId: "Mhist005",
    playedAt: new Date("2026-07-23T19:20:00+09:00"),
    scoreA: 11,
    scoreB: 7,
    previousDoubles: 3.012,
    nextDoubles: 3,
  },
];

const isUniqueConstraintError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE") || message.includes("unique");
};

export class TestDataRepository {
  constructor(
    private db: any,
    private client: any,
    private playerRepository: PlayerRepository,
    private playerCreationLogRepository: PlayerCreationLogRepository,
    private playerStatusChangeLogRepository: PlayerStatusChangeLogRepository,
  ) {}

  async seedDevMockData() {
    for (const player of mockPlayers) {
      const existing = await this.playerRepository.findByUsername(
        player.username,
      );
      if (!existing) {
        await this.playerRepository.create({
          ...player,
          id: toDevPlayerId(player.id),
        });
      } else {
        await this.playerRepository.updatePassword(
          existing.id,
          player.passwordHash,
          player.isFirstLogin,
        );
      }
    }

    for (const log of mockCreationLogs) {
      await this.createCreationLogIfMissing({
        ...log,
        playerId: toDevPlayerId(log.playerId),
        createdByPlayerId: log.createdByPlayerId
          ? toDevPlayerId(log.createdByPlayerId)
          : null,
      });
    }

    for (const log of mockStatusLogs) {
      await this.createStatusLogIfMissing({
        ...log,
        playerId: toDevPlayerId(log.playerId),
        changedByPlayerId: toDevPlayerId(log.changedByPlayerId),
      });
    }

    const openPlaySessionId = await this.createSessionIfMissing({
      id: DEV_OPEN_PLAY_SESSION_ID,
      name: "일요일 오픈 플레이",
      date: new Date("2026-07-19T09:00:00+09:00"),
      location: "Dev Court A",
      createdAt: new Date("2026-07-19T08:40:00+09:00"),
      updatedAt: new Date("2026-07-19T08:40:00+09:00"),
    });

    for (const match of mockMatches) {
      await this.createMatchIfMissing(
        {
          ...match,
          id: toDevMatchId(match.id),
          creatorPlayerId: toDevPlayerId(match.creatorPlayerId),
          sessionId:
            match.sessionId === DEV_OPEN_PLAY_SESSION_ID
              ? openPlaySessionId
              : match.sessionId,
          resultSubmittedByPlayerId: match.resultSubmittedByPlayerId
            ? toDevPlayerId(match.resultSubmittedByPlayerId)
            : null,
        } as (typeof mockMatches)[number],
      );
    }

    for (const score of mockMatchScores) {
      await this.createMatchScoreIfMissing({
        ...score,
        matchId: toDevMatchId(score.matchId),
      });
    }

    for (const participant of mockMatchParticipants) {
      await this.createMatchParticipantIfMissing({
        ...participant,
        matchId: toDevMatchId(participant.matchId),
        playerId: toDevPlayerId(participant.playerId),
      });
    }

    for (const approval of mockMatchResultApprovals) {
      await this.createMatchResultApprovalIfMissing({
        ...approval,
        matchId: toDevMatchId(approval.matchId),
        playerId: toDevPlayerId(approval.playerId),
      });
    }

    for (const log of mockPlayerRatingChangeLogs) {
      await this.createRatingChangeLogIfMissing(log);
    }

    await this.seedAdditionalTestRatingHistory();
    await this.seedNamedTestAccountRatingHistory();
  }

  private async seedAdditionalTestRatingHistory() {
    for (const fixture of additionalTestRatingFixtures) {
      await this.seedRatingHistoryMatch(fixture.playerId, fixture);
    }
  }

  private async seedNamedTestAccountRatingHistory() {
    const testAccount = await this.playerRepository.findByUsername(
      TEST_ACCOUNT_USERNAME,
    );
    if (!testAccount) return;

    for (const fixture of namedTestAccountRatingFixtures) {
      await this.seedRatingHistoryMatch(testAccount.id, fixture);
    }

    const latestFixture = namedTestAccountRatingFixtures.at(-1);
    if (!latestFixture) return;

    await this.playerRepository.updateDuprState(testAccount.id, {
      rating: {
        singles: 3.038,
        doubles: latestFixture.nextDoubles,
      },
      metrics: {
        singles: { confidence: 1, accuracy: null },
        doubles: { confidence: 1, accuracy: null },
      },
    });
  }

  private async seedRatingHistoryMatch(
    playerId: string,
    fixture: RatingHistoryFixture,
  ) {
    await this.createMatchIfMissing(
      {
        id: fixture.matchId,
        type: "mixed-doubles",
        source: "player_created",
        creatorPlayerId: playerId,
        status: "completed",
        location: "Dev Court History",
        matchStartsAt: fixture.playedAt,
        completedAt: fixture.playedAt,
        resultSubmittedByPlayerId: playerId,
        resultSubmittedAt: fixture.playedAt,
        createdAt: fixture.playedAt,
        updatedAt: fixture.playedAt,
      } as (typeof mockMatches)[number],
    );
    await this.createMatchScoreIfMissing({
      id: `${fixture.matchId}-score-1`,
      matchId: fixture.matchId,
      scoreA: fixture.scoreA,
      scoreB: fixture.scoreB,
    });

    const participants = [
      { teamIndex: 0, playerId },
      { teamIndex: 0, playerId: "Pdev0001" },
      { teamIndex: 1, playerId: "Pdev0002" },
      { teamIndex: 1, playerId: "Pdev0003" },
    ] as const;
    for (const participant of participants) {
      await this.createMatchParticipantIfMissing({
        id: `${fixture.matchId}-team-${participant.teamIndex}-${participant.playerId}`,
        matchId: fixture.matchId,
        teamIndex: participant.teamIndex,
        playerId: participant.playerId,
      });
    }

    await this.createRatingChangeLogIfMissing({
      id: `dev-rating-${fixture.matchId.toLowerCase()}`,
      playerId,
      source: "match_completed",
      sourceLogId: `match-completed-${fixture.matchId}-test`,
      previousRating: { singles: 3.038, doubles: fixture.previousDoubles },
      nextRating: { singles: 3.038, doubles: fixture.nextDoubles },
      delta: { singles: 0, doubles: fixture.nextDoubles - fixture.previousDoubles },
      createdAt: fixture.playedAt,
    });
  }

  private async createSessionIfMissing(
    data: typeof matchSessions.$inferInsert,
  ): Promise<string> {
    const existingByMetadata = await this.db
      .select()
      .from(matchSessions)
      .where(
        and(
          eq(matchSessions.name, data.name),
          eq(matchSessions.date, data.date),
        ),
      )
      .get();
    if (existingByMetadata) return existingByMetadata.id;

    const existingById = await this.db
      .select()
      .from(matchSessions)
      .where(eq(matchSessions.id, data.id))
      .get();
    if (existingById) return existingById.id;

    await this.db.insert(matchSessions).values(data);
    return data.id;
  }

  private async createCreationLogIfMissing(data: CreatePlayerCreationLogInput) {
    const existing = await this.db
      .select()
      .from(playerCreationLogs)
      .where(eq(playerCreationLogs.id, data.id))
      .get();
    if (existing) {
      return;
    }

    try {
      await this.playerCreationLogRepository.create(data);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  private async createStatusLogIfMissing(
    data: CreatePlayerStatusChangeLogInput,
  ) {
    const existing = await this.db
      .select()
      .from(playerStatusChangeLogs)
      .where(eq(playerStatusChangeLogs.id, data.id))
      .get();
    if (existing) {
      return;
    }

    try {
      await this.playerStatusChangeLogRepository.create(data);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  private async createMatchIfMissing(data: (typeof mockMatches)[number]) {
    const existing = await this.db
      .select()
      .from(matches)
      .where(eq(matches.id, data.id))
      .get();
    if (existing) {
      return;
    }

    try {
      await this.db.insert(matches).values(data);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  private async createMatchScoreIfMissing(
    data: (typeof mockMatchScores)[number],
  ) {
    const existing = await this.db
      .select()
      .from(matchScores)
      .where(eq(matchScores.id, data.id))
      .get();
    if (existing) {
      return;
    }

    try {
      await this.insertMatchScore(data);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  private async insertMatchScore(data: (typeof mockMatchScores)[number]) {
    const result = await this.client.execute(`PRAGMA table_info(match_scores)`);
    const columns = new Set(
      result.rows.map((row: { name?: unknown }) => String(row.name)),
    );
    const insertColumns = ["id", "match_id"];
    const args: Array<string | number> = [data.id, data.matchId];
    const addColumn = (column: string, value: number) => {
      if (!columns.has(column)) {
        return;
      }
      insertColumns.push(column);
      args.push(value);
    };

    addColumn("score_a", data.scoreA);
    addColumn("score_b", data.scoreB);
    addColumn("team_a", data.scoreA);
    addColumn("team_b", data.scoreB);
    addColumn("t_b", data.scoreB);

    await this.client.execute({
      sql: `INSERT INTO match_scores (${insertColumns.join(", ")}) VALUES (${insertColumns.map(() => "?").join(", ")})`,
      args,
    });
  }

  private async createMatchParticipantIfMissing(
    data: (typeof mockMatchParticipants)[number],
  ) {
    const existingById = await this.db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.id, data.id))
      .get();
    if (existingById) {
      return;
    }

    const existingByParticipant = await this.db
      .select()
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, data.matchId),
          eq(matchParticipants.teamIndex, data.teamIndex),
          eq(matchParticipants.playerId, data.playerId),
        ),
      )
      .get();
    if (existingByParticipant) {
      return;
    }

    try {
      await this.db.insert(matchParticipants).values(data);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  private async createMatchResultApprovalIfMissing(
    data: (typeof mockMatchResultApprovals)[number],
  ) {
    const existingById = await this.db
      .select()
      .from(matchResultApprovals)
      .where(eq(matchResultApprovals.id, data.id))
      .get();
    if (existingById) {
      return;
    }

    const existingByApproval = await this.db
      .select()
      .from(matchResultApprovals)
      .where(
        and(
          eq(matchResultApprovals.matchId, data.matchId),
          eq(matchResultApprovals.playerId, data.playerId),
        ),
      )
      .get();
    if (existingByApproval) {
      return;
    }

    try {
      await this.db.insert(matchResultApprovals).values(data);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  private async createRatingChangeLogIfMissing(
    data: MockRatingChangeLog,
  ) {
    const existing = await this.db
      .select()
      .from(playerRatingChangeLogs)
      .where(eq(playerRatingChangeLogs.id, data.id))
      .get();
    if (existing) {
      return;
    }

    await this.db.insert(playerRatingChangeLogs).values({
      id: data.id,
      playerId: data.playerId,
      source: data.source,
      sourceLogId: data.sourceLogId,
      previousRatingJson: JSON.stringify(data.previousRating),
      nextRatingJson: JSON.stringify(data.nextRating),
      deltaJson: JSON.stringify(data.delta),
      createdAt: data.createdAt,
    });
  }
}

export const isDevMockDataEnabled = () =>
  process.env.ENABLE_DEV_MOCK_DATA === "true";

export const getDevMockUsernames = () =>
  mockPlayers.map(({ username, status }) => ({ username, status }));
