import type { PlayerRatingChangeLog } from "@pkpkdupr/shared/player";
import { and, desc, eq, like } from "drizzle-orm";
import { playerRatingChangeLogs } from "../db/schema";

export type CreatePlayerRatingChangeLogInput = PlayerRatingChangeLog;

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

const hydrateLog = (record: any): PlayerRatingChangeLog => ({
  id: record.id,
  playerId: record.playerId,
  source: record.source,
  sourceLogId: record.sourceLogId,
  previousRating: parseJson(record.previousRatingJson),
  nextRating: parseJson(record.nextRatingJson),
  delta: parseJson(record.deltaJson),
  createdAt: new Date(record.createdAt),
});

export class PlayerRatingChangeLogRepository {
  constructor(private db: any) {}

  async create(
    data: CreatePlayerRatingChangeLogInput,
  ): Promise<PlayerRatingChangeLog> {
    await this.db.insert(playerRatingChangeLogs).values({
      id: data.id,
      playerId: data.playerId,
      source: data.source,
      sourceLogId: data.sourceLogId,
      previousRatingJson: JSON.stringify(data.previousRating),
      nextRatingJson: JSON.stringify(data.nextRating),
      deltaJson: JSON.stringify(data.delta),
      createdAt: new Date(data.createdAt),
    });
    const created = await this.db
      .select()
      .from(playerRatingChangeLogs)
      .where(eq(playerRatingChangeLogs.id, data.id))
      .get();

    if (!created) {
      throw new Error("점수 변동 로그 저장에 실패했습니다.");
    }
    return hydrateLog(created);
  }

  async findAll(): Promise<PlayerRatingChangeLog[]> {
    const rows = await this.db
      .select()
      .from(playerRatingChangeLogs)
      .orderBy(desc(playerRatingChangeLogs.createdAt))
      .all();
    return rows.map(hydrateLog);
  }

  async findByMatchId(matchId: string): Promise<PlayerRatingChangeLog[]> {
    const rows = await this.db
      .select()
      .from(playerRatingChangeLogs)
      .where(
        and(
          eq(playerRatingChangeLogs.source, "match_completed"),
          like(
            playerRatingChangeLogs.sourceLogId,
            `match-completed-${matchId}-%`,
          ),
        ),
      )
      .orderBy(desc(playerRatingChangeLogs.createdAt))
      .all();
    return rows.map(hydrateLog);
  }

  async findByPlayerId(playerId: string): Promise<PlayerRatingChangeLog[]> {
    const rows = await this.db
      .select()
      .from(playerRatingChangeLogs)
      .where(eq(playerRatingChangeLogs.playerId, playerId))
      .orderBy(desc(playerRatingChangeLogs.createdAt))
      .all();
    return rows.map(hydrateLog);
  }
}
