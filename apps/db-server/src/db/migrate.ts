import { getDbClient } from "./client";

const initialSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(191) NOT NULL UNIQUE,
    dupr_rating TEXT NULL,
    gender VARCHAR(8) NOT NULL,
    status VARCHAR(32) NOT NULL,
    avatar_url TEXT NULL,
    affiliations_json TEXT NULL,
    status_message TEXT NULL,
    status_message_background_color VARCHAR(32) NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_first_login BOOLEAN NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS player_creation_logs (
    id VARCHAR(255) PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    created_by_player_id VARCHAR(255) NULL,
    created_by_username VARCHAR(191) NOT NULL,
    creation_source VARCHAR(64) NOT NULL,
    created_at BIGINT NOT NULL,
    INDEX player_creation_logs_player_id_idx (player_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS player_status_change_logs (
    id VARCHAR(255) PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    previous_status VARCHAR(32) NOT NULL,
    next_status VARCHAR(32) NOT NULL,
    changed_by_player_id VARCHAR(255) NOT NULL,
    changed_by_username VARCHAR(191) NOT NULL,
    changed_at BIGINT NOT NULL,
    INDEX player_status_change_logs_player_id_idx (player_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS player_rating_change_logs (
    id VARCHAR(255) PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    source VARCHAR(64) NOT NULL,
    source_log_id VARCHAR(255) NOT NULL,
    previous_rating_json TEXT NOT NULL,
    next_rating_json TEXT NOT NULL,
    delta_json TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    INDEX player_rating_change_logs_player_id_idx (player_id),
    INDEX player_rating_change_logs_source_log_id_idx (source, source_log_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    mode VARCHAR(32) NOT NULL DEFAULT 'single-game',
    source VARCHAR(32) NOT NULL DEFAULT 'player_created',
    creator_player_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NULL,
    session_id VARCHAR(255) NULL,
    session_name VARCHAR(255) NULL,
    session_date BIGINT NULL,
    status VARCHAR(32) NOT NULL,
    location VARCHAR(255) NOT NULL,
    court_name VARCHAR(255) NULL,
    match_starts_at BIGINT NOT NULL,
    completed_at BIGINT NULL,
    result_submitted_by_player_id VARCHAR(255) NULL,
    result_submitted_at BIGINT NULL,
    auto_approval_due_at BIGINT NULL,
    auto_approved_at BIGINT NULL,
    auto_approval_rating_applied_at BIGINT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    INDEX matches_session_id_idx (session_id),
    INDEX matches_status_auto_approval_due_at_idx (status, auto_approval_due_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS match_sessions (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    \`date\` BIGINT NOT NULL,
    location VARCHAR(255) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY match_sessions_name_date_unique (name, \`date\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS match_session_participants (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    player_id VARCHAR(255) NOT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE KEY match_session_participants_session_player_unique (session_id, player_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS match_scores (
    id VARCHAR(255) PRIMARY KEY,
    match_id VARCHAR(255) NOT NULL,
    score_a INT NOT NULL,
    score_b INT NOT NULL,
    INDEX match_scores_match_id_idx (match_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS match_participants (
    id VARCHAR(255) PRIMARY KEY,
    match_id VARCHAR(255) NOT NULL,
    team_index INT NOT NULL,
    player_id VARCHAR(255) NOT NULL,
    dupr_rating_json TEXT NULL,
    INDEX match_participants_match_id_idx (match_id),
    INDEX match_participants_player_id_idx (player_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS match_result_approvals (
    id VARCHAR(255) PRIMARY KEY,
    match_id VARCHAR(255) NOT NULL,
    player_id VARCHAR(255) NOT NULL,
    approved_at BIGINT NOT NULL,
    UNIQUE KEY match_result_approvals_match_player_unique (match_id, player_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS official_dupr_adjustment_logs (
    id VARCHAR(255) PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    changed_by_player_id VARCHAR(255) NOT NULL,
    changed_by_username VARCHAR(191) NOT NULL,
    ratings_json TEXT NOT NULL,
    confidence_json TEXT NOT NULL,
    previous_rating_json TEXT NOT NULL,
    next_rating_json TEXT NOT NULL,
    pre_update_accuracy_json TEXT NOT NULL,
    reason TEXT NULL,
    created_at BIGINT NOT NULL,
    INDEX official_dupr_adjustment_logs_player_id_idx (player_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const migrations = [
  {
    id: "0000_mysql_initial_schema",
    statements: initialSchemaStatements,
  },
];

export const runMigrations = async () => {
  const client = getDbClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __pkpkdupr_migrations (
      id VARCHAR(191) PRIMARY KEY,
      applied_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  for (const migration of migrations) {
    const existing = await client.execute({
      sql: "SELECT id FROM __pkpkdupr_migrations WHERE id = ?",
      args: [migration.id],
    });
    if (existing.rows.length > 0) continue;

    const transaction = await client.transaction("write");
    try {
      for (const statement of migration.statements) {
        await transaction.execute(statement);
      }
      await transaction.execute({
        sql: "INSERT INTO __pkpkdupr_migrations (id, applied_at) VALUES (?, ?)",
        args: [migration.id, Math.floor(Date.now() / 1000)],
      });
      await transaction.commit();
    } catch (error) {
      transaction.close();
      throw error;
    }
  }
};

if (process.argv[1]?.includes("migrate.")) {
  runMigrations()
    .then(() => console.log("[DB-SERVER] MySQL migrations applied"))
    .catch((error) => {
      console.error("[DB-SERVER] Failed to apply MySQL migrations", error);
      process.exitCode = 1;
    });
}
