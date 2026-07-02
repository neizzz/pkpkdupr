import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { matchTypeValues } from "@pkpkdupr/shared/match";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  duprRating: text("dupr_rating").notNull(),
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

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  type: text("type", { enum: matchTypeValues }).notNull(),
  status: text("status").notNull(),
  location: text("location").notNull(),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
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
