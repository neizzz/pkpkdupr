import {
  OfficialDuprAdjustmentLog,
  Player,
  PlayerCreationLog,
  PlayerCreationSource,
  PlayerDuprMetrics,
  PlayerStatus,
  PlayerStatusChangeLog,
  StoredPlayerDupr,
  computeTotalDuprRating,
  createDefaultPlayerDupr,
  createDefaultPlayerDuprMetrics,
  getDuprMetricByCategory,
  getDuprRatingByCategory,
  normalizePlayerDupr,
  normalizeStoredPlayerDupr,
  normalizeDuprRatingValue,
  setDuprMetricByCategory,
  setDuprRatingByCategory,
} from "@pkpkdupr/shared/player";
import type {
  DevPlayerQrTokenListResponse,
  PlayerQrPublicPlayer,
  PlayerQrTokenResponse,
  VerifyPlayerQrTokenResponse,
} from "@pkpkdupr/shared/qr";
import bcrypt from "bcryptjs";
import { createHmac } from "crypto";
import {
  ACCESS_TOKEN_EXPIRES_IN,
  createAccessToken,
  decodeToken,
  JWT_SECRET,
  REMEMBER_ME_ACCESS_TOKEN_EXPIRES_IN,
  type JwtPayload,
} from "../config/jwt";
import {
  createDevPlayerQrPayload,
  createPlayerQrToken as createPlayerQrTokenPayload,
  isDevPlayerQrPayload,
  verifyDevPlayerQrPayload,
  verifyPlayerQrPayload,
} from "./playerQrToken";
import { RatingService } from "./RatingService";
import type { Match } from "@pkpkdupr/shared/match";

const SALT_ROUNDS = 10;
const DB_SERVER_URL = process.env.DB_SERVER_URL || "http://localhost:5001";
const DEV_MOCK_DATA_ENABLED = process.env.ENABLE_DEV_MOCK_DATA === "true";

interface StoredPlayerRecord extends Player {
  passwordHash: string;
  isFirstLogin: boolean;
  duprMetrics: PlayerDuprMetrics;
}

interface DbRequestOptions extends RequestInit {
  retries?: number;
}

interface RetryOperationOptions {
  retries: number;
  baseDelayMs?: number;
}

export interface AuthenticatedSession {
  payload: JwtPayload;
  player: Player;
  refreshedAccessToken?: string;
}

export interface UserCredentials {
  username: string;
  password: string;
  gender: "M" | "F";
}

const buildId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createPasswordFingerprint = (passwordHash: string) =>
  createHmac("sha256", JWT_SECRET).update(passwordHash).digest("hex");

const createPlayer = (input: Pick<Player, "username" | "gender">): Player => {
  const now = new Date();

  return {
    id: buildId("player"),
    username: input.username,
    duprRating: createDefaultPlayerDupr(),
    gender: input.gender,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
};

const toDate = (value: string | Date) => new Date(value);

const hydratePlayer = (record: any): StoredPlayerRecord => {
  const duprState = normalizeStoredPlayerDupr(record.duprRating);
  return {
    ...record,
    avatarUrl: record.avatarUrl ?? undefined,
    duprRating: duprState.rating,
    duprMetrics: duprState.metrics,
    status: record.status === "deleted" ? "inactive" : record.status,
    createdAt: toDate(record.createdAt),
    updatedAt: toDate(record.updatedAt),
  };
};

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

const hydrateOfficialDuprAdjustmentLog = (
  record: any,
): OfficialDuprAdjustmentLog => ({
  ...record,
  previousRating: normalizePlayerDupr(record.previousRating),
  nextRating: normalizePlayerDupr(record.nextRating),
  createdAt: toDate(record.createdAt),
});

const groupByPlayerId = <T extends { playerId: string }>(items: T[]) =>
  items.reduce<Record<string, T[]>>((acc, item) => {
    acc[item.playerId] = [...(acc[item.playerId] ?? []), item];
    return acc;
  }, {});

const toPublicPlayer = (stored: StoredPlayerRecord): Player => {
  const {
    passwordHash: _passwordHash,
    isFirstLogin: _isFirstLogin,
    duprMetrics: _duprMetrics,
    ...player
  } = stored;
  return player;
};

const toPlayerQrPublicPlayer = (player: Player): PlayerQrPublicPlayer => ({
  id: player.id,
  username: player.username,
  gender: player.gender,
  avatarUrl: player.avatarUrl,
  duprRating: player.duprRating,
});

const isActiveDevPlayer = (player: Player) =>
  player.status === "active" && player.username.startsWith("dev_");

const isRetryableDbBootstrapError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: string }).code === "ECONNREFUSED"
  ) {
    return true;
  }

  return error.message.includes("fetch failed");
};

