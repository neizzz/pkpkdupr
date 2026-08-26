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
  payload: { playerId: player.id, authProvider: "kakao" },
  player,
  isFirstLogin: false,
};

describe("GET /api/me session contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("유효한 쿠키 세션은 플레이어 정보를 반환한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateDeviceSession").mockResolvedValue(
      session,
    );
    vi.spyOn(
      AuthService.prototype,
      "getCurrentPrivacyPolicyConsent",
    ).mockResolvedValue({
      policyVersion: "2026-08-18",
      agreedAt: new Date("2026-08-18T00:00:00.000Z"),
    });

    const response = await request(app)
      .get("/api/me")
      .set("Cookie", "pkelo_session=valid-session");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: player.id,
      authProvider: "kakao",
      privacyPolicyConsentVersion: "2026-08-18",
    });
  });

  it("실제 무효 세션만 SESSION_INVALID와 함께 401을 반환한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateDeviceSession").mockRejectedValue(
      new InvalidAccessTokenError("유효하지 않거나 만료된 토큰입니다."),
    );

    const response = await request(app)
      .get("/api/me")
      .set("Cookie", "pkelo_session=expired-session");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "세션이 만료되었거나 유효하지 않습니다.",
      code: "SESSION_INVALID",
    });
  });

  it("저장소 장애는 SESSION_UNAVAILABLE과 함께 503을 반환한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateDeviceSession").mockRejectedValue(
      new Error("DB 서버 요청 실패: 503"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(app)
      .get("/api/me")
      .set("Cookie", "pkelo_session=valid-session");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: "세션을 일시적으로 확인하지 못했습니다.",
      code: "SESSION_UNAVAILABLE",
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("사용자 Bearer JWT는 SESSION_INVALID로 거부한다", async () => {
    const response = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer legacy-user-jwt");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("SESSION_INVALID");
  });
});

describe("GET /api/auth/session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("쿠키가 없으면 401 대신 anonymous bootstrap을 반환한다", async () => {
    const response = await request(app).get("/api/auth/session");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: false });
  });

  it("유효한 쿠키는 현재 사용자 정보를 포함한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateDeviceSession").mockResolvedValue(session);
    vi.spyOn(AuthService.prototype, "getCurrentPrivacyPolicyConsent").mockResolvedValue({
      policyVersion: "2026-08-26",
      agreedAt: new Date("2026-08-26T00:00:00.000Z"),
    });

    const response = await request(app)
      .get("/api/auth/session")
      .set("Cookie", "pkelo_session=valid-session");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      authenticated: true,
      player: {
        id: player.id,
        privacyPolicyConsentVersion: "2026-08-26",
      },
    });
  });
});
