import type { Player } from "@pkpkdupr/shared/player";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { MatchRepository } from "../repositories/MatchRepository";
import {
  AuthService,
  type AuthenticatedSession,
} from "../services/AuthService";

const now = new Date("2026-07-21T10:00:00.000Z");
const player: Player = {
  id: "player-001",
  username: "player",
  gender: "M",
  status: "active",
  duprRating: { singles: 3.1, doubles: 3.2 },
  createdAt: now,
  updatedAt: now,
};
const playerWithoutCompletedMatch: Player = {
  ...player,
  id: "player-002",
  username: "no-match-player",
};
const session: AuthenticatedSession = {
  payload: { playerId: player.id, isAdmin: false },
  player,
  isFirstLogin: false,
};

describe("GET /api/players", () => {
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

  it("완료 경기의 최신 시각을 멤버별로 포함한다", async () => {
    const lastPlayedAt = new Date("2026-07-20T10:00:00.000Z");
    vi.spyOn(AuthService.prototype, "getPublicPlayers").mockResolvedValue([
      player,
      playerWithoutCompletedMatch,
    ]);
    vi.spyOn(
      MatchRepository.prototype,
      "getLastCompletedAtByPlayerId",
    ).mockResolvedValue({ [player.id]: lastPlayedAt });

    const response = await request(app)
      .get("/api/players")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        id: player.id,
        lastPlayedAt: lastPlayedAt.toISOString(),
      }),
      expect.objectContaining({
        id: playerWithoutCompletedMatch.id,
        lastPlayedAt: null,
      }),
    ]);
  });
});