type OfficialDuprRatingPatch = NonNullable<
  OfficialDuprAdjustmentLog["ratings"]
>;
type OfficialDuprConfidencePatch = NonNullable<
  OfficialDuprAdjustmentLog["confidence"]
>;
type OfficialDuprAccuracyPatch = OfficialDuprAdjustmentLog["preUpdateAccuracy"];

const duprPatchEntries = [
  {
    category: "singles" as const,
    getRating: (ratings?: OfficialDuprRatingPatch) => ratings?.singles,
    getConfidence: (confidence?: OfficialDuprConfidencePatch) =>
      confidence?.singles,
    setRating: (patch: OfficialDuprRatingPatch, value: number) => {
      patch.singles = value;
    },
    setConfidence: (patch: OfficialDuprConfidencePatch, value: number) => {
      patch.singles = value;
    },
    setAccuracy: (
      patch: OfficialDuprAccuracyPatch,
      value: number | null,
    ) => {
      patch.singles = value;
    },
  },
  {
    category: "doubles.mixed" as const,
    getRating: (ratings?: OfficialDuprRatingPatch) => ratings?.doubles?.mixed,
    getConfidence: (confidence?: OfficialDuprConfidencePatch) =>
      confidence?.doubles?.mixed,
    setRating: (patch: OfficialDuprRatingPatch, value: number) => {
      patch.doubles = { ...(patch.doubles ?? {}), mixed: value };
    },
    setConfidence: (patch: OfficialDuprConfidencePatch, value: number) => {
      patch.doubles = { ...(patch.doubles ?? {}), mixed: value };
    },
    setAccuracy: (
      patch: OfficialDuprAccuracyPatch,
      value: number | null,
    ) => {
      patch.doubles = { ...(patch.doubles ?? {}), mixed: value };
    },
  },
  {
    category: "doubles.men" as const,
    getRating: (ratings?: OfficialDuprRatingPatch) => ratings?.doubles?.men,
    getConfidence: (confidence?: OfficialDuprConfidencePatch) =>
      confidence?.doubles?.men,
    setRating: (patch: OfficialDuprRatingPatch, value: number) => {
      patch.doubles = { ...(patch.doubles ?? {}), men: value };
    },
    setConfidence: (patch: OfficialDuprConfidencePatch, value: number) => {
      patch.doubles = { ...(patch.doubles ?? {}), men: value };
    },
    setAccuracy: (
      patch: OfficialDuprAccuracyPatch,
      value: number | null,
    ) => {
      patch.doubles = { ...(patch.doubles ?? {}), men: value };
    },
  },
  {
    category: "doubles.women" as const,
    getRating: (ratings?: OfficialDuprRatingPatch) => ratings?.doubles?.women,
    getConfidence: (confidence?: OfficialDuprConfidencePatch) =>
      confidence?.doubles?.women,
    setRating: (patch: OfficialDuprRatingPatch, value: number) => {
      patch.doubles = { ...(patch.doubles ?? {}), women: value };
    },
    setConfidence: (patch: OfficialDuprConfidencePatch, value: number) => {
      patch.doubles = { ...(patch.doubles ?? {}), women: value };
    },
    setAccuracy: (
      patch: OfficialDuprAccuracyPatch,
      value: number | null,
    ) => {
      patch.doubles = { ...(patch.doubles ?? {}), women: value };
    },
  },
];

