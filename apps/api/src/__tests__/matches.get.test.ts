import type { Match } from "@pkpkdupr/shared/match";
import type { Player } from "@pkpkdupr/shared/player";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { MatchRepository } from "../repositories/MatchRepository";
import {
  AuthService,
  type AuthenticatedSession,
} from "../services/AuthService";

const now = new Date("2026-07-14T10:00:00.000Z");
const player: Player = {
  id: "player-001",
  username: "player",
  gender: "M",
  status: "active",
  duprRating: null,
  createdAt: now,
  updatedAt: now,
};
const session: AuthenticatedSession = {
  payload: { playerId: player.id, isAdmin: false },
  player,
  isFirstLogin: false,
};
const match: Match = {
  id: "match-001",
  type: "singles",
  mode: "single-game",
  source: "player_created",
  creatorPlayerId: player.id,
  status: "created",
  teams: [
    { id: "team-a", name: "Team A", players: [player] },
    { id: "team-b", name: "Team B", players: [player] },
  ],
  scores: [],
  resultSubmittedByPlayerId: null,
  resultSubmittedAt: null,
  approvals: [],
  location: "Court TBD",
  scheduledAt: now,
  matchStartsAt: now,
  completedAt: null,
  createdAt: now,
  updatedAt: now,
};

describe("GET /api/matches/:matchId", () => {
  beforeEach(() => {
    vi.spyOn(
      AuthService.prototype,
      "authenticateAccessToken",
    ).mockResolvedValue(session);
    vi.spyOn(AuthService.prototype, "initAdmin").mockResolvedValue(player);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("인증된 사용자에게 단건 매치를 반환한다", async () => {
    vi.spyOn(
      MatchRepository.prototype,
      "findByIdWithRatingChanges",
    ).mockResolvedValue({ match, ratingChanges: [] });

    const response = await request(app)
      .get(`/api/matches/${match.id}`)
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: match.id,
      type: "singles",
      ratingChanges: [],
    });
  });

  it("인증 토큰이 없으면 401을 반환한다", async () => {
    const response = await request(app).get(`/api/matches/${match.id}`);

    expect(response.status).toBe(401);
  });

  it("없는 매치는 404를 반환한다", async () => {
    vi.spyOn(
      MatchRepository.prototype,
      "findByIdWithRatingChanges",
    ).mockResolvedValue(undefined);

    const response = await request(app)
      .get("/api/matches/missing-match")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "매치를 찾을 수 없습니다." });
  });
});
