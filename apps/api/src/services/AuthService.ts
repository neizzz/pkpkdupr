import {
  Player,
  PlayerCreationLog,
  PlayerCreationSource,
  PlayerDupr,
  PlayerStatus,
  PlayerStatusChangeLog,
} from "@pkpkdupr/shared/player";
import bcrypt from "bcryptjs";
import { createAccessToken, JWT_SECRET } from "../config/jwt";

const SALT_ROUNDS = 10;
const DB_SERVER_URL = process.env.DB_SERVER_URL || "http://localhost:5001";

interface StoredPlayerRecord extends Player {
  passwordHash: string;
  isFirstLogin: boolean;
}

interface DbRequestOptions extends RequestInit {
  retries?: number;
}

export interface UserCredentials {
  username: string;
  password: string;
  gender: "M" | "F";
}

const buildId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultDupr = (seed: number = 1000): PlayerDupr => ({
  total: seed,
  doubles: {
    mixed: seed,
    men: seed,
    women: seed,
  },
  singles: seed,
});

const createPlayer = (input: Pick<Player, "username" | "gender">): Player => {
  const now = new Date();

  return {
    id: buildId("player"),
    username: input.username,
    duprRating: createDefaultDupr(),
    gender: input.gender,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
};

const toDate = (value: string | Date) => new Date(value);

const normalizeDuprRating = (value: unknown): PlayerDupr => {
  if (typeof value === "number") {
    return createDefaultDupr(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return createDefaultDupr();
    }

    if (trimmed.startsWith("{")) {
      try {
        return normalizeDuprRating(JSON.parse(trimmed));
      } catch {
        return createDefaultDupr();
      }
    }

    const parsedNumber = Number(trimmed);
    if (!Number.isNaN(parsedNumber)) {
      return createDefaultDupr(parsedNumber);
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const doubles = (record.doubles ?? {}) as Record<string, unknown>;

    return {
      total: Number(record.total ?? 1000),
      doubles: {
        mixed: Number(doubles.mixed ?? record.total ?? 1000),
        men: Number(doubles.men ?? record.total ?? 1000),
        women: Number(doubles.women ?? record.total ?? 1000),
      },
      singles: Number(record.singles ?? record.total ?? 1000),
    };
  }

  return createDefaultDupr();
};

const hydratePlayer = (record: any): StoredPlayerRecord => ({
  ...record,
  duprRating: normalizeDuprRating(record.duprRating),
  status: record.status === "deleted" ? "inactive" : record.status,
  createdAt: toDate(record.createdAt),
  updatedAt: toDate(record.updatedAt),
});

const hydrateCreationLog = (record: any): PlayerCreationLog => ({
  ...record,
  createdAt: toDate(record.createdAt),
});

const hydrateStatusChangeLog = (record: any): PlayerStatusChangeLog => ({
  ...record,
  previousStatus:
    record.previousStatus === "deleted" ? "inactive" : record.previousStatus,
  nextStatus: record.nextStatus === "deleted" ? "inactive" : record.nextStatus,
  changedAt: toDate(record.changedAt),
});

const groupByPlayerId = <T extends { playerId: string }>(items: T[]) =>
  items.reduce<Record<string, T[]>>((acc, item) => {
    acc[item.playerId] = [...(acc[item.playerId] ?? []), item];
    return acc;
  }, {});

export class AuthService {
  private async dbRequest<T>(
    path: string,
    init?: DbRequestOptions,
  ): Promise<T> {
    const retries = init?.retries ?? 0;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetch(`${DB_SERVER_URL}${path}`, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
          },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || `DB 서버 요청 실패: ${res.status}`,
          );
        }

        if (res.status === 204) {
          return undefined as T;
        }

        return (await res.json()) as T;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * (attempt + 1)),
        );
      }
    }

    throw new Error("DB 서버 요청 실패");
  }

  async verifyToken(accessToken: string): Promise<{ playerId: string }> {
    const decoded = require("jsonwebtoken").verify(accessToken, JWT_SECRET) as {
      playerId: string;
    };
    if (!decoded || !decoded.playerId) {
      throw new Error("Invalid token");
    }
    return decoded;
  }

  private async getStoredPlayerById(
    playerId: string,
  ): Promise<StoredPlayerRecord | undefined> {
    try {
      const player = await this.dbRequest<any>(`/internal/players/${playerId}`);
      return hydratePlayer(player);
    } catch (error) {
      if ((error as Error).message.includes("사용자를 찾을 수 없습니다")) {
        return undefined;
      }
      throw error;
    }
  }

  private async getStoredPlayerByUsername(
    username: string,
  ): Promise<StoredPlayerRecord | undefined> {
    try {
      const player = await this.dbRequest<any>(
        `/internal/players/by-username/${encodeURIComponent(username)}`,
      );
      return hydratePlayer(player);
    } catch (error) {
      if ((error as Error).message.includes("사용자를 찾을 수 없습니다.")) {
        return undefined;
      }
      throw error;
    }
  }

  private async insertCreationLog(input: {
    playerId: string;
    createdByPlayerId: string | null;
    createdByUsername: string;
    creationSource: PlayerCreationSource;
    createdAt: Date;
  }): Promise<PlayerCreationLog> {
    const log = await this.dbRequest<any>("/internal/player-creation-logs", {
      method: "POST",
      body: JSON.stringify({
        id: buildId("player-creation-log"),
        ...input,
      }),
    });
    return hydrateCreationLog(log);
  }

  private async insertStatusChangeLog(input: {
    playerId: string;
    previousStatus: PlayerStatus;
    nextStatus: PlayerStatus;
    changedByPlayerId: string;
    changedByUsername: string;
    changedAt: Date;
  }): Promise<PlayerStatusChangeLog> {
    const log = await this.dbRequest<any>(
      "/internal/player-status-change-logs",
      {
        method: "POST",
        body: JSON.stringify({
          id: buildId("player-status-log"),
          ...input,
        }),
      },
    );
    return hydrateStatusChangeLog(log);
  }

  async register({
    username,
    password,
    gender,
  }: UserCredentials): Promise<
    Player & { accessToken: string; isFirstLogin: boolean }
  > {
    const duplicate = await this.getStoredPlayerByUsername(username);
    if (duplicate) {
      throw new Error("중복된 사용자명입니다.");
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const isAdmin = username === "admin";
    const player = createPlayer({ username, gender });

    const created = await this.dbRequest<any>("/internal/players", {
      method: "POST",
      body: JSON.stringify({
        ...player,
        passwordHash: hashedPassword,
        isFirstLogin: true,
      }),
    });

    const hydratedPlayer = hydratePlayer(created);
    await this.insertCreationLog({
      playerId: hydratedPlayer.id,
      createdByPlayerId: hydratedPlayer.id,
      createdByUsername: hydratedPlayer.username,
      creationSource: "self_register",
      createdAt: hydratedPlayer.createdAt,
    });

    const accessToken = createAccessToken({
      playerId: hydratedPlayer.id,
      isAdmin,
    });
    return {
      ...hydratedPlayer,
      accessToken,
      isFirstLogin: true,
      isAdmin,
    } as any;
  }

  async login(
    username: string,
    password: string,
  ): Promise<{ accessToken: string; isFirstLogin: boolean; isAdmin: boolean }> {
    const stored = await this.getStoredPlayerByUsername(username);
    if (!stored) {
      throw new Error("아이디 또는 비밀번호가 틀렸습니다.");
    }
    if (stored.status === "inactive") {
      throw new Error("비활성 계정입니다. 관리자에게 문의해주세요.");
    }
    const isValidPassword = await bcrypt.compare(password, stored.passwordHash);
    if (!isValidPassword) {
      throw new Error("아이디 또는 비밀번호가 틀렸습니다.");
    }
    const isAdmin = username === "admin";
    const accessToken = createAccessToken({ playerId: stored.id, isAdmin });
    return { accessToken, isFirstLogin: stored.isFirstLogin, isAdmin };
  }

  async getPlayerById(playerId: string): Promise<Player | undefined> {
    const stored = await this.getStoredPlayerById(playerId);
    if (!stored) {
      return undefined;
    }
    const {
      passwordHash: _passwordHash,
      isFirstLogin: _isFirstLogin,
      ...player
    } = stored;
    return player;
  }

  async changePassword(playerId: string, newPassword: string): Promise<void> {
    const stored = await this.getStoredPlayerById(playerId);
    if (!stored) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.dbRequest(`/internal/players/${playerId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ passwordHash, isFirstLogin: false }),
    });
  }

  async getAllPlayers(): Promise<Player[]> {
    const players = await this.dbRequest<any[]>("/internal/players");
    return players.map((record) => {
      const {
        passwordHash: _passwordHash,
        isFirstLogin: _isFirstLogin,
        ...player
      } = hydratePlayer(record);
      return player;
    });
  }

  async updatePlayerStatus(
    playerId: string,
    nextStatus: PlayerStatus,
    changedByPlayerId: string,
  ): Promise<{ player: Player; log: PlayerStatusChangeLog | null }> {
    const stored = await this.getStoredPlayerById(playerId);
    if (!stored) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    const changedBy = await this.getStoredPlayerById(changedByPlayerId);
    if (!changedBy) {
      throw new Error("상태 변경 요청자를 찾을 수 없습니다.");
    }

    if (stored.username === "admin" && nextStatus === "inactive") {
      throw new Error("기본 관리자 계정은 inactive 상태로 변경할 수 없습니다.");
    }

    if (stored.status === nextStatus) {
      const {
        passwordHash: _passwordHash,
        isFirstLogin: _isFirstLogin,
        ...player
      } = stored;
      return { player, log: null };
    }

    const updated = hydratePlayer(
      await this.dbRequest<any>(`/internal/players/${playerId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      }),
    );

    const log = await this.insertStatusChangeLog({
      playerId: updated.id,
      previousStatus: stored.status,
      nextStatus,
      changedByPlayerId: changedBy.id,
      changedByUsername: changedBy.username,
      changedAt: updated.updatedAt,
    });

    const {
      passwordHash: _passwordHash,
      isFirstLogin: _isFirstLogin,
      ...player
    } = updated;
    return { player, log };
  }

  async getPlayerCreationLogs(): Promise<Record<string, PlayerCreationLog[]>> {
    const logs = await this.dbRequest<any[]>("/internal/player-creation-logs");
    return groupByPlayerId(logs.map(hydrateCreationLog));
  }

  async getPlayerStatusLogs(): Promise<
    Record<string, PlayerStatusChangeLog[]>
  > {
    const logs = await this.dbRequest<any[]>(
      "/internal/player-status-change-logs",
    );
    return groupByPlayerId(logs.map(hydrateStatusChangeLog));
  }

  async initAdmin(): Promise<Player> {
    const existing = await this.getStoredPlayerByUsername("admin");
    if (existing) {
      const {
        passwordHash: _passwordHash,
        isFirstLogin: _isFirstLogin,
        ...player
      } = existing;
      return player;
    }

    const passwordHash = await bcrypt.hash("admin123", SALT_ROUNDS);
    const player = createPlayer({ username: "admin", gender: "M" });

    const created = hydratePlayer(
      await this.dbRequest<any>("/internal/players/init-admin", {
        method: "POST",
        body: JSON.stringify({
          ...player,
          passwordHash,
          isFirstLogin: true,
        }),
        retries: 10,
      }),
    );

    await this.insertCreationLog({
      playerId: created.id,
      createdByPlayerId: created.id,
      createdByUsername: created.username,
      creationSource: "bootstrap",
      createdAt: created.createdAt,
    }).catch(() => undefined);

    const {
      passwordHash: _passwordHash,
      isFirstLogin: _isFirstLogin,
      ...publicPlayer
    } = created;
    return publicPlayer;
  }

  async registerAdmin(
    credentials: UserCredentials,
    createdByPlayerId: string,
  ): Promise<Player> {
    const duplicate = await this.getStoredPlayerByUsername(
      credentials.username,
    );
    if (duplicate) {
      throw new Error("중복된 사용자명입니다.");
    }

    const createdBy = await this.getStoredPlayerById(createdByPlayerId);
    if (!createdBy) {
      throw new Error("계정 생성 요청자를 찾을 수 없습니다.");
    }

    const passwordHash = await bcrypt.hash(credentials.password, SALT_ROUNDS);
    const player = createPlayer({
      username: credentials.username,
      gender: credentials.gender,
    });

    const created = hydratePlayer(
      await this.dbRequest<any>("/internal/players", {
        method: "POST",
        body: JSON.stringify({
          ...player,
          passwordHash,
          isFirstLogin: true,
        }),
      }),
    );

    await this.insertCreationLog({
      playerId: created.id,
      createdByPlayerId: createdBy.id,
      createdByUsername: createdBy.username,
      creationSource: "admin_register",
      createdAt: created.createdAt,
    });

    const {
      passwordHash: _passwordHash,
      isFirstLogin: _isFirstLogin,
      ...publicPlayer
    } = created;
    return publicPlayer;
  }
}
