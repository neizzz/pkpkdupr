import type { Match } from "@pkpkdupr/shared/match";
import type {
  OfficialDuprAdjustmentLog,
  Player,
  StoredPlayerDupr,
} from "@pkpkdupr/shared/player";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthService,
  getOfficialDuprRecencyWeight,
} from "../services/AuthService";
import type { RatingServiceContract } from "../services/RatingService";

const NOW = new Date("2026-07-23T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const players = ["anchor", "partner", "opponent-a", "opponent-b", "admin"].map(
  (id): Player & { passwordHash: string; isFirstLogin: boolean } => ({
    id,
    username: id,
    gender: "M",
    status: "active",
    duprRating: null,
    passwordHash: "hash",
    isFirstLogin: false,
    createdAt: NOW,
    updatedAt: NOW,
  }),
);

const playerById = new Map(players.map((player) => [player.id, player]));
let storedOfficialLogs: OfficialDuprAdjustmentLog[];
let storedPlayerById: Map<string, Record<string, unknown>>;
let persistedDuprStateByPlayerId: Map<string, StoredPlayerDupr>;

const buildMatch = (completedAt: Date): Match => ({
  id: `match-${completedAt.getTime()}`,
  type: "men-doubles",
  mode: "single-game",
  source: "player_created",
  creatorPlayerId: "anchor",
  status: "completed",
  teams: [
    {
      id: "team-a",
      name: "Team A",
      players: [playerById.get("anchor")!, playerById.get("partner")!],
    },
    {
      id: "team-b",
      name: "Team B",
      players: [
        playerById.get("opponent-a")!,
        playerById.get("opponent-b")!,
      ],
    },
  ],
  scores: [{ scoreA: 11, scoreB: 9 }],
  resultSubmittedByPlayerId: "anchor",
  resultSubmittedAt: completedAt,
  approvals: [],
  location: "Court",
  matchStartsAt: completedAt,
  completedAt,
  createdAt: completedAt,
  updatedAt: completedAt,
});

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("official DUPR recency propagation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    storedOfficialLogs = [];
    storedPlayerById = new Map(
      players.map((player) => [player.id, { ...player }]),
    );
    persistedDuprStateByPlayerId = new Map();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const path = new URL(url).pathname;

        if (path === "/internal/players") {
          return jsonResponse([...storedPlayerById.values()]);
        }
        if (path === "/internal/official-dupr-adjustment-logs") {
          if (init?.method === "POST") {
            const log = JSON.parse(String(init.body));
            storedOfficialLogs.push(log);
            return jsonResponse(log);
          }
          return jsonResponse(storedOfficialLogs);
        }
        if (
          path === "/internal/matches/participant-dupr-snapshots" &&
          init?.method === "PATCH"
        ) {
          return jsonResponse({
            updatedParticipantCount: 0,
            updatedMatchCount: 0,
          });
        }
        if (
          path === "/internal/player-rating-change-logs" &&
          init?.method === "POST"
        ) {
          return jsonResponse(JSON.parse(String(init.body)));
        }
        if (
          path.endsWith("/dupr-state") &&
          path.startsWith("/internal/players/") &&
          init?.method === "PATCH"
        ) {
          const playerId = decodeURIComponent(path.split("/").at(-2)!);
          const { duprState } = JSON.parse(String(init.body)) as {
            duprState: StoredPlayerDupr;
          };
          const updated = {
            ...storedPlayerById.get(playerId),
            duprRating: duprState,
          };
          storedPlayerById.set(playerId, updated);
          persistedDuprStateByPlayerId.set(playerId, duprState);
          return jsonResponse(updated);
        }
        if (path.startsWith("/internal/players/")) {
          const playerId = decodeURIComponent(path.split("/").at(-1)!);
          return jsonResponse(storedPlayerById.get(playerId));
        }

        throw new Error(`Unexpected request: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("30일마다 공식 DUPR 전파 가중치가 절반으로 감소한다", () => {
    expect(getOfficialDuprRecencyWeight(NOW, NOW)).toBe(1);
    expect(
      getOfficialDuprRecencyWeight(
        new Date(NOW.getTime() - 30 * DAY_MS),
        NOW,
      ),
    ).toBeCloseTo(0.5, 10);
    expect(
      getOfficialDuprRecencyWeight(
        new Date(NOW.getTime() - 60 * DAY_MS),
        NOW,
      ),
    ).toBeCloseTo(0.25, 10);
    expect(
      getOfficialDuprRecencyWeight(
        new Date(NOW.getTime() + DAY_MS),
        NOW,
      ),
    ).toBe(1);
  });

  it("최근 경기일수록 파트너와 상대 전원에게 더 크게 전파하고 입력 선수는 공식값으로 고정한다", async () => {
    const preview = async (daysAgo: number) =>
      new AuthService().previewOfficialDuprAdjustment(
        {
          playerId: "anchor",
          changedByPlayerId: "admin",
          ratings: { doubles: 4 },
          confidence: { doubles: 100 },
        },
        [buildMatch(new Date(NOW.getTime() - daysAgo * DAY_MS))],
      );

    const recent = await preview(0);
    const old = await preview(30);
    const getDoublesDelta = (
      result: Awaited<ReturnType<typeof preview>>,
      playerId: string,
    ) =>
      result.impacts.find((impact) => impact.playerId === playerId)?.delta
        .doubles ?? 0;

    for (const playerId of ["partner", "opponent-a", "opponent-b"]) {
      expect(Math.abs(getDoublesDelta(recent, playerId))).toBeGreaterThan(
        Math.abs(getDoublesDelta(old, playerId)),
      );
    }
    expect(
      recent.impacts.find((impact) => impact.playerId === "anchor")?.nextRating
        .doubles,
    ).toBe(4);
    expect(
      old.impacts.find((impact) => impact.playerId === "anchor")?.nextRating
        .doubles,
    ).toBe(4);

    expect(
      vi.mocked(fetch).mock.calls.every(([, init]) => !init?.method),
    ).toBe(true);
  });

  it("공식 반영 이후 경기는 공식값에서 시작해 다시 레이팅을 변경한다", async () => {
    const preview = await new AuthService().previewOfficialDuprAdjustment(
      {
        playerId: "anchor",
        changedByPlayerId: "admin",
        ratings: { doubles: 4 },
        confidence: { doubles: 100 },
      },
      [buildMatch(new Date(NOW.getTime() + DAY_MS))],
    );

    expect(
      preview.impacts.find((impact) => impact.playerId === "anchor")?.nextRating
        .doubles,
    ).not.toBe(4);
  });

  it("한 경기에 anchor가 여러 명이면 가장 큰 시간 가중치를 참가자 전원에게 한 번만 적용한다", async () => {
    storedOfficialLogs = [
      {
        id: "partner-anchor",
        playerId: "partner",
        changedByPlayerId: "admin",
        changedByUsername: "admin",
        ratings: { doubles: 3.5 },
        confidence: { doubles: 80 },
        previousRating: { singles: 3, doubles: 3 },
        nextRating: { singles: 3, doubles: 3.5 },
        preUpdateAccuracy: { doubles: 0 },
        reason: null,
        createdAt: new Date(NOW.getTime() - 30 * DAY_MS),
      },
    ];
    const receivedWeights: Array<Record<string, number>> = [];
    const recordingRatingService: RatingServiceContract = {
      getAccuracy: () => 0,
      getCorrectionWeight: () => 1,
      replayMatch: (match, weights = {}) => {
        receivedWeights.push(weights);
        return Object.fromEntries(
          match.participants.map((participant) => [
            participant.playerId,
            participant.state,
          ]),
        );
      },
    };

    await new AuthService(
      recordingRatingService,
    ).previewOfficialDuprAdjustment(
      {
        playerId: "anchor",
        changedByPlayerId: "admin",
        ratings: { doubles: 4 },
        confidence: { doubles: 100 },
      },
      [buildMatch(new Date(NOW.getTime() - 60 * DAY_MS))],
    );

    expect(receivedWeights).toEqual([
      {
        anchor: 0.5,
        partner: 0.5,
        "opponent-a": 0.5,
        "opponent-b": 0.5,
      },
    ]);
  });

  it("미리보기와 확정 반영 결과가 같고 확정 시 공식 레이팅과 confidence를 그대로 저장한다", async () => {
    const service = new AuthService();
    const input = {
      playerId: "anchor",
      changedByPlayerId: "admin",
      ratings: { doubles: 4 },
      confidence: { doubles: 87 },
    };
    const completedMatches = [
      buildMatch(new Date(NOW.getTime() - 30 * DAY_MS)),
    ];

    const preview = await service.previewOfficialDuprAdjustment(
      input,
      completedMatches,
    );
    expect(
      vi.mocked(fetch).mock.calls.every(([, init]) => !init?.method),
    ).toBe(true);

    vi.mocked(fetch).mockClear();
    const applied = await service.applyOfficialDuprAdjustment(
      input,
      completedMatches,
    );
    const appliedNextRatingByPlayerId = new Map(
      applied.ratingChangeLogs.map((log) => [log.playerId, log.nextRating]),
    );

    for (const impact of preview.impacts) {
      expect(appliedNextRatingByPlayerId.get(impact.playerId)).toEqual(
        impact.nextRating,
      );
    }
    expect(persistedDuprStateByPlayerId.get("anchor")).toMatchObject({
      rating: { doubles: 4 },
      metrics: {
        doubles: {
          confidence: 87,
          accuracy: 100,
        },
      },
    });
  });
});
