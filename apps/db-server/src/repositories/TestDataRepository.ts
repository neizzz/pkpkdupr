import type { PlayerDupr } from "@pkpkdupr/shared/player";
import { eq } from "drizzle-orm";
import {
  matchParticipants,
  matchResultApprovals,
  matches,
  matchScores,
  playerCreationLogs,
  playerStatusChangeLogs,
} from "../db/schema";
import type { CreatePlayerCreationLogInput } from "./PlayerCreationLogRepository";
import { PlayerCreationLogRepository } from "./PlayerCreationLogRepository";
import type { CreatePlayerStatusChangeLogInput } from "./PlayerStatusChangeLogRepository";
import { PlayerStatusChangeLogRepository } from "./PlayerStatusChangeLogRepository";
import type { CreateStoredPlayerInput } from "./PlayerRepository";
import { PlayerRepository } from "./PlayerRepository";

const DEV_PASSWORD_HASH =
  "$2b$10$sb/ySae/JFHbDN/fcXLG5eZLskOjzt6Od1X5LiaYBt8KJ2wtQn2QS"; // dev1234

const createDupr = (total: number): PlayerDupr => ({
  total,
  doubles: {
    mixed: total + 0.012,
    men: total - 0.008,
    women: total + 0.004,
  },
  singles: total - 0.016,
});

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
    changedByPlayerId: "dev-seed-system",
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
    scheduledAt: new Date("2026-06-05T19:00:00+09:00"),
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
    scheduledAt: new Date("2026-06-07T09:30:00+09:00"),
    completedAt: null,
    resultSubmittedByPlayerId: null,
    resultSubmittedAt: null,
    createdAt: new Date("2026-06-06T13:20:00+09:00"),
    updatedAt: new Date("2026-06-06T13:20:00+09:00"),
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
      const existing = await this.playerRepository.findByUsername(player.username);
      if (!existing) {
        await this.playerRepository.create(player);
      }
    }

    for (const log of mockCreationLogs) {
      await this.createCreationLogIfMissing(log);
    }

    for (const log of mockStatusLogs) {
      await this.createStatusLogIfMissing(log);
    }

    for (const match of mockMatches) {
      await this.createMatchIfMissing(match);
    }

    for (const score of mockMatchScores) {
      await this.createMatchScoreIfMissing(score);
    }

    for (const participant of mockMatchParticipants) {
      await this.createMatchParticipantIfMissing(participant);
    }

    for (const approval of mockMatchResultApprovals) {
      await this.createMatchResultApprovalIfMissing(approval);
    }
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

  private async createStatusLogIfMissing(data: CreatePlayerStatusChangeLogInput) {
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
    const existing = await this.db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.id, data.id))
      .get();
    if (existing) {
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
    const existing = await this.db
      .select()
      .from(matchResultApprovals)
      .where(eq(matchResultApprovals.id, data.id))
      .get();
    if (existing) {
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
}

export const isDevMockDataEnabled = () =>
  process.env.ENABLE_DEV_MOCK_DATA === "true";

export const getDevMockUsernames = () =>
  mockPlayers.map(({ username, status }) => ({ username, status }));
