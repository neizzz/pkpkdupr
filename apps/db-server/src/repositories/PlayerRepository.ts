import type { Player, PlayerDupr, PlayerStatus } from "@pkpkdupr/shared/player";
import { desc, eq } from "drizzle-orm";
import { players } from "../db/schema";

export interface StoredPlayerRecord extends Player {
  passwordHash: string;
  isFirstLogin: boolean;
}

export interface CreateStoredPlayerInput {
  id: string;
  username: string;
  duprRating: PlayerDupr;
  gender: "M" | "F";
  status: PlayerStatus;
  passwordHash: string;
  isFirstLogin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PlayerRepository {
  constructor(private db: any) {}

  async findById(id: string): Promise<StoredPlayerRecord | undefined> {
    return await this.db.select().from(players).where(eq(players.id, id)).get();
  }

  async findByUsername(username: string): Promise<StoredPlayerRecord | undefined> {
    return await this.db
      .select()
      .from(players)
      .where(eq(players.username, username))
      .get();
  }

  async findAll(): Promise<StoredPlayerRecord[]> {
    return await this.db.select().from(players).orderBy(desc(players.createdAt)).all();
  }

  async create(data: CreateStoredPlayerInput): Promise<StoredPlayerRecord> {
    await this.db.insert(players).values({
      ...data,
      duprRating: JSON.stringify(data.duprRating),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });
    const created = await this.findById(data.id);
    if (!created) {
      throw new Error("플레이어 생성에 실패했습니다.");
    }
    return created;
  }

  async updateStatus(id: string, status: PlayerStatus): Promise<StoredPlayerRecord | undefined> {
    await this.db
      .update(players)
      .set({ status, updatedAt: new Date() })
      .where(eq(players.id, id));
    return await this.findById(id);
  }

  async updatePassword(
    id: string,
    passwordHash: string,
    isFirstLogin: boolean,
  ): Promise<StoredPlayerRecord | undefined> {
    await this.db
      .update(players)
      .set({ passwordHash, isFirstLogin, updatedAt: new Date() })
      .where(eq(players.id, id));
    return await this.findById(id);
  }

  async initAdminIfMissing(data: CreateStoredPlayerInput): Promise<StoredPlayerRecord> {
    const existing = await this.findByUsername(data.username);
    if (existing) {
      return existing;
    }
    return await this.create(data);
  }
}
