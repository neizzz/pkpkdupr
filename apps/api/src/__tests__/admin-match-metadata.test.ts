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

const now = new Date("2026-07-23T10:00:00.000Z");
const admin: Player = {
  id: "admin-001",
  username: "admin",
  gender: "M",
  status: "active",
  duprRating: null,
  createdAt: now,
  updatedAt: now,
};
const adminSession: AuthenticatedSession = {
  payload: { playerId: admin.id, isAdmin: true, rememberMe: true },
  player: admin,
  isFirstLogin: false,
  refreshedAccessToken: "refreshed-admin-token",
};

const buildMatch = (id: string): Match => ({
  id,
  type: "singles",
  mode: "single-game",
  source: "admin_created",
  creatorPlayerId: admin.id,
  status: "created",
  teams: [
    { id: `${id}-team-a`, name: "Team A", players: [admin] },
    { id: `${id}-team-b`, name: "Team B", players: [admin] },
  ],
  scores: [],
  resultSubmittedByPlayerId: null,
  resultSubmittedAt: null,
  approvals: [],
  location: "PKELO Court A",
  matchStartsAt: now,
  completedAt: null,
  createdAt: now,
  updatedAt: now,
});

describe("admin match metadata", () => {
  beforeEach(() => {
    vi.spyOn(
      AuthService.prototype,
      "authenticateAccessToken",
    ).mockResolvedValue(adminSession);
    vi.spyOn(AuthService.prototype, "initAdmin").mockResolvedValue(admin);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("선택한 매치의 세션 정보를 하나의 관리자 요청으로 일괄 변경한다", async () => {
    const updateMetadata = vi
      .spyOn(MatchRepository.prototype, "updateMetadata")
      .mockImplementation(async (matchId, input) => ({
        ...buildMatch(matchId),
        session:
          input.sessionName && input.sessionDate && input.sessionLocation
            ? {
                id: "session-001",
                name: input.sessionName,
                date: new Date(input.sessionDate),
                location: input.sessionLocation,
              }
            : undefined,
      }));

    const response = await request(app)
      .patch("/api/admin/matches/bulk-metadata")
      .set("Authorization", "Bearer admin-token")
      .send({
        matchIds: ["match-001", "match-002", "match-001"],
        sessionName: "수요일 저녁 세션",
        sessionDate: "2026-07-23T10:00:00.000Z",
        sessionLocation: "PKELO Court A",
      });

    expect(response.status).toBe(200);
    expect(response.body.matches).toHaveLength(2);
    expect(updateMetadata).toHaveBeenNthCalledWith(1, "match-001", {
      sessionName: "수요일 저녁 세션",
      sessionDate: "2026-07-23T10:00:00.000Z",
      sessionLocation: "PKELO Court A",
    });
    expect(updateMetadata).toHaveBeenNthCalledWith(2, "match-002", {
      sessionName: "수요일 저녁 세션",
      sessionDate: "2026-07-23T10:00:00.000Z",
      sessionLocation: "PKELO Court A",
    });
  });

  it("관리자 세션 조회 시 권한과 갱신 토큰을 함께 반환한다", async () => {
    const response = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: admin.id,
      isAdmin: true,
      accessToken: "refreshed-admin-token",
    });
  });
});
