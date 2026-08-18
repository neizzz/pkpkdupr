import { generateEntityId } from "@pkpkdupr/shared/entityId";
import { and, eq, or } from "drizzle-orm";
import { playerFriendships } from "../db/schema";

const sortPlayerIds = (left: string, right: string) =>
  left.localeCompare(right) < 0 ? [left, right] : [right, left];

export class FriendRepository {
  constructor(private readonly db: any) {}

  async addFriendship(playerId: string, friendPlayerId: string) {
    if (playerId === friendPlayerId) {
      throw new Error("자기 자신은 친구로 추가할 수 없습니다.");
    }

    const [playerOneId, playerTwoId] = sortPlayerIds(playerId, friendPlayerId);
    const existing = await this.db
      .select()
      .from(playerFriendships)
      .where(
        and(
          eq(playerFriendships.playerOneId, playerOneId),
          eq(playerFriendships.playerTwoId, playerTwoId),
        ),
      )
      .get();
    if (existing) {
      throw new Error("이미 친구로 등록되어 있습니다.");
    }

    const createdAt = new Date();
    await this.db.insert(playerFriendships).values({
      id: generateEntityId("friendship"),
      playerOneId,
      playerTwoId,
      createdAt,
    });

    return { playerId, friendPlayerId, createdAt };
  }

  async listFriendPlayerIds(playerId: string): Promise<string[]> {
    const records = await this.db
      .select()
      .from(playerFriendships)
      .where(
        or(
          eq(playerFriendships.playerOneId, playerId),
          eq(playerFriendships.playerTwoId, playerId),
        ),
      )
      .all();

    return records.map((record: typeof playerFriendships.$inferSelect) =>
      record.playerOneId === playerId ? record.playerTwoId : record.playerOneId,
    );
  }
}
