import type { Match } from "@pkpkdupr/shared/match";
import type {
  Player,
  PlayerRatingChangeLog,
  StoredPlayerDupr,
} from "@pkpkdupr/shared/player";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "../services/AuthService";
import type { RatingServiceContract } from "../services/RatingService";

const completedAt = new Date("2026-08-01T10:00:00.000Z");

const createState = (rating: number): StoredPlayerDupr => ({
  rating: { singles: rating, doubles: rating },
  metrics: {
    singles: { confidence: 50, accuracy: null },
    doubles: { confidence: 50, accuracy: null },
  },
});

const createPlayer = (id: string, rating: number): Player & {
  passwordHash: string;
  isFirstLogin: boolean;
} => ({
  id,
  username: id,
  gender: "M",
  status: "active",
  duprRating: { singles: rating, doubles: rating },
  passwordHash: "hash",
  isFirstLogin: false,
  createdAt: completedAt,
  updatedAt: completedAt,
});

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("incremental match rating", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("완료된 한 경기의 참가자 상태와 로그만 증분 반영하고 재처리는 건너뛴다", async () => {
    const players = new Map([
      ["winner", createPlayer("winner", 3)],
      ["loser", createPlayer("loser", 2.8)],
    ]);
    const persistedStates = new Map<string, StoredPlayerDupr>();
    const persistedLogs: PlayerRatingChangeLog[] = [];
    const replayMatch = vi.fn<RatingServiceContract["replayMatch"]>((input) =>
      Object.fromEntries(
        input.participants.map((participant) => [
          participant.playerId,
          {
            ...participant.state,
            rating: {
              ...participant.state.rating,
              singles:
                participant.state.rating.singles +
                (participant.teamIndex === input.winnerTeamIndex ? 0.1 : -0.1),
            },
          },
        ]),
      ),
    );
    const ratingService: RatingServiceContract = {
      getAccuracy: () => 0,
      getCorrectionWeight: () => 1,
      replayMatch,
    };
    const match: Match = {
      id: "match-incremental",
      type: "singles",
      mode: "single-game",
      source: "player_created",
      creatorPlayerId: "winner",
      status: "completed",
      teams: [
        { id: "team-a", name: "A", players: [players.get("winner")!] },
        { id: "team-b", name: "B", players: [players.get("loser")!] },
      ],
      scores: [{ scoreA: 11, scoreB: 8 }],
      resultSubmittedByPlayerId: "winner",
      resultSubmittedAt: completedAt,
      approvals: [],
      location: "Court",
      matchStartsAt: completedAt,
      completedAt,
      createdAt: completedAt,
      updatedAt: completedAt,
    };

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url,
        );
        const { pathname, searchParams } = url;

        if (pathname === `/internal/matches/${match.id}/rating-change-logs`) {
          return jsonResponse(persistedLogs);
        }
        if (pathname === "/internal/matches") {
          const playerId = searchParams.get("playerId");
          return jsonResponse({
            matches:
              playerId === "winner"
                ? [
                    {
                      id: "previous-singles",
                      status: "completed",
                      type: "singles",
                      completedAt: new Date(
                        completedAt.getTime() - 24 * 60 * 60 * 1000,
                      ).toISOString(),
                    },
                  ]
                : [],
            total: playerId === "winner" ? 1 : 0,
          });
        }
        if (
          pathname.endsWith("/dupr-state") &&
          init?.method === "PATCH"
        ) {
          const playerId = pathname.split("/").at(-2)!;
          const { duprState } = JSON.parse(String(init.body)) as {
            duprState: StoredPlayerDupr;
          };
          persistedStates.set(playerId, duprState);
          const player = players.get(playerId)!;
          players.set(playerId, { ...player, duprRating: duprState.rating });
          return jsonResponse({ ...players.get(playerId) });
        }
        if (
          pathname === "/internal/matches/participant-dupr-snapshots" &&
          init?.method === "PATCH"
        ) {
          return jsonResponse({ updatedParticipantCount: 2, updatedMatchCount: 1 });
        }
        if (
          pathname === "/internal/player-rating-change-logs" &&
          init?.method === "POST"
        ) {
          const log = JSON.parse(String(init.body)) as PlayerRatingChangeLog;
          persistedLogs.push(log);
          return jsonResponse(log);
        }
        if (pathname.startsWith("/internal/players/")) {
          const playerId = pathname.split("/").at(-1)!;
          return jsonResponse(players.get(playerId));
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new AuthService(ratingService);
    const result = await service.applyMatchResultToRatings(match);

    expect(replayMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "singles",
        winnerTeamIndex: 0,
        inactiveElapsedMsByPlayerId: {
          winner: 24 * 60 * 60 * 1000,
          loser: 0,
        },
      }),
    );
    expect(result.changedPlayerCount).toBe(2);
    expect(result.ratingChangeLogs).toHaveLength(2);
    expect(persistedStates.get("winner")?.rating.singles).toBeCloseTo(3.1);
    expect(persistedStates.get("loser")?.rating.singles).toBeCloseTo(2.7);
    expect(persistedLogs.map((log) => log.sourceLogId)).toEqual([
      `match-completed-${match.id}-${completedAt.getTime()}`,
      `match-completed-${match.id}-${completedAt.getTime()}`,
    ]);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith("/internal/matches?page=0&limit=10000"),
      ),
    ).toBe(false);

    await service.applyMatchResultToRatings(match);

    expect(replayMatch).toHaveBeenCalledTimes(1);
    expect(persistedLogs).toHaveLength(2);
  });
});
