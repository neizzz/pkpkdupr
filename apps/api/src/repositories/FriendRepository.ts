import { DbRequestError } from "./MatchRepository";

const DB_SERVER_URL = process.env.DB_SERVER_URL || "http://localhost:5001";

export class FriendRepository {
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

  async addFriendship(playerId: string, friendPlayerId: string) {
    return await this.dbRequest<{
      playerId: string;
      friendPlayerId: string;
      createdAt: string;
    }>("/internal/friends", {
      method: "POST",
      body: JSON.stringify({ playerId, friendPlayerId }),
    });
  }

  async listFriendPlayerIds(playerId: string) {
    return await this.dbRequest<string[]>(
      `/internal/friends/${encodeURIComponent(playerId)}`,
    );
  }
}
