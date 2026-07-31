import express from "express";
import { type Session } from "@pkpkdupr/shared/match";
import { isEntityId } from "@pkpkdupr/shared/entityId";
import { getDb, getDbClient } from "./db/client";
import { runMigrations } from "./db/migrate";
import {
  PlayerRepository,
  type CreateStoredPlayerInput,
} from "./repositories/PlayerRepository";
import {
  PlayerCreationLogRepository,
  type CreatePlayerCreationLogInput,
} from "./repositories/PlayerCreationLogRepository";
import {
  PlayerStatusChangeLogRepository,
  type CreatePlayerStatusChangeLogInput,
} from "./repositories/PlayerStatusChangeLogRepository";
import {
  PlayerRatingChangeLogRepository,
  type CreatePlayerRatingChangeLogInput,
} from "./repositories/PlayerRatingChangeLogRepository";
import {
  OfficialDuprAdjustmentLogRepository,
  type CreateOfficialDuprAdjustmentLogInput,
} from "./repositories/OfficialDuprAdjustmentLogRepository";
import {
  CompletedMatchApprovalCancelError,
  CompletedMatchResultEditError,
  MatchRepository,
  SessionHasMatchesError,
  type CreateMatchInput,
  type UpdateMatchMetadataInput,
} from "./repositories/MatchRepository";
import {
  getDevMockUsernames,
  isDevMockDataEnabled,
  TestDataRepository,
} from "./repositories/TestDataRepository";

const app = express();
const port = Number(process.env.PORT || 5001);
const db = getDb();
const client = getDbClient();
const playerRepository = new PlayerRepository(db);
const playerCreationLogRepository = new PlayerCreationLogRepository(db);
const playerStatusChangeLogRepository = new PlayerStatusChangeLogRepository(db);
const playerRatingChangeLogRepository = new PlayerRatingChangeLogRepository(db);
const officialDuprAdjustmentLogRepository =
  new OfficialDuprAdjustmentLogRepository(db);
const matchRepository = new MatchRepository(db, client);
const testDataRepository = new TestDataRepository(
  db,
  client,
  playerRepository,
  playerCreationLogRepository,
  playerStatusChangeLogRepository,
);

app.use(express.json());

const initSchema = async () => {
  await runMigrations();
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "DB Server is running" });
});

