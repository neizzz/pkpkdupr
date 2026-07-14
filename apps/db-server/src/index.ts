import express from "express";
import { DEFAULT_MATCH_MODE } from "@pkpkdupr/shared/match";
import {
  normalizeStoredPlayerDupr,
  shouldStorePlayerDuprAsNull,
} from "@pkpkdupr/shared/player";
import { getDb, getDbClient } from "./db/client";
import { PlayerRepository, type CreateStoredPlayerInput } from "./repositories/PlayerRepository";
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

const safeExec = async (sql: string) => {
  try {
    await client.execute(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("duplicate column name") ||
      message.includes("already exists")
    ) {
      return;
    }
    throw error;
  }
};

const getTableInfo = async (tableName: string) => {
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  return result.rows as Array<Record<string, unknown>>;
};

const hasColumn = async (tableName: string, columnName: string) => {
  const rows = await getTableInfo(tableName);
  return rows.some((row) => String(row.name) === columnName);
};

const ensurePlayersDuprRatingNullable = async () => {
  const duprColumn = (await getTableInfo("players")).find(
    (row) => String(row.name) === "dupr_rating",
  );
  if (!duprColumn || Number(duprColumn.notnull ?? 0) === 0) {
    return;
  }

  await client.execute(`DROP TABLE IF EXISTS players_notnull_dupr_backup`);
  await client.execute(`ALTER TABLE players RENAME TO players_notnull_dupr_backup`);
  await client.execute(`
    CREATE TABLE players (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      dupr_rating TEXT,
      gender TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      avatar_url TEXT,
      password_hash TEXT NOT NULL DEFAULT '',
      is_first_login INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  await client.execute(`
    INSERT INTO players (
      id,
      username,
      dupr_rating,
      gender,
      status,
      avatar_url,
      password_hash,
      is_first_login,
      created_at,
      updated_at
    )
    SELECT
      id,
      username,
      dupr_rating,
      gender,
      status,
      avatar_url,
      password_hash,
      is_first_login,
      created_at,
      updated_at
    FROM players_notnull_dupr_backup
  `);
  await client.execute(`DROP TABLE players_notnull_dupr_backup`);
};

const initSchema = async () => {
  await client.execute(`
	    CREATE TABLE IF NOT EXISTS players (
	      id TEXT PRIMARY KEY,
	      username TEXT NOT NULL UNIQUE,
	      dupr_rating TEXT,
	      gender TEXT NOT NULL,
	      status TEXT NOT NULL DEFAULT 'active',
      avatar_url TEXT,
      password_hash TEXT NOT NULL DEFAULT '',
      is_first_login INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await safeExec(`ALTER TABLE players ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
  await safeExec(`ALTER TABLE players ADD COLUMN avatar_url TEXT`);
  await safeExec(`ALTER TABLE players ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`);
  await safeExec(`ALTER TABLE players ADD COLUMN is_first_login INTEGER NOT NULL DEFAULT 1`);
  await ensurePlayersDuprRatingNullable();
  await client.execute(`UPDATE players SET status = 'inactive' WHERE status = 'deleted'`);
  await client.execute(`UPDATE players SET status = 'active' WHERE status IS NULL OR status = ''`);

  await client.execute(`
    UPDATE players
    SET dupr_rating = '{"total":' ||
      CASE WHEN trim(CAST(dupr_rating AS TEXT)) = '' THEN '1000' ELSE CAST(dupr_rating AS TEXT) END ||
      ',"doubles":{"mixed":' ||
      CASE WHEN trim(CAST(dupr_rating AS TEXT)) = '' THEN '1000' ELSE CAST(dupr_rating AS TEXT) END ||
      ',"men":' ||
      CASE WHEN trim(CAST(dupr_rating AS TEXT)) = '' THEN '1000' ELSE CAST(dupr_rating AS TEXT) END ||
      ',"women":' ||
      CASE WHEN trim(CAST(dupr_rating AS TEXT)) = '' THEN '1000' ELSE CAST(dupr_rating AS TEXT) END ||
      '},"singles":' ||
      CASE WHEN trim(CAST(dupr_rating AS TEXT)) = '' THEN '1000' ELSE CAST(dupr_rating AS TEXT) END ||
      '}'
    WHERE typeof(dupr_rating) IN ('integer', 'real')
       OR (typeof(dupr_rating) = 'text' AND trim(dupr_rating) != '' AND substr(trim(dupr_rating), 1, 1) != '{')
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS player_creation_logs (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      created_by_player_id TEXT,
      created_by_username TEXT NOT NULL,
      creation_source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS player_status_change_logs (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      next_status TEXT NOT NULL,
      changed_by_player_id TEXT NOT NULL,
      changed_by_username TEXT NOT NULL,
      changed_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS player_rating_change_logs (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_log_id TEXT NOT NULL,
      previous_rating_json TEXT NOT NULL,
      next_rating_json TEXT NOT NULL,
      delta_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('singles', 'unrestricted-singles', 'mixed-doubles', 'men-doubles', 'women-doubles', 'unrestricted-doubles')),
      mode TEXT NOT NULL DEFAULT '${DEFAULT_MATCH_MODE}' CHECK (mode IN ('single-game', 'best-of-3')),
      source TEXT NOT NULL DEFAULT 'player_created',
      creator_player_id TEXT NOT NULL DEFAULT '',
      name TEXT,
      session_name TEXT,
      session_date INTEGER,
      status TEXT NOT NULL,
      location TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      completed_at INTEGER,
      result_submitted_by_player_id TEXT,
      result_submitted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await safeExec(
    `ALTER TABLE matches ADD COLUMN mode TEXT NOT NULL DEFAULT '${DEFAULT_MATCH_MODE}'`,
  );
  await safeExec(`ALTER TABLE matches ADD COLUMN source TEXT NOT NULL DEFAULT 'player_created'`);
  await safeExec(`ALTER TABLE matches ADD COLUMN creator_player_id TEXT NOT NULL DEFAULT ''`);
  await safeExec(`ALTER TABLE matches ADD COLUMN name TEXT`);
  await safeExec(`ALTER TABLE matches ADD COLUMN session_name TEXT`);
  await safeExec(`ALTER TABLE matches ADD COLUMN session_date INTEGER`);
  await safeExec(`ALTER TABLE matches ADD COLUMN result_submitted_by_player_id TEXT`);
  await safeExec(`ALTER TABLE matches ADD COLUMN result_submitted_at INTEGER`);

  await client.execute(`
    UPDATE matches
    SET type = CASE
      WHEN type = 'Doubles' THEN 'mixed-doubles'
      WHEN type = 'MixedDoubles' THEN 'mixed-doubles'
      WHEN type = 'Mixed Doubles' THEN 'mixed-doubles'
      WHEN type = 'MenDoubles' THEN 'men-doubles'
      WHEN type = 'Men Doubles' THEN 'men-doubles'
      WHEN type = 'WomenDoubles' THEN 'women-doubles'
      WHEN type = 'Women Doubles' THEN 'women-doubles'
      WHEN type = 'Singles' THEN 'singles'
      WHEN type = 'Unrestricted Singles' THEN 'unrestricted-singles'
      WHEN type = 'UnrestrictedSingles' THEN 'unrestricted-singles'
      WHEN type = 'Unrestricted Doubles' THEN 'unrestricted-doubles'
      WHEN type = 'UnrestrictedDoubles' THEN 'unrestricted-doubles'
      WHEN type = 'Unrestricted' THEN 'unrestricted-doubles'
      ELSE type
    END
    WHERE type IN (
      'Doubles',
      'MixedDoubles',
      'Mixed Doubles',
      'MenDoubles',
      'Men Doubles',
      'WomenDoubles',
      'Women Doubles',
      'Singles',
      'Unrestricted Singles',
      'UnrestrictedSingles',
      'Unrestricted Doubles',
      'UnrestrictedDoubles',
      'Unrestricted'
    )
  `);

  await client.execute(`
    UPDATE matches
    SET source = 'player_created'
    WHERE source IS NULL OR trim(source) = ''
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS match_scores (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      score_a INTEGER NOT NULL,
      score_b INTEGER NOT NULL
    )
  `);

  await safeExec(`ALTER TABLE match_scores ADD COLUMN score_a INTEGER`);
  await safeExec(`ALTER TABLE match_scores ADD COLUMN score_b INTEGER`);

  if (await hasColumn("match_scores", "team_a")) {
    await client.execute(`
      UPDATE match_scores
      SET score_a = COALESCE(score_a, team_a)
      WHERE score_a IS NULL
    `);
  }

  if (await hasColumn("match_scores", "t_b")) {
    await client.execute(`
      UPDATE match_scores
      SET score_b = COALESCE(score_b, t_b)
      WHERE score_b IS NULL
    `);
  }

  await client.execute(`
    UPDATE matches
    SET mode = CASE
      WHEN (
        SELECT COUNT(*)
        FROM match_scores
        WHERE match_scores.match_id = matches.id
      ) = 1 THEN 'single-game'
      WHEN mode IS NULL OR trim(mode) = '' OR mode NOT IN ('single-game', 'best-of-3')
        THEN '${DEFAULT_MATCH_MODE}'
      ELSE mode
    END
    WHERE mode IS NULL
       OR trim(mode) = ''
       OR mode NOT IN ('single-game', 'best-of-3')
       OR (
         SELECT COUNT(*)
         FROM match_scores
         WHERE match_scores.match_id = matches.id
       ) = 1
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS match_participants (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      team_index INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      dupr_rating_json TEXT
    )
  `);

  await safeExec(`ALTER TABLE match_participants ADD COLUMN dupr_rating_json TEXT`);

  await client.execute(`
    UPDATE matches
    SET creator_player_id = COALESCE(
      NULLIF(creator_player_id, ''),
      (
        SELECT player_id
        FROM match_participants
        WHERE match_participants.match_id = matches.id
        ORDER BY team_index ASC, id ASC
        LIMIT 1
      ),
      ''
    )
    WHERE creator_player_id IS NULL OR creator_player_id = ''
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS match_result_approvals (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      approved_at INTEGER NOT NULL
    )
  `);

  // Match mutations used raw libSQL statements which stored milliseconds while
  // Drizzle's timestamp columns expect Unix seconds. Repair already-written
  // values once at startup; normal timestamps are far below this threshold.
  await client.execute(`
    UPDATE matches
    SET
      result_submitted_at = CASE
        WHEN result_submitted_at >= 100000000000 THEN result_submitted_at / 1000
        ELSE result_submitted_at
      END,
      completed_at = CASE
        WHEN completed_at >= 100000000000 THEN completed_at / 1000
        ELSE completed_at
      END,
      updated_at = CASE
        WHEN updated_at >= 100000000000 THEN updated_at / 1000
        ELSE updated_at
      END
    WHERE result_submitted_at >= 100000000000
       OR completed_at >= 100000000000
       OR updated_at >= 100000000000
  `);

  await client.execute(`
    UPDATE match_result_approvals
    SET approved_at = approved_at / 1000
    WHERE approved_at >= 100000000000
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS official_dupr_adjustment_logs (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      changed_by_player_id TEXT NOT NULL,
      changed_by_username TEXT NOT NULL,
      ratings_json TEXT NOT NULL,
      confidence_json TEXT NOT NULL,
      previous_rating_json TEXT NOT NULL,
      next_rating_json TEXT NOT NULL,
      pre_update_accuracy_json TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  const storedPlayers = await playerRepository.findAll();
  for (const player of storedPlayers) {
    if (player.duprRating == null) {
      continue;
    }

    if (shouldStorePlayerDuprAsNull(player.duprRating)) {
      await playerRepository.clearDuprState(player.id);
      continue;
    }

    await playerRepository.updateDuprState(
      player.id,
      normalizeStoredPlayerDupr(player.duprRating),
    );
  }
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
    const player = await playerRepository.create(req.body as CreateStoredPlayerInput);
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
    const player = await playerRepository.updateStatus(req.params.id, req.body.status);
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
    const player = await playerRepository.updateGender(req.params.id, req.body.gender);
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
      avatarUrl: req.body.avatarUrl ?? null,
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
    res.status(500).json({ error: (error as Error).message });
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
