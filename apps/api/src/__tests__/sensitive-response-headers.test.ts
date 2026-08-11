import request from "supertest";
import type { Player } from "@pkpkdupr/shared/player";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import {
  isPasswordRequest,
  sensitiveResponseHeaders,
} from "../middleware/sensitiveResponseHeaders";
import { MatchRepository } from "../repositories/MatchRepository";
import { AuthService } from "../services/AuthService";
import type { AuthenticatedSession } from "../services/AuthService";

const player: Player = {
  id: "player-001",
  username: "player",
  gender: "M",
  status: "active",
  duprRating: null,
  createdAt: new Date("2026-08-11T00:00:00.000Z"),
  updatedAt: new Date("2026-08-11T00:00:00.000Z"),
};

const adminSession: AuthenticatedSession = {
  payload: { playerId: player.id, isAdmin: true },
  player,
  isFirstLogin: false,
};

describe("sensitive password response headers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["POST", "/api/register"],
    ["POST", "/api/login"],
    ["POST", "/api/change-password"],
    ["POST", "/api/admin/players/player-001/password-reset"],
    ["DELETE", "/api/admin/matches/match-001"],
  ])("marks %s %s as a password request", (method, path) => {
    expect(isPasswordRequest({ method, path })).toBe(true);
  });

  it("does not mark unrelated requests", () => {
    expect(isPasswordRequest({ method: "GET", path: "/api/me" })).toBe(false);
    expect(isPasswordRequest({ method: "POST", path: "/api/matches" })).toBe(
      false,
    );
  });

  it("sets no-store on every password endpoint error response", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue(
      adminSession,
    );
    vi.spyOn(AuthService.prototype, "verifyAdminPassword").mockResolvedValue(
      false,
    );

    const responses = await Promise.all([
      request(app).post("/api/register").send({}),
      request(app).post("/api/login").send({}),
      request(app)
        .post("/api/change-password")
        .set("Authorization", "Bearer admin-token")
        .send({ newPassword: "short" }),
      request(app)
        .post("/api/admin/players/player-001/password-reset")
        .set("Authorization", "Bearer admin-token")
        .send({ password: "short" }),
      request(app)
        .delete("/api/admin/matches/match-001")
        .set("Authorization", "Bearer admin-token")
        .send({ adminPassword: "wrong-password" }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      400, 400, 400, 400, 400,
    ]);
    for (const response of responses) {
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });

  it("sets no-store on every password endpoint success response", async () => {
    vi.spyOn(AuthService.prototype, "register").mockResolvedValue({
      ...player,
      accessToken: "access-token",
      isFirstLogin: false,
      isAdmin: false,
    } as any);
    vi.spyOn(AuthService.prototype, "login").mockResolvedValue({
      accessToken: "access-token",
      isFirstLogin: false,
      isAdmin: false,
    });
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue(
      adminSession,
    );
    vi.spyOn(AuthService.prototype, "changePassword").mockResolvedValue();
    vi.spyOn(AuthService.prototype, "resetPlayerPassword").mockResolvedValue(
      player,
    );
    vi.spyOn(AuthService.prototype, "verifyAdminPassword").mockResolvedValue(
      true,
    );
    vi.spyOn(MatchRepository.prototype, "delete").mockResolvedValue(undefined);
    vi.spyOn(MatchRepository.prototype, "findAll").mockResolvedValue({
      matches: [],
      total: 0,
    });
    vi.spyOn(AuthService.prototype, "recalculateDuprRatings").mockResolvedValue({
      ratingChangeLogs: [],
      perMatchLogs: [],
      changedPlayerCount: 0,
      restoredMatchDuprSnapshotCount: 0,
      restoredMatchDuprSnapshotMatchCount: 0,
      perMatchLogCount: 0,
    });

    const responses = await Promise.all([
      request(app)
        .post("/api/register")
        .send({ username: "player", password: "password", gender: "M" }),
      request(app)
        .post("/api/login")
        .send({ username: "player", password: "password" }),
      request(app)
        .post("/api/change-password")
        .set("Authorization", "Bearer admin-token")
        .send({ currentPassword: "password", newPassword: "next-password" }),
      request(app)
        .post("/api/admin/players/player-001/password-reset")
        .set("Authorization", "Bearer admin-token")
        .send({ password: "next-password" }),
      request(app)
        .delete("/api/admin/matches/match-001")
        .set("Authorization", "Bearer admin-token")
        .send({ adminPassword: "password" }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200, 200,
    ]);
    for (const response of responses) {
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });

  it("calls the next middleware after setting the header", () => {
    const set = vi.fn();
    const next = vi.fn();
    sensitiveResponseHeaders(
      { method: "POST", path: "/api/login" } as any,
      { set } as any,
      next,
    );

    expect(set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(next).toHaveBeenCalledOnce();
  });
});
