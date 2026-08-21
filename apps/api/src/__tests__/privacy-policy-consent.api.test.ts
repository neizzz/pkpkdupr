import type { Player } from "@pkpkdupr/shared/player";
import { PRIVACY_POLICY_VERSION } from "@pkpkdupr/shared/privacyPolicy";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import {
  AuthService,
  InvalidAccessTokenError,
  type AuthenticatedSession,
} from "../services/AuthService";

const player: Player = {
  id: "Pprivacy",
  username: "privacy-player",
  gender: "F",
  status: "active",
  duprRating: null,
  createdAt: new Date("2026-08-18T00:00:00.000Z"),
  updatedAt: new Date("2026-08-18T00:00:00.000Z"),
};

const session: AuthenticatedSession = {
  payload: { playerId: player.id, authProvider: "kakao" },
  player,
  isFirstLogin: false,
};

describe("POST /api/me/privacy-policy-consent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("인증되지 않은 요청은 거부한다", async () => {
    const response = await request(app).post("/api/me/privacy-policy-consent");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("SESSION_INVALID");
  });

  it("현재 방침 버전의 동의를 계정에 기록한다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockResolvedValue(
      session,
    );
    const recordConsent = vi.spyOn(
      AuthService.prototype,
      "recordCurrentPrivacyPolicyConsent",
    ).mockResolvedValue({
      policyVersion: PRIVACY_POLICY_VERSION,
      agreedAt: new Date("2026-08-18T01:00:00.000Z"),
    });

    const response = await request(app)
      .post("/api/me/privacy-policy-consent")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(201);
    expect(recordConsent).toHaveBeenCalledWith(player.id);
    expect(response.body).toMatchObject({
      privacyPolicyConsentVersion: PRIVACY_POLICY_VERSION,
      privacyPolicyConsentAgreedAt: "2026-08-18T01:00:00.000Z",
    });
  });

  it("무효 세션은 기록하지 않는다", async () => {
    vi.spyOn(AuthService.prototype, "authenticateAccessToken").mockRejectedValue(
      new InvalidAccessTokenError("유효하지 않은 세션"),
    );
    const recordConsent = vi.spyOn(
      AuthService.prototype,
      "recordCurrentPrivacyPolicyConsent",
    );

    const response = await request(app)
      .post("/api/me/privacy-policy-consent")
      .set("Authorization", "Bearer expired-token");

    expect(response.status).toBe(401);
    expect(recordConsent).not.toHaveBeenCalled();
  });
});
