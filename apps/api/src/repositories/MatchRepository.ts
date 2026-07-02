import type { Match, MatchScore } from "@pkpkdupr/shared/match";

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

const hydrateMatch = (record: any): Match => ({
  ...record,
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
  scheduledAt: new Date(record.scheduledAt),
  completedAt: toDateOrNull(record.completedAt),
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});

/**
 * MatchRepository - API 서버에서 DB 서버의 match 저장소를 호출합니다.
 */
export class MatchRepository {
  private async dbRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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

  /** 신규 경기 추가 */
  async create(
    match: Omit<Match, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ): Promise<Match> {
    const id = match.id ?? `match-${Date.now()}`;
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

  /** 특정 플레이어의 경기 이력 조회 */
  async findByPlayerId(
    playerId: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ matches: Match[]; total: number }> {
    return await this.findAll(page, limit, playerId);
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
}
