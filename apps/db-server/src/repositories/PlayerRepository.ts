import {
  normalizeStoredPlayerDupr,
  serializeStoredPlayerDupr,
  shouldStorePlayerDuprAsNull,
  type Player,
  type PlayerDupr,
  type PlayerStatus,
  type StoredPlayerDupr,
} from "@pkpkdupr/shared/player";
import { desc, eq } from "drizzle-orm";
import { players } from "../db/schema";

export interface StoredPlayerRecord extends Player {
  passwordHash: string;
  isFirstLogin: boolean;
}

export interface CreateStoredPlayerInput {
  id: string;
  username: string;
  duprRating: PlayerDupr | null;
  gender: "M" | "F";
  status: PlayerStatus;
  avatarUrl?: string | null;
  passwordHash: string;
  isFirstLogin: boolean;
  createdAt: Date;
  updatedAt: Date;
  duprState?: StoredPlayerDupr;
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
    const { duprState, ...storedData } = data;
    const duprRating = duprState
      ? serializeStoredPlayerDupr(duprState)
      : shouldStorePlayerDuprAsNull(storedData.duprRating)
        ? null
        : serializeStoredPlayerDupr(
            normalizeStoredPlayerDupr(storedData.duprRating),
          );

    await this.db.insert(players).values({
      ...storedData,
      avatarUrl: storedData.avatarUrl ?? null,
      duprRating,
      createdAt: new Date(storedData.createdAt),
      updatedAt: new Date(storedData.updatedAt),
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

  async updateProfile(
    id: string,
    data: { avatarUrl?: string | null },
  ): Promise<StoredPlayerRecord | undefined> {
    await this.db
      .update(players)
      .set({ avatarUrl: data.avatarUrl ?? null, updatedAt: new Date() })
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

  async updateDuprState(
    id: string,
    duprState: StoredPlayerDupr,
  ): Promise<StoredPlayerRecord | undefined> {
    await this.db
      .update(players)
      .set({
        duprRating: serializeStoredPlayerDupr(duprState),
        updatedAt: new Date(),
      })
      .where(eq(players.id, id));
    return await this.findById(id);
  }

  async clearDuprState(id: string): Promise<StoredPlayerRecord | undefined> {
    await this.db
      .update(players)
      .set({
        duprRating: null,
        updatedAt: new Date(),
      })
      .where(eq(players.id, id));
    return await this.findById(id);
  }
}
