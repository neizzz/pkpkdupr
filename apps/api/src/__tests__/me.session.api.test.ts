import type { Player } from "@pkpkdupr/shared/player";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import {
  AuthService,
  InvalidAccessTokenError,
  type AuthenticatedSession,
} from "../services/AuthService";

const player: Player = {
  id: "Psession",
  username: "session-player",
  gender: "F",
  status: "active",
  duprRating: null,
  createdAt: new Date("2026-08-04T00:00:00.000Z"),
  updatedAt: new Date("2026-08-04T00:00:00.000Z"),
};

const session: AuthenticatedSession = {
  payload: { playerId: player.id },
  player,
  isFirstLogin: false,
  refreshedAccessToken: "refreshed-token",
};

describe("GET /api/me session contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("유효한 세션은 플레이어 정보와 갱신 토큰을 반환한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue(
      session,
    );

    const response = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: player.id,
      accessToken: "refreshed-token",
    });
  });

  it("실제 무효 세션만 SESSION_INVALID와 함께 401을 반환한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockRejectedValue(
      new InvalidAccessTokenError("유효하지 않거나 만료된 토큰입니다."),
    );

    const response = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer expired-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "세션이 만료되었거나 유효하지 않습니다.",
      code: "SESSION_INVALID",
    });
  });

  it("저장소 장애는 SESSION_UNAVAILABLE과 함께 503을 반환한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockRejectedValue(
      new Error("DB 서버 요청 실패: 503"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: "세션을 일시적으로 확인하지 못했습니다.",
      code: "SESSION_UNAVAILABLE",
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});