const normalizeConfidenceValue = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("confidence는 숫자여야 합니다.");
  }
  return Math.round(Math.min(100, Math.max(0, parsed)));
};

const buildWinnerTeamIndex = (match: Match): 0 | 1 | null => {
  if (!match.scores?.length) {
    return null;
  }

  const teamWins = match.scores.reduce<[number, number]>(
    (acc, score) => {
      if (score.scoreA > score.scoreB) acc[0] += 1;
      if (score.scoreB > score.scoreA) acc[1] += 1;
      return acc;
    },
    [0, 0],
  );

  if (teamWins[0] !== teamWins[1]) {
    return teamWins[0] > teamWins[1] ? 0 : 1;
  }

  const points = match.scores.reduce<[number, number]>(
    (acc, score) => [acc[0] + score.scoreA, acc[1] + score.scoreB],
    [0, 0],
  );
  if (points[0] === points[1]) {
    return null;
  }
  return points[0] > points[1] ? 0 : 1;
};

export class AuthService {
  private ratingService = new RatingService();

  private async retryOperation<T>(
    operation: () => Promise<T>,
    options: RetryOperationOptions,
  ): Promise<T> {
    const { retries, baseDelayMs = 300 } = options;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isRetryableDbBootstrapError(error) || attempt === retries) {
          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs * (attempt + 1)),
        );
      }
    }

    throw new Error("DB 서버 요청 실패");
  }

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

  private createAccessTokenForPlayer(
    stored: StoredPlayerRecord,
    rememberMe = false,
  ): string {
    return createAccessToken(
      {
        playerId: stored.id,
        isAdmin: stored.username === "admin",
        rememberMe,
        passwordFingerprint: createPasswordFingerprint(stored.passwordHash),
      },
      {
        expiresIn: rememberMe
          ? REMEMBER_ME_ACCESS_TOKEN_EXPIRES_IN
          : ACCESS_TOKEN_EXPIRES_IN,
      },
    );
  }

  async authenticateAccessToken(
    accessToken: string,
  ): Promise<AuthenticatedSession> {
    const decoded = decodeToken(accessToken);
    if (!decoded?.playerId) {
      throw new Error("유효하지 않거나 만료된 토큰입니다.");
    }

    const stored = await this.getStoredPlayerById(decoded.playerId);
    if (!stored) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    if (stored.status === "inactive") {
      throw new Error("비활성 계정입니다. 관리자에게 문의해주세요.");
    }

    const expectedFingerprint = createPasswordFingerprint(stored.passwordHash);
    if (decoded.passwordFingerprint !== expectedFingerprint) {
      throw new Error("비밀번호가 변경되어 다시 로그인해야 합니다.");
    }

    const rememberMe = decoded.rememberMe === true;
    return {
      payload: {
        ...decoded,
        isAdmin: stored.username === "admin",
        rememberMe,
      },
      player: toPublicPlayer(stored),
      refreshedAccessToken: rememberMe
        ? this.createAccessTokenForPlayer(stored, true)
        : undefined,
    };
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

    const accessToken = this.createAccessTokenForPlayer(hydratedPlayer);
    return {
      ...toPublicPlayer(hydratedPlayer),
      accessToken,
      isFirstLogin: true,
      isAdmin,
    } as any;
  }

  async login(
    username: string,
    password: string,
    rememberMe = false,
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
    const accessToken = this.createAccessTokenForPlayer(stored, rememberMe);
    return { accessToken, isFirstLogin: stored.isFirstLogin, isAdmin };
  }

  async getPlayerById(playerId: string): Promise<Player | undefined> {
    const stored = await this.getStoredPlayerById(playerId);
    if (!stored) {
      return undefined;
    }
    return toPublicPlayer(stored);
  }

  async createPlayerQrToken(
    playerId: string,
  ): Promise<PlayerQrTokenResponse> {
    const stored = await this.getStoredPlayerById(playerId);
    if (!stored) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    if (stored.status !== "active" || stored.username === "admin") {
      throw new Error("QR 코드를 생성할 수 없는 계정입니다.");
    }

    return createPlayerQrTokenPayload(stored.id);
  }

  async verifyPlayerQrToken(
    payload: string,
  ): Promise<VerifyPlayerQrTokenResponse> {
    const playerId =
      DEV_MOCK_DATA_ENABLED && isDevPlayerQrPayload(payload)
        ? verifyDevPlayerQrPayload(payload)
        : verifyPlayerQrPayload(payload);
    const stored = await this.getStoredPlayerById(playerId);
    if (!stored) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    if (
      stored.status !== "active" ||
      stored.username === "admin" ||
      (isDevPlayerQrPayload(payload) && !isActiveDevPlayer(stored))
    ) {
      throw new Error("유효하지 않은 플레이어 QR 코드입니다.");
    }

    return { player: toPlayerQrPublicPlayer(stored) };
  }

  async getDevPlayerQrTokens(): Promise<DevPlayerQrTokenListResponse> {
    if (!DEV_MOCK_DATA_ENABLED) {
      throw new Error("Dev mock data mode is not enabled.");
    }

    const players = (await this.getAllPlayers())
      .filter(isActiveDevPlayer)
      .sort((a, b) => {
        if (a.gender !== b.gender) {
          return a.gender === "M" ? -1 : 1;
        }
        return a.username.localeCompare(b.username);
      });

    return {
      players: players.map((player) => ({
        player: toPlayerQrPublicPlayer(player),
        payload: createDevPlayerQrPayload(player.id),
      })),
    };
  }

  async changePassword(
    playerId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const stored = await this.getStoredPlayerById(playerId);
    if (!stored) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    const isValidCurrentPassword = await bcrypt.compare(
      currentPassword,
      stored.passwordHash,
    );
    if (!isValidCurrentPassword) {
      throw new Error("현재 패스워드가 올바르지 않습니다.");
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.dbRequest(`/internal/players/${playerId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ passwordHash, isFirstLogin: false }),
    });
  }

  async updatePlayerProfile(
    playerId: string,
    input: { avatarUrl?: string | null },
  ): Promise<Player> {
    const stored = await this.getStoredPlayerById(playerId);
    if (!stored) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    const avatarUrl =
      typeof input.avatarUrl === "string" && input.avatarUrl.trim()
        ? input.avatarUrl.trim()
        : null;

    const updated = hydratePlayer(
      await this.dbRequest<any>(`/internal/players/${playerId}/profile`, {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl }),
      }),
    );

    return toPublicPlayer(updated);
  }

  async getAllPlayers(): Promise<Player[]> {
    const players = await this.dbRequest<any[]>("/internal/players");
    return players.map((record) => toPublicPlayer(hydratePlayer(record)));
  }

  async getPublicPlayers(): Promise<Player[]> {
    const players = await this.getAllPlayers();
    return players.filter(
      (player) => player.status === "active" && player.username !== "admin",
    );
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
      return { player: toPublicPlayer(stored), log: null };
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

    return { player: toPublicPlayer(updated), log };
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

  async getOfficialDuprAdjustmentLogs(): Promise<OfficialDuprAdjustmentLog[]> {
    const logs = await this.dbRequest<any[]>(
      "/internal/official-dupr-adjustment-logs",
    );
    return logs.map(hydrateOfficialDuprAdjustmentLog);
  }

  private async updateStoredPlayerDuprState(
    playerId: string,
    duprState: StoredPlayerDupr,
  ): Promise<StoredPlayerRecord> {
    return hydratePlayer(
      await this.dbRequest<any>(`/internal/players/${playerId}/dupr-state`, {
        method: "PATCH",
        body: JSON.stringify({ duprState }),
      }),
    );
  }

  async applyOfficialDuprAdjustment(
    input: {
      playerId: string;
      changedByPlayerId: string;
      ratings?: OfficialDuprRatingPatch;
      confidence?: OfficialDuprConfidencePatch;
      reason?: string | null;
    },
    completedMatches: Match[],
  ): Promise<{ player: Player; log: OfficialDuprAdjustmentLog }> {
    const stored = await this.getStoredPlayerById(input.playerId);
    if (!stored) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    const changedBy = await this.getStoredPlayerById(input.changedByPlayerId);
    if (!changedBy) {
      throw new Error("공식 DUPR 반영 요청자를 찾을 수 없습니다.");
    }

    let nextRating = stored.duprRating;
    let nextMetrics = stored.duprMetrics;
    const ratings: OfficialDuprRatingPatch = {};
    const confidence: OfficialDuprConfidencePatch = {};
    const preUpdateAccuracy: OfficialDuprAccuracyPatch = {};
    let touchedCount = 0;

    for (const entry of duprPatchEntries) {
      const ratingValue = entry.getRating(input.ratings);
      const confidenceValue = entry.getConfidence(input.confidence);
      const hasRating = ratingValue != null;
      const hasConfidence = confidenceValue != null;

      if (hasRating !== hasConfidence) {
        throw new Error("rating과 confidence는 같은 종목에 함께 입력해야 합니다.");
      }
      if (!hasRating || !hasConfidence) {
        continue;
      }

      const normalizedRating = normalizeDuprRatingValue(ratingValue);
      const normalizedConfidence = normalizeConfidenceValue(confidenceValue);
      const previousCategoryRating = getDuprRatingByCategory(
        stored.duprRating,
        entry.category,
      );
      const categoryAccuracy = this.ratingService.getAccuracy(
        previousCategoryRating,
        normalizedRating,
      );

      nextRating = setDuprRatingByCategory(
        nextRating,
        entry.category,
        normalizedRating,
      );
      nextMetrics = setDuprMetricByCategory(nextMetrics, entry.category, {
        confidence: normalizedConfidence,
        accuracy: 100,
      });
      entry.setRating(ratings, normalizedRating);
      entry.setConfidence(confidence, normalizedConfidence);
      entry.setAccuracy(preUpdateAccuracy, categoryAccuracy);
      touchedCount += 1;
    }

    if (touchedCount === 0) {
      throw new Error("반영할 공식 DUPR 종목이 필요합니다.");
    }

    const updated = await this.updateStoredPlayerDuprState(stored.id, {
      rating: nextRating,
      metrics: nextMetrics,
    });

    const log = hydrateOfficialDuprAdjustmentLog(
      await this.dbRequest<any>("/internal/official-dupr-adjustment-logs", {
        method: "POST",
        body: JSON.stringify({
          id: buildId("official-dupr-log"),
          playerId: stored.id,
          changedByPlayerId: changedBy.id,
          changedByUsername: changedBy.username,
          ratings,
          confidence,
          previousRating: stored.duprRating,
          nextRating,
          preUpdateAccuracy,
          reason: input.reason?.trim() || null,
          createdAt: new Date(),
        } satisfies OfficialDuprAdjustmentLog),
      }),
    );

    await this.recalculateDuprRatings(completedMatches);
    const recalculated = await this.getStoredPlayerById(updated.id);

    return {
      player: toPublicPlayer(recalculated ?? updated),
      log,
    };
  }

  async recalculateDuprRatings(completedMatches: Match[]): Promise<void> {
    const players = (await this.dbRequest<any[]>("/internal/players")).map(
      hydratePlayer,
    );
    const logs = await this.getOfficialDuprAdjustmentLogs();
    const stateByPlayerId = new Map<string, StoredPlayerDupr>(
      players.map((player) => [
        player.id,
        {
          rating: player.duprRating,
          metrics: player.duprMetrics ?? createDefaultPlayerDuprMetrics(),
        },
      ]),
    );
    const correctionWeightByPlayerId: Record<string, number> = {};

    for (const log of [...logs].reverse()) {
      const state = stateByPlayerId.get(log.playerId);
      if (!state) {
        continue;
      }

      let nextRating = state.rating;
      let nextMetrics = state.metrics;
      for (const entry of duprPatchEntries) {
        const ratingValue = entry.getRating(log.ratings);
        const confidenceValue = entry.getConfidence(log.confidence);
        if (ratingValue == null || confidenceValue == null) {
          continue;
        }
        nextRating = setDuprRatingByCategory(
          nextRating,
          entry.category,
          ratingValue,
        );
        nextMetrics = setDuprMetricByCategory(nextMetrics, entry.category, {
          confidence: normalizeConfidenceValue(confidenceValue),
          accuracy: 100,
        });
        const preUpdateAccuracy = entry.getRating(
          log.preUpdateAccuracy as OfficialDuprRatingPatch,
        );
        correctionWeightByPlayerId[log.playerId] = Math.max(
          correctionWeightByPlayerId[log.playerId] ?? 0,
          this.ratingService.getCorrectionWeight(
            preUpdateAccuracy == null ? null : Number(preUpdateAccuracy),
          ),
        );
      }

      stateByPlayerId.set(log.playerId, {
        rating: {
          ...nextRating,
          total: computeTotalDuprRating(nextRating),
        },
        metrics: nextMetrics,
      });
    }

    const replayMatches = completedMatches
      .filter((match) => match.status === "completed" && match.completedAt)
      .sort(
        (a, b) =>
          new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime(),
      );

    for (const match of replayMatches) {
      const winnerTeamIndex = buildWinnerTeamIndex(match);
      if (winnerTeamIndex == null) {
        continue;
      }

      const participants = match.teams.flatMap((team, teamIndex) =>
        team.players
          .map((player) => {
            const state = stateByPlayerId.get(player.id);
            if (!state) {
              return null;
            }
            return {
              playerId: player.id,
              teamIndex: teamIndex as 0 | 1,
              state,
            };
          })
          .filter((participant): participant is NonNullable<typeof participant> =>
            Boolean(participant),
          ),
      );

      if (participants.length < 2) {
        continue;
      }

      const replayResult = this.ratingService.replayMatch(
        {
          type: match.type,
          winnerTeamIndex,
          participants,
        },
        correctionWeightByPlayerId,
      );

      Object.entries(replayResult).forEach(([playerId, state]) => {
        stateByPlayerId.set(playerId, state);
      });
    }

    for (const [playerId, state] of stateByPlayerId.entries()) {
      await this.updateStoredPlayerDuprState(playerId, state);
    }
  }

  async initAdmin(): Promise<Player> {
    const existing = await this.retryOperation(
      () => this.getStoredPlayerByUsername("admin"),
      { retries: 20 },
    );
    if (existing) {
      return toPublicPlayer(existing);
    }

    const passwordHash = await bcrypt.hash("admin123", SALT_ROUNDS);
    const player = createPlayer({ username: "admin", gender: "M" });

    const created = hydratePlayer(
      await this.retryOperation(
        () =>
          this.dbRequest<any>("/internal/players/init-admin", {
            method: "POST",
            body: JSON.stringify({
              ...player,
              passwordHash,
              isFirstLogin: true,
            }),
            retries: 10,
          }),
        { retries: 20 },
      ),
    );

    await this.insertCreationLog({
      playerId: created.id,
      createdByPlayerId: created.id,
      createdByUsername: created.username,
      creationSource: "bootstrap",
      createdAt: created.createdAt,
    }).catch(() => undefined);

    return toPublicPlayer(created);
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

    return toPublicPlayer(created);
  }
}
