import type {
  Match,
  MatchFeedItem,
  MatchMode,
  MatchScore,
  MatchSessionSummary,
  ManagedMatchSession,
  Session,
} from "@pkpkdupr/shared/match";
import { DEFAULT_MATCH_MODE } from "@pkpkdupr/shared/match";
import { generateEntityId } from "@pkpkdupr/shared/entityId";
import type { PlayerRatingChangeLog } from "@pkpkdupr/shared/player";

const DB_SERVER_URL = process.env.DB_SERVER_URL || "http://localhost:5001";

export class DbRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DbRequestError";
  }
}

const toDateOrNull = (value: string | Date | null | undefined) =>
  value == null ? null : new Date(value);

const hydrateSession = (record: any): Session | undefined => {
  if (!record.session?.date) {
    return undefined;
  }

  return {
    id: record.session.id,
    name:
      typeof record.session.name === "string" && record.session.name.trim()
        ? record.session.name.trim()
        : undefined,
    date: new Date(record.session.date),
    location:
      typeof record.session.location === "string" && record.session.location.trim()
        ? record.session.location.trim()
        : "Court TBD",
  };
};

const hydrateStandaloneSession = (record: any): Session => ({
  id: record.id,
  name: record.name,
  date: new Date(record.date),
  location: record.location,
});

const hydrateManagedSession = (record: any): ManagedMatchSession => ({
  id: record.id,
  name: record.name,
  date: new Date(record.date),
  location: record.location,
  participantIds: record.participantIds ?? [],
  matchCount: Number(record.matchCount ?? 0),
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});

const hydrateRatingChangeLog = (record: any): PlayerRatingChangeLog => ({
  id: record.id,
  playerId: record.playerId,
  source: record.source,
  sourceLogId: record.sourceLogId,
  previousRating: record.previousRating,
  nextRating: record.nextRating,
  delta: record.delta,
  createdAt: new Date(record.createdAt),
});

const hydrateMatch = (record: any): Match => ({
  ...record,
  mode: (record.mode as MatchMode | undefined) ?? DEFAULT_MATCH_MODE,
  source: record.source ?? "player_created",
  name:
    typeof record.name === "string" && record.name.trim()
      ? record.name.trim()
      : undefined,
  session: hydrateSession(record),
  teams: [
    {
      ...record.teams[0],
      players: record.teams[0].players.map((player: any) => ({
        ...player,
        createdAt: new Date(player.createdAt),
        updatedAt: new Date(player.updatedAt),
      })),
    },
    {
      ...record.teams[1],
      players: record.teams[1].players.map((player: any) => ({
        ...player,
        createdAt: new Date(player.createdAt),
        updatedAt: new Date(player.updatedAt),
      })),
    },
  ],
  scores: record.scores?.map(({ scoreA, scoreB }: MatchScore) => ({
    scoreA,
    scoreB,
  })),
  resultSubmittedByPlayerId: record.resultSubmittedByPlayerId ?? null,
  resultSubmittedAt: toDateOrNull(record.resultSubmittedAt),
  approvals: (record.approvals ?? []).map(
    (approval: { playerId: string; approvedAt: string | Date }) => ({
      playerId: approval.playerId,
      approvedAt: new Date(approval.approvedAt),
    }),
  ),
  matchStartsAt: new Date(record.matchStartsAt),
  completedAt: toDateOrNull(record.completedAt),
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});

const hydrateSessionSummary = (record: any): MatchSessionSummary => ({
  id: record.id,
  name: record.name,
  date: new Date(record.date),
  location:
    typeof record.location === "string" && record.location.trim()
      ? record.location.trim()
      : "Court TBD",
  status: record.status === "completed" ? "completed" : "created",
  matchCount: record.matchCount,
  participants: (record.participants ?? []).map((participant: any) => ({
    id: participant.id,
    username: participant.username,
    avatarUrl: participant.avatarUrl ?? undefined,
  })),
  latestCreatedAt: new Date(record.latestCreatedAt),
});

