import {
  boolean,
  customType,
  double,
  int,
  index,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  DEFAULT_MATCH_MODE,
  matchModeValues,
  matchSourceValues,
  matchTypeValues,
} from "@pkpkdupr/shared/match";

/**
 * The SQLite database persisted timestamps as Unix seconds. Keep that storage
 * contract during the engine migration while exposing Date objects to the
 * repositories just as the previous libSQL schema did.
 */
const unixTimestamp = customType<{ data: Date; driverData: number | string }>({
  dataType: () => "BIGINT",
  toDriver: (value) => Math.floor(value.getTime() / 1000),
  fromDriver: (value) => new Date(Number(value) * 1000),
});

const id = (name: string) => varchar(name, { length: 255 });

export const players = mysqlTable("players", {
  id: id("id").primaryKey(),
  username: varchar("username", { length: 191 }).notNull().unique(),
  duprRating: text("dupr_rating"),
  gender: varchar("gender", { length: 8 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  avatarUrl: text("avatar_url"),
  affiliationsJson: text("affiliations_json"),
  statusMessage: text("status_message"),
  statusMessageBackgroundColor: varchar("status_message_background_color", {
    length: 32,
  }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isFirstLogin: boolean("is_first_login").notNull(),
  createdAt: unixTimestamp("created_at").notNull(),
  updatedAt: unixTimestamp("updated_at").notNull(),
});

export const playerAuthIdentities = mysqlTable(
  "player_auth_identities",
  {
    id: id("id").primaryKey(),
    playerId: id("player_id").notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    createdAt: unixTimestamp("created_at").notNull(),
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex(
      "player_auth_identities_provider_subject_unique",
    ).on(table.provider, table.subject),
    playerProviderUnique: uniqueIndex(
      "player_auth_identities_player_provider_unique",
    ).on(table.playerId, table.provider),
  }),
);

export const oauthLoginTransactions = mysqlTable(
  "oauth_login_transactions",
  {
    id: id("id").primaryKey(),
    provider: varchar("provider", { length: 32 }).notNull(),
    stateHash: varchar("state_hash", { length: 128 }).notNull(),
    handoffHash: varchar("handoff_hash", { length: 128 }),
    registrationHash: varchar("registration_hash", { length: 128 }),
    providerSubject: varchar("provider_subject", { length: 255 }),
    expiresAt: unixTimestamp("expires_at").notNull(),
    stateConsumedAt: unixTimestamp("state_consumed_at"),
    handoffConsumedAt: unixTimestamp("handoff_consumed_at"),
    registrationConsumedAt: unixTimestamp("registration_consumed_at"),
    createdAt: unixTimestamp("created_at").notNull(),
  },
  (table) => ({
    stateHashUnique: uniqueIndex("oauth_login_transactions_state_hash_unique").on(
      table.stateHash,
    ),
    handoffHashUnique: uniqueIndex(
      "oauth_login_transactions_handoff_hash_unique",
    ).on(table.handoffHash),
    registrationHashUnique: uniqueIndex(
      "oauth_login_transactions_registration_hash_unique",
    ).on(table.registrationHash),
  }),
);

export const playerCreationLogs = mysqlTable("player_creation_logs", {
  id: id("id").primaryKey(),
  playerId: id("player_id").notNull(),
  createdByPlayerId: id("created_by_player_id"),
  createdByUsername: varchar("created_by_username", { length: 191 }).notNull(),
  creationSource: varchar("creation_source", { length: 64 }).notNull(),
  createdAt: unixTimestamp("created_at").notNull(),
});

export const playerStatusChangeLogs = mysqlTable("player_status_change_logs", {
  id: id("id").primaryKey(),
  playerId: id("player_id").notNull(),
  previousStatus: varchar("previous_status", { length: 32 }).notNull(),
  nextStatus: varchar("next_status", { length: 32 }).notNull(),
  changedByPlayerId: id("changed_by_player_id").notNull(),
  changedByUsername: varchar("changed_by_username", { length: 191 }).notNull(),
  changedAt: unixTimestamp("changed_at").notNull(),
});

export const playerRatingChangeLogs = mysqlTable("player_rating_change_logs", {
  id: id("id").primaryKey(),
  playerId: id("player_id").notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  sourceLogId: id("source_log_id").notNull(),
  previousRatingJson: text("previous_rating_json").notNull(),
  nextRatingJson: text("next_rating_json").notNull(),
  deltaJson: text("delta_json").notNull(),
  createdAt: unixTimestamp("created_at").notNull(),
});

/**
 * 프로필 차트 전용 materialized view입니다. 원본 평점 로그는
 * playerRatingChangeLogs에 유지하고, 이 테이블은 최대 90일의 압축된 지점만
 * 보관합니다.
 */
export const playerRatingChartProjections = mysqlTable(
  "player_rating_chart_projections",
  {
    playerId: id("player_id").primaryKey(),
    generatedAt: unixTimestamp("generated_at").notNull(),
  },
);

export const playerRatingChartPoints = mysqlTable(
  "player_rating_chart_points",
  {
    id: id("id").primaryKey(),
    playerId: id("player_id").notNull(),
    category: varchar("category", { length: 16 }).notNull(),
    rating: double("rating").notNull(),
    source: varchar("source", { length: 16 }).notNull(),
    pointAt: unixTimestamp("point_at").notNull(),
    generatedAt: unixTimestamp("generated_at").notNull(),
  },
  (table) => ({
    playerCategoryPointIndex: index(
      "player_rating_chart_points_player_category_point_at_idx",
    ).on(table.playerId, table.category, table.pointAt),
  }),
);

export const matches = mysqlTable("matches", {
  id: id("id").primaryKey(),
  type: varchar("type", { length: 32, enum: matchTypeValues }).notNull(),
  mode: varchar("mode", { length: 32, enum: matchModeValues })
    .notNull()
    .default(DEFAULT_MATCH_MODE),
  source: varchar("source", { length: 32, enum: matchSourceValues })
    .notNull()
    .default("player_created"),
  creatorPlayerId: id("creator_player_id").notNull(),
  name: varchar("name", { length: 255 }),
  sessionId: id("session_id"),
  sessionName: varchar("session_name", { length: 255 }),
  sessionDate: unixTimestamp("session_date"),
  status: varchar("status", { length: 32 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  courtName: varchar("court_name", { length: 255 }),
  matchStartsAt: unixTimestamp("match_starts_at").notNull(),
  completedAt: unixTimestamp("completed_at"),
  resultSubmittedByPlayerId: id("result_submitted_by_player_id"),
  resultSubmittedAt: unixTimestamp("result_submitted_at"),
  autoApprovalDueAt: unixTimestamp("auto_approval_due_at"),
  autoApprovedAt: unixTimestamp("auto_approved_at"),
  autoApprovalRatingAppliedAt: unixTimestamp("auto_approval_rating_applied_at"),
  createdAt: unixTimestamp("created_at").notNull(),
  updatedAt: unixTimestamp("updated_at").notNull(),
});

export const matchSessions = mysqlTable(
  "match_sessions",
  {
    id: id("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    date: unixTimestamp("date").notNull(),
    location: varchar("location", { length: 255 }).notNull(),
    clubId: id("club_id"),
    createdAt: unixTimestamp("created_at").notNull(),
    updatedAt: unixTimestamp("updated_at").notNull(),
  },
  (table) => ({
    nameDateUnique: uniqueIndex("match_sessions_name_date_unique").on(
      table.name,
      table.date,
    ),
  }),
);

export const clubs = mysqlTable(
  "clubs",
  {
    id: id("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    createdByPlayerId: id("created_by_player_id").notNull(),
    createdAt: unixTimestamp("created_at").notNull(),
    updatedAt: unixTimestamp("updated_at").notNull(),
  },
  (table) => ({
    nameUnique: uniqueIndex("clubs_name_unique").on(table.name),
  }),
);

export const clubMemberships = mysqlTable(
  "club_memberships",
  {
    id: id("id").primaryKey(),
    clubId: id("club_id").notNull(),
    playerId: id("player_id").notNull(),
    role: varchar("role", { length: 16 }).notNull(),
    joinedAt: unixTimestamp("joined_at").notNull(),
    createdAt: unixTimestamp("created_at").notNull(),
    updatedAt: unixTimestamp("updated_at").notNull(),
  },
  (table) => ({
    clubPlayerUnique: uniqueIndex("club_memberships_club_player_unique").on(
      table.clubId,
      table.playerId,
    ),
    playerIndex: index("club_memberships_player_id_idx").on(table.playerId),
  }),
);

export const clubJoinRequests = mysqlTable(
  "club_join_requests",
  {
    id: id("id").primaryKey(),
    clubId: id("club_id").notNull(),
    playerId: id("player_id").notNull(),
    requestedAt: unixTimestamp("requested_at").notNull(),
  },
  (table) => ({
    clubPlayerUnique: uniqueIndex("club_join_requests_club_player_unique").on(
      table.clubId,
      table.playerId,
    ),
    clubIndex: index("club_join_requests_club_id_idx").on(table.clubId),
  }),
);

export const clubAnnouncements = mysqlTable(
  "club_announcements",
  {
    id: id("id").primaryKey(),
    clubId: id("club_id").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    createdByPlayerId: id("created_by_player_id").notNull(),
    createdAt: unixTimestamp("created_at").notNull(),
    updatedAt: unixTimestamp("updated_at").notNull(),
  },
  (table) => ({
    clubCreatedAtIndex: index("club_announcements_club_created_at_idx").on(
      table.clubId,
      table.createdAt,
    ),
  }),
);

export const clubInvites = mysqlTable(
  "club_invites",
  {
    id: id("id").primaryKey(),
    clubId: id("club_id").notNull(),
    token: varchar("token", { length: 128 }).notNull(),
    createdAt: unixTimestamp("created_at").notNull(),
    revokedAt: unixTimestamp("revoked_at"),
  },
  (table) => ({
    tokenUnique: uniqueIndex("club_invites_token_unique").on(table.token),
    clubIndex: index("club_invites_club_id_idx").on(table.clubId),
  }),
);

export const matchSessionParticipants = mysqlTable(
  "match_session_participants",
  {
    id: id("id").primaryKey(),
    sessionId: id("session_id").notNull(),
    playerId: id("player_id").notNull(),
    createdAt: unixTimestamp("created_at").notNull(),
  },
  (table) => ({
    sessionPlayerUnique: uniqueIndex(
      "match_session_participants_session_player_unique",
    ).on(table.sessionId, table.playerId),
  }),
);

export const matchScores = mysqlTable("match_scores", {
  id: id("id").primaryKey(),
  matchId: id("match_id").notNull(),
  scoreA: int("score_a").notNull(),
  scoreB: int("score_b").notNull(),
});

export const matchParticipants = mysqlTable("match_participants", {
  id: id("id").primaryKey(),
  matchId: id("match_id").notNull(),
  teamIndex: int("team_index").notNull(),
  playerId: id("player_id").notNull(),
  duprRatingJson: text("dupr_rating_json"),
});

export const matchResultApprovals = mysqlTable("match_result_approvals", {
  id: id("id").primaryKey(),
  matchId: id("match_id").notNull(),
  playerId: id("player_id").notNull(),
  approvedAt: unixTimestamp("approved_at").notNull(),
});

export const officialDuprAdjustmentLogs = mysqlTable(
  "official_dupr_adjustment_logs",
  {
    id: id("id").primaryKey(),
    playerId: id("player_id").notNull(),
    changedByPlayerId: id("changed_by_player_id").notNull(),
    changedByUsername: varchar("changed_by_username", { length: 191 }).notNull(),
    ratingsJson: text("ratings_json").notNull(),
    confidenceJson: text("confidence_json").notNull(),
    previousRatingJson: text("previous_rating_json").notNull(),
    nextRatingJson: text("next_rating_json").notNull(),
    preUpdateAccuracyJson: text("pre_update_accuracy_json").notNull(),
    reason: text("reason"),
    createdAt: unixTimestamp("created_at").notNull(),
  },
);