app.get("/internal/players", async (_req, res) => {
  try {
    res.json(await playerRepository.findAll());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/players/by-username/:username", async (req, res) => {
  try {
    const player = await playerRepository.findByUsername(req.params.username);
    if (!player) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/players/:id", async (req, res) => {
  try {
    const player = await playerRepository.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/internal/players", async (req, res) => {
  try {
    const player = await playerRepository.create(
      req.body as CreateStoredPlayerInput,
    );
    res.json(player);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return res.status(409).json({ error: "중복된 사용자명입니다." });
    }
    res.status(500).json({ error: message });
  }
});

app.post("/internal/players/init-admin", async (req, res) => {
  try {
    const player = await playerRepository.initAdminIfMissing(
      req.body as CreateStoredPlayerInput,
    );
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch("/internal/players/:id/status", async (req, res) => {
  try {
    const player = await playerRepository.updateStatus(
      req.params.id,
      req.body.status,
    );
    if (!player) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch("/internal/players/:id/gender", async (req, res) => {
  try {
    const player = await playerRepository.updateGender(
      req.params.id,
      req.body.gender,
    );
    if (!player) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch("/internal/players/:id/password", async (req, res) => {
  try {
    const player = await playerRepository.updatePassword(
      req.params.id,
      req.body.passwordHash,
      req.body.isFirstLogin,
    );
    if (!player) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch("/internal/players/:id/profile", async (req, res) => {
  try {
    const player = await playerRepository.updateProfile(req.params.id, {
      ...req.body,
    });
    if (!player) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch("/internal/players/:id/dupr-state", async (req, res) => {
  try {
    const player = await playerRepository.updateDuprState(
      req.params.id,
      req.body.duprState,
    );
    if (!player) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/matches", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 0);
    const limit = Number(req.query.limit ?? 20);
    const playerId =
      typeof req.query.playerId === "string" ? req.query.playerId : undefined;

    res.json(await matchRepository.findAll(page, limit, playerId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/matches/last-played", async (_req, res) => {
  try {
    res.json(await matchRepository.findLastPlayedAtByPlayerId());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/matches/timestamp-unit-audit", async (_req, res) => {
  try {
    res.json(await matchRepository.getTimestampUnitAudit());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/match-feed", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 0);
    const limit = Number(req.query.limit ?? 20);
    const playerId =
      typeof req.query.playerId === "string" ? req.query.playerId : undefined;

    res.json(await matchRepository.findFeed(page, limit, playerId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/internal/match-sessions", async (req, res) => {
  try {
    const session = await matchRepository.createSession({
      ...(req.body as Omit<Session, "date">),
      date: new Date(req.body?.date),
    });
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/internal/match-sessions", async (_req, res) => {
  try {
    res.json(await matchRepository.findSessions());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete("/internal/match-sessions/:sessionId", async (req, res) => {
  try {
    if (!isEntityId(req.params.sessionId, "session")) {
      return res.status(400).json({ error: "유효한 세션 ID가 필요합니다." });
    }
    const deleted = await matchRepository.deleteSession(req.params.sessionId);
    if (!deleted) {
      return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
    }
    res.status(204).send();
  } catch (error) {
    if (error instanceof SessionHasMatchesError) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: (error as Error).message });
  }
});

app.put(
  "/internal/match-sessions/:sessionId/participants",
  async (req, res) => {
    try {
      const playerIds = Array.isArray(req.body?.playerIds)
        ? req.body.playerIds.filter(
            (playerId: unknown): playerId is string =>
              typeof playerId === "string",
          )
        : [];
      const session = await matchRepository.replaceSessionParticipants(
        req.params.sessionId,
        playerIds,
      );
      if (!session) {
        return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
      }
      res.json(session);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  },
);

app.get("/internal/match-sessions/:sessionId/matches", async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    if (!isEntityId(sessionId, "session")) {
      return res
        .status(400)
        .json({ error: "유효한 세션 ID가 필요합니다." });
    }

    res.json(await matchRepository.findBySession(sessionId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/matches/:id", async (req, res) => {
  try {
    const match = await matchRepository.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ error: "매치를 찾을 수 없습니다." });
    }
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/internal/matches", async (req, res) => {
  try {
    const match = await matchRepository.create(req.body as CreateMatchInput);
    res.json(match);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return res.status(409).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

app.post("/internal/matches/batch", async (req, res) => {
  try {
    const inputs = Array.isArray(req.body?.matches)
      ? (req.body.matches as CreateMatchInput[])
      : [];
    if (inputs.length === 0) {
      return res.status(400).json({ error: "한 개 이상의 예정 경기가 필요합니다." });
    }
    res.status(201).json(await matchRepository.createScheduledBatch(inputs));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return res.status(409).json({ error: message });
    }
    res.status(400).json({ error: message });
  }
});

app.patch("/internal/matches/participant-dupr-snapshots", async (req, res) => {
  try {
    const result = await matchRepository.fillMissingParticipantDuprSnapshots(
      Array.isArray(req.body?.snapshots) ? req.body.snapshots : [],
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.patch("/internal/matches/:id/metadata", async (req, res) => {
  try {
    const match = await matchRepository.updateMetadata(
      req.params.id,
      req.body as UpdateMatchMetadataInput,
    );
    if (!match) {
      return res.status(404).json({ error: "매치를 찾을 수 없습니다." });
    }
    res.json(match);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/internal/matches/:id/result", async (req, res) => {
  try {
    const match = await matchRepository.submitResult(
      req.params.id,
      req.body.submittedByPlayerId,
      req.body.scores,
      req.body.approvalId,
      req.body.submittedAt ? new Date(req.body.submittedAt) : new Date(),
    );
    res.json(match);
  } catch (error) {
    if (error instanceof CompletedMatchResultEditError) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/internal/matches/:id/admin-result", async (req, res) => {
  try {
    const match = await matchRepository.recordAdminResult(
      req.params.id,
      req.body.submittedByPlayerId,
      req.body.scores,
      req.body.completedAt ? new Date(req.body.completedAt) : new Date(),
    );
    res.json(match);
  } catch (error) {
    if (error instanceof CompletedMatchResultEditError) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/internal/matches/:id", async (req, res) => {
  try {
    await matchRepository.delete(req.params.id);
    res.status(204).end();
  } catch (error) {
    if ((error as Error).message === "MATCH_NOT_FOUND") {
      return res.status(404).json({ error: "매치를 찾을 수 없습니다." });
    }
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/internal/matches/:id/approvals", async (req, res) => {
  try {
    const match = await matchRepository.approveResult(
      req.params.id,
      req.body.playerId,
      req.body.approvalId,
      req.body.approvedAt ? new Date(req.body.approvedAt) : new Date(),
    );
    res.json(match);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/internal/matches/:id/approvals/:playerId", async (req, res) => {
  try {
    const match = await matchRepository.cancelApproval(
      req.params.id,
      req.params.playerId,
    );
    res.json(match);
  } catch (error) {
    if (error instanceof CompletedMatchApprovalCancelError) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/internal/matches/:id/rejection", async (req, res) => {
  try {
    const match = await matchRepository.rejectResult(
      req.params.id,
      req.body.playerId,
    );
    res.json(match);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/internal/matches/auto-approvals/complete-expired", async (req, res) => {
  try {
    const now = req.body?.now ? new Date(req.body.now) : new Date();
    if (Number.isNaN(now.getTime())) {
      return res.status(400).json({ error: "유효한 자동 합의 처리 시각이 필요합니다." });
    }
    res.json(await matchRepository.completeExpiredAutoApprovals(now));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/internal/matches/auto-approvals/awaiting-rating", async (_req, res) => {
  try {
    res.json(await matchRepository.findAutoApprovedMatchesAwaitingRating());
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post(
  "/internal/matches/:id/auto-approval-rating-applied",
  async (req, res) => {
    try {
      const appliedAt = req.body?.appliedAt
        ? new Date(req.body.appliedAt)
        : new Date();
      if (Number.isNaN(appliedAt.getTime())) {
        return res.status(400).json({ error: "유효한 평점 반영 시각이 필요합니다." });
      }
      await matchRepository.markAutoApprovalRatingApplied(req.params.id, appliedAt);
      res.status(204).end();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  },
);

app.get("/internal/player-creation-logs", async (_req, res) => {
  try {
    res.json(await playerCreationLogRepository.findAll());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/internal/player-creation-logs", async (req, res) => {
  try {
    const log = await playerCreationLogRepository.create(
      req.body as CreatePlayerCreationLogInput,
    );
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/player-status-change-logs", async (_req, res) => {
  try {
    res.json(await playerStatusChangeLogRepository.findAll());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/internal/player-status-change-logs", async (req, res) => {
  try {
    const log = await playerStatusChangeLogRepository.create(
      req.body as CreatePlayerStatusChangeLogInput,
    );
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/player-rating-change-logs", async (_req, res) => {
  try {
    res.json(await playerRatingChangeLogRepository.findAll());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get(
  "/internal/player-rating-change-logs/by-player/:playerId",
  async (req, res) => {
    try {
      const logs = await playerRatingChangeLogRepository.findByPlayerId(
        req.params.playerId,
      );
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);

app.get("/internal/matches/:matchId/rating-change-logs", async (req, res) => {
  try {
    const logs = await playerRatingChangeLogRepository.findByMatchId(
      req.params.matchId,
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/internal/player-rating-change-logs", async (req, res) => {
  try {
    const log = await playerRatingChangeLogRepository.create(
      req.body as CreatePlayerRatingChangeLogInput,
    );
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/internal/player-rating-change-logs/match-completed", async (req, res) => {
  try {
    const logs = Array.isArray(req.body) ? req.body : null;
    if (!logs) {
      return res.status(400).json({ error: "경기 완료 로그 목록이 필요합니다." });
    }

    res.json(
      await playerRatingChangeLogRepository.replaceMatchCompleted(
        logs as CreatePlayerRatingChangeLogInput[],
      ),
    );
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/internal/official-dupr-adjustment-logs", async (_req, res) => {
  try {
    res.json(await officialDuprAdjustmentLogRepository.findAll());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/internal/official-dupr-adjustment-logs", async (req, res) => {
  try {
    const log = await officialDuprAdjustmentLogRepository.create(
      req.body as CreateOfficialDuprAdjustmentLogInput,
    );
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

const start = async () => {
  await initSchema();
  if (isDevMockDataEnabled()) {
    await testDataRepository.seedDevMockData();
    console.log(
      "[DB-SERVER] Dev mock data seeded",
      getDevMockUsernames()
        .map(({ username, status }) => `${username}(${status})`)
        .join(", "),
    );
  }
  app.listen(port, () => {
    console.log(`[DB-SERVER] Listening at http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("[DB-SERVER] Failed to start", error);
  process.exit(1);
});
