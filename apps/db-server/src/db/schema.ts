import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Player 테이블
export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  duprRating: integer('dupr_rating').notNull(),
  gender: text('gender').notNull(), // 'M' | 'F'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Match 테이블
export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'Singles' | 'Doubles'
  status: text('status').notNull(), // 'completed' 등
  location: text('location').notNull(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// MatchScore 테이블 (간략화)
export const matchScores = sqliteTable('match_scores', {
    id: text('id').primaryKey(),
    matchId: text('match_id').notNull(),
    teamA: integer('team_a').notNull(),
    teamB: integer('t_b').notNull(),
});
