import type { ClubMember, ClubMembership } from "@pkpkdupr/shared/club";
import type { Player } from "@pkpkdupr/shared/player";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { ClubRepository } from "../repositories/ClubRepository";
import { MatchRepository } from "../repositories/MatchRepository";
import {
  AuthService,
  type AuthenticatedSession,
} from "../services/AuthService";

const now = new Date("2026-07-21T10:00:00.000Z");
const clubId = "Cclub001";
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
const clubMembership: ClubMembership = {
  clubId,
  playerId: player.id,
  role: "member",
  status: "active",
  requestedAt: now,
  joinedAt: now,
};
const clubMember: ClubMember = {
  id: player.id,
  username: player.username,
  gender: player.gender,
  role: "member",
  joinedAt: now,
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

  it("완료된 경기의 최신 경기 시간을 멤버별로 포함한다", async () => {
    const lastPlayedAt = new Date("2026-07-20T08:30:00.000Z");
    vi.spyOn(AuthService.prototype, "getPublicPlayers").mockResolvedValue([
      player,
      playerWithoutCompletedMatch,
    ]);
    vi.spyOn(
      MatchRepository.prototype,
      "getLastPlayedAtByPlayerId",
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

  it("가입한 클럽의 활성 멤버만 반환한다", async () => {
    vi.spyOn(ClubRepository.prototype, "findMembership").mockResolvedValue(
      clubMembership,
    );
    vi.spyOn(ClubRepository.prototype, "listMembers").mockResolvedValue([
      clubMember,
    ]);
    vi.spyOn(AuthService.prototype, "getPublicPlayers").mockResolvedValue([
      player,
      playerWithoutCompletedMatch,
    ]);
    vi.spyOn(
      MatchRepository.prototype,
      "getLastPlayedAtByPlayerId",
    ).mockResolvedValue({});

    const response = await request(app)
      .get(`/api/players?clubId=${clubId}`)
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ id: player.id, lastPlayedAt: null }),
    ]);
  });

  it("가입하지 않은 클럽의 플레이어 조회를 거부한다", async () => {
    vi.spyOn(ClubRepository.prototype, "findMembership").mockResolvedValue(
      undefined,
    );
    const listMembers = vi.spyOn(ClubRepository.prototype, "listMembers");

    const response = await request(app)
      .get(`/api/players?clubId=${clubId}`)
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(403);
    expect(listMembers).not.toHaveBeenCalled();
  });
});
