import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import {
  DEFAULT_MATCH_MODE,
  matchModeValues,
  matchSourceValues,
  matchTypeValues,
} from "@pkpkdupr/shared/match";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  duprRating: text("dupr_rating"),
  gender: text("gender").notNull(),
  status: text("status").notNull(),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash").notNull(),
  isFirstLogin: integer("is_first_login", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const playerCreationLogs = sqliteTable("player_creation_logs", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull(),
  createdByPlayerId: text("created_by_player_id"),
  createdByUsername: text("created_by_username").notNull(),
  creationSource: text("creation_source").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const playerStatusChangeLogs = sqliteTable("player_status_change_logs", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull(),
  previousStatus: text("previous_status").notNull(),
  nextStatus: text("next_status").notNull(),
  changedByPlayerId: text("changed_by_player_id").notNull(),
  changedByUsername: text("changed_by_username").notNull(),
  changedAt: integer("changed_at", { mode: "timestamp" }).notNull(),
});

export const playerRatingChangeLogs = sqliteTable("player_rating_change_logs", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull(),
  source: text("source").notNull(),
  sourceLogId: text("source_log_id").notNull(),
  previousRatingJson: text("previous_rating_json").notNull(),
  nextRatingJson: text("next_rating_json").notNull(),
  deltaJson: text("delta_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  type: text("type", { enum: matchTypeValues }).notNull(),
  mode: text("mode", { enum: matchModeValues })
    .notNull()
    .default(DEFAULT_MATCH_MODE),
  source: text("source", { enum: matchSourceValues })
    .notNull()
    .default("player_created"),
  creatorPlayerId: text("creator_player_id").notNull(),
  name: text("name"),
  sessionName: text("session_name"),
  sessionDate: integer("session_date", { mode: "timestamp" }),
  status: text("status").notNull(),
  location: text("location").notNull(),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
  matchStartsAt: integer("match_starts_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  resultSubmittedByPlayerId: text("result_submitted_by_player_id"),
  resultSubmittedAt: integer("result_submitted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const matchScores = sqliteTable("match_scores", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  scoreA: integer("score_a").notNull(),
  scoreB: integer("score_b").notNull(),
});

export const matchParticipants = sqliteTable("match_participants", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  teamIndex: integer("team_index").notNull(),
  playerId: text("player_id").notNull(),
  duprRatingJson: text("dupr_rating_json"),
});

export const matchResultApprovals = sqliteTable("match_result_approvals", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  playerId: text("player_id").notNull(),
  approvedAt: integer("approved_at", { mode: "timestamp" }).notNull(),
});

export const officialDuprAdjustmentLogs = sqliteTable(
  "official_dupr_adjustment_logs",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id").notNull(),
    changedByPlayerId: text("changed_by_player_id").notNull(),
    changedByUsername: text("changed_by_username").notNull(),
    ratingsJson: text("ratings_json").notNull(),
    confidenceJson: text("confidence_json").notNull(),
    previousRatingJson: text("previous_rating_json").notNull(),
    nextRatingJson: text("next_rating_json").notNull(),
    preUpdateAccuracyJson: text("pre_update_accuracy_json").notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
);