const hydrateMatchFeedItem = (record: any): MatchFeedItem =>
  record.kind === "session"
    ? { kind: "session", session: hydrateSessionSummary(record.session) }
    : { kind: "match", match: hydrateMatch(record.match) };

/**
 * MatchRepository - API 서버에서 DB 서버의 match 저장소를 호출합니다.
 */
export class MatchRepository {
  private async dbRequest<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const res = await fetch(`${DB_SERVER_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new DbRequestError(
        errorData.error || `DB 서버 요청 실패: ${res.status}`,
        res.status,
      );
    }

    return (await res.json()) as T;
  }

  /** ID로 단일 경기 조회 */
  async findById(matchId: string): Promise<Match | undefined> {
    try {
      return hydrateMatch(
        await this.dbRequest<any>(`/internal/matches/${matchId}`),
      );
    } catch (error) {
      if ((error as Error).message.includes("찾을 수 없습니다")) {
        return undefined;
      }
      throw error;
    }
  }

  /** ID로 단일 경기 조회 + 이 경기에 의한 DUPR 변동 로그 함께 반환 */
  async findByIdWithRatingChanges(
    matchId: string,
  ): Promise<
    { match: Match; ratingChanges: PlayerRatingChangeLog[] } | undefined
  > {
    try {
      const [match, ratingChangeRecords] = await Promise.all([
        this.dbRequest<any>(`/internal/matches/${matchId}`),
        this.dbRequest<any[]>(
          `/internal/matches/${matchId}/rating-change-logs`,
        ),
      ]);

      return {
        match: hydrateMatch(match),
        ratingChanges: (ratingChangeRecords ?? []).map(hydrateRatingChangeLog),
      };
    } catch (error) {
      if ((error as Error).message.includes("찾을 수 없습니다")) {
        return undefined;
      }
      throw error;
    }
  }

  /** 신규 경기 추가 */
  async create(
    match: Omit<Match, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ): Promise<Match> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = match.id ?? generateEntityId("match");
      try {
        const created = await this.dbRequest<any>("/internal/matches", {
          method: "POST",
          body: JSON.stringify({
            id,
            ...match,
            resultSubmittedByPlayerId: match.resultSubmittedByPlayerId ?? null,
            resultSubmittedAt: match.resultSubmittedAt ?? null,
            approvals: match.approvals ?? [],
          }),
        });
        return hydrateMatch(created);
      } catch (error) {
        if (
          match.id ||
          attempt === 7 ||
          !(error instanceof DbRequestError) ||
          error.status !== 409
        ) {
          throw error;
        }
      }
    }

    throw new Error("매치 ID 생성에 실패했습니다.");
  }

  async createSession(
    session: Omit<Session, "id"> & { id?: string },
  ): Promise<Session> {
    const created = await this.dbRequest<any>("/internal/match-sessions", {
      method: "POST",
      body: JSON.stringify({
        ...session,
        id: session.id ?? generateEntityId("session"),
      }),
    });
    return hydrateStandaloneSession(created);
  }

  async findSessions(): Promise<ManagedMatchSession[]> {
    const records = await this.dbRequest<any[]>("/internal/match-sessions");
    return records.map(hydrateManagedSession);
  }

  async findSessionById(
    sessionId: string,
  ): Promise<ManagedMatchSession | undefined> {
    const sessions = await this.findSessions();
    return sessions.find((session) => session.id === sessionId);
  }

  async replaceSessionParticipants(
    sessionId: string,
    playerIds: string[],
  ): Promise<ManagedMatchSession> {
    const updated = await this.dbRequest<any>(
      `/internal/match-sessions/${encodeURIComponent(sessionId)}/participants`,
      {
        method: "PUT",
        body: JSON.stringify({ playerIds }),
      },
    );
    return hydrateManagedSession(updated);
  }

  async submitResult(
    matchId: string,
    submittedByPlayerId: string,
    scores: MatchScore[],
  ): Promise<Match> {
    const updated = await this.dbRequest<any>(
      `/internal/matches/${matchId}/result`,
      {
        method: "POST",
        body: JSON.stringify({
          submittedByPlayerId,
          scores,
          approvalId: `${matchId}-approval-${submittedByPlayerId}`,
          submittedAt: new Date(),
        }),
      },
    );

    return hydrateMatch(updated);
  }

  async recordAdminResult(
    matchId: string,
    submittedByPlayerId: string,
    scores: MatchScore[],
  ): Promise<Match> {
    const updated = await this.dbRequest<any>(
      `/internal/matches/${matchId}/admin-result`,
      {
        method: "POST",
        body: JSON.stringify({
          submittedByPlayerId,
          scores,
          completedAt: new Date(),
        }),
      },
    );

    return hydrateMatch(updated);
  }

  async delete(matchId: string): Promise<void> {
    await this.dbRequest<void>(`/internal/matches/${matchId}`, {
      method: "DELETE",
    });
  }

  async approveResult(matchId: string, playerId: string): Promise<Match> {
    const updated = await this.dbRequest<any>(
      `/internal/matches/${matchId}/approvals`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          approvalId: `${matchId}-approval-${playerId}`,
          approvedAt: new Date(),
        }),
      },
    );

    return hydrateMatch(updated);
  }

  async cancelApproval(matchId: string, playerId: string): Promise<Match> {
    const updated = await this.dbRequest<any>(
      `/internal/matches/${matchId}/approvals/${playerId}`,
      { method: "DELETE" },
    );

    return hydrateMatch(updated);
  }

  /** 특정 플레이어의 rating 변동 로그 조회 */
  async getPlayerRatingChangeLogs(
    playerId: string,
  ): Promise<PlayerRatingChangeLog[]> {
    const records = await this.dbRequest<any[]>(
      `/internal/player-rating-change-logs/by-player/${playerId}`,
    );
    return (records ?? []).map(hydrateRatingChangeLog);
  }

  /** 특정 플레이어의 경기 이력 조회 */
  async findByPlayerId(
    playerId: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ matches: Match[]; total: number }> {
    return await this.findAll(page, limit, playerId);
  }

  async getLastPlayedAtByPlayerId(): Promise<Record<string, Date>> {
    const records = await this.dbRequest<Record<string, string | Date>>(
      "/internal/matches/last-played",
    );

    return Object.fromEntries(
      Object.entries(records).map(([playerId, lastPlayedAt]) => [
        playerId,
        new Date(lastPlayedAt),
      ]),
    );
  }

  /** 모든 경기 목록 */
  async findAll(
    page: number = 0,
    limit: number = 20,
    playerId?: string,
  ): Promise<{ matches: Match[]; total: number }> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (playerId) {
      params.set("playerId", playerId);
    }

    const result = await this.dbRequest<{ matches: any[]; total: number }>(
      `/internal/matches?${params.toString()}`,
    );

    return {
      matches: result.matches.map(hydrateMatch),
      total: result.total,
    };
  }

  async findFeed(
    page: number = 0,
    limit: number = 20,
    playerId?: string,
  ): Promise<{ items: MatchFeedItem[]; total: number }> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (playerId) {
      params.set("playerId", playerId);
    }

    const result = await this.dbRequest<{ items: any[]; total: number }>(
      `/internal/match-feed?${params.toString()}`,
    );
    return {
      items: result.items.map(hydrateMatchFeedItem),
      total: result.total,
    };
  }

  async findBySession(sessionId: string): Promise<Match[]> {
    const records = await this.dbRequest<any[]>(
      `/internal/match-sessions/${encodeURIComponent(sessionId)}/matches`,
    );
    return records.map(hydrateMatch);
  }

  async updateMetadata(
    matchId: string,
    input: {
      name?: string | null;
      sessionName?: string | null;
      sessionDate?: string | null;
      sessionLocation?: string | null;
    },
  ): Promise<Match> {
    const updated = await this.dbRequest<any>(
      `/internal/matches/${matchId}/metadata`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );

    return hydrateMatch(updated);
  }
}
