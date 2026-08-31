import type { Player, WithdrawalEligibility } from "@pkpkdupr/shared/player";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { AuthService, type AuthenticatedSession } from "../services/AuthService";

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  VITEST: process.env.VITEST,
  USER_AUTH_PROVIDER: process.env.USER_AUTH_PROVIDER,
  KAKAO_ADMIN_KEY: process.env.KAKAO_ADMIN_KEY,
};

const restoreEnvironment = () => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const player: Player = {
  id: "Pwithdrawal",
  username: "탈퇴 테스트",
  gender: "F",
  status: "active",
  duprRating: null,
  createdAt: new Date("2026-08-31T00:00:00.000Z"),
  updatedAt: new Date("2026-08-31T00:00:00.000Z"),
};

const session: AuthenticatedSession = {
  payload: { playerId: player.id, authProvider: "password" },
  player,
  isFirstLogin: false,
};

const eligible: WithdrawalEligibility = {
  eligible: true,
  blockers: { ownedClubs: [], activeMatches: [], upcomingSessions: [] },
};

const authenticated = () =>
  vi.spyOn(AuthService.prototype, "authenticateDeviceSession").mockResolvedValue(session);

describe("회원 탈퇴 API", () => {
  afterEach(() => {
    restoreEnvironment();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("탈퇴 가능 여부와 blocker 목록을 반환한다", async () => {
    authenticated();
    vi.spyOn(AuthService.prototype, "getWithdrawalEligibility").mockResolvedValue(eligible);
    const response = await request(app)
      .get("/api/me/withdrawal-eligibility")
      .set("Cookie", "pkelo_session=test-session");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(eligible);
  });

  it("확인 문구가 다르면 탈퇴를 준비하지 않는다", async () => {
    authenticated();
    const prepare = vi.spyOn(AuthService.prototype, "prepareWithdrawal");
    const response = await request(app)
      .post("/api/me/withdrawal")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ confirmation: "삭제" });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("WITHDRAWAL_CONFIRMATION_INVALID");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("blocker가 생기면 409로 중단한다", async () => {
    authenticated();
    vi.spyOn(AuthService.prototype, "prepareWithdrawal").mockRejectedValue(
      new Error("WITHDRAWAL_BLOCKED"),
    );
    const response = await request(app)
      .post("/api/me/withdrawal")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ confirmation: "탈퇴" });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("WITHDRAWAL_BLOCKED");
  });

  it("비밀번호 계정은 외부 해제 없이 익명화를 완료하고 쿠키를 지운다", async () => {
    authenticated();
    vi.spyOn(AuthService.prototype, "prepareWithdrawal").mockResolvedValue({
      id: "withdrawal-1",
      playerId: player.id,
      provider: null,
      providerSubject: null,
      status: "unlink_succeeded",
      avatarUrl: null,
    });
    const complete = vi
      .spyOn(AuthService.prototype, "completeWithdrawal")
      .mockResolvedValue();
    const response = await request(app)
      .post("/api/me/withdrawal")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ confirmation: "탈퇴" });
    expect(response.status).toBe(204);
    expect(complete).toHaveBeenCalledWith("withdrawal-1", player.id);
    expect(String(response.headers["set-cookie"])).toContain("pkelo_session=");
  });

  it("같은 사용자의 중복 탈퇴 요청을 처리 중 상태로 거부한다", async () => {
    authenticated();
    vi.spyOn(AuthService.prototype, "prepareWithdrawal").mockResolvedValue({
      id: "withdrawal-duplicate",
      playerId: player.id,
      provider: null,
      providerSubject: null,
      status: "unlink_succeeded",
      avatarUrl: null,
    });
    let releaseComplete: (() => void) | undefined;
    vi.spyOn(AuthService.prototype, "completeWithdrawal").mockImplementation(
      () => new Promise<void>((resolve) => { releaseComplete = resolve; }),
    );

    const postWithdrawal = () => request(app)
      .post("/api/me/withdrawal")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ confirmation: "탈퇴" });
    const firstResponse = postWithdrawal().then((response) => response);
    await vi.waitFor(() => expect(releaseComplete).toBeDefined());
    const duplicateResponse = await postWithdrawal();
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.code).toBe("WITHDRAWAL_IN_PROGRESS");
    releaseComplete?.();
    expect((await firstResponse).status).toBe(204);
  });

  it("카카오 해제 성공 후 로컬 상태 저장 실패를 외부 해제 실패로 표시하지 않는다", async () => {
    process.env.NODE_ENV = "development";
    process.env.VITEST = "true";
    process.env.USER_AUTH_PROVIDER = "kakao";
    process.env.KAKAO_ADMIN_KEY = "admin-key";
    vi.resetModules();

    const { AuthService: KakaoAuthAccountService } = await import(
      "../services/AuthService"
    );
    const { KakaoAuthService } = await import("../services/KakaoAuthService");
    vi.spyOn(
      KakaoAuthAccountService.prototype,
      "authenticateDeviceSession",
    ).mockResolvedValue({
      ...session,
      payload: { playerId: player.id, authProvider: "kakao" },
    });
    vi.spyOn(KakaoAuthAccountService.prototype, "prepareWithdrawal").mockResolvedValue({
      id: "withdrawal-kakao-state-failure",
      playerId: player.id,
      provider: "kakao",
      providerSubject: "123456789",
      status: "prepared",
      avatarUrl: null,
    });
    vi.spyOn(KakaoAuthService.prototype, "unlinkAccount").mockResolvedValue();
    vi.spyOn(
      KakaoAuthAccountService.prototype,
      "markWithdrawalUnlinkResult",
    ).mockRejectedValue(new Error("DB state update failed"));
    const complete = vi.spyOn(
      KakaoAuthAccountService.prototype,
      "completeWithdrawal",
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { app: kakaoApp } = await import("../index");

    const response = await request(kakaoApp)
      .post("/api/me/withdrawal")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ confirmation: "탈퇴" });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("WITHDRAWAL_UNAVAILABLE");
    expect(response.body.code).not.toBe("KAKAO_UNLINK_FAILED");
    expect(complete).not.toHaveBeenCalled();
  });

  it("카카오 연결 해제 실패 시 개인정보 처리를 시작하지 않는다", async () => {
    process.env.NODE_ENV = "development";
    process.env.VITEST = "true";
    process.env.USER_AUTH_PROVIDER = "kakao";
    process.env.KAKAO_ADMIN_KEY = "admin-key";
    vi.resetModules();

    const { AuthService: KakaoAuthAccountService } = await import(
      "../services/AuthService"
    );
    const { KakaoAuthService, KakaoUnlinkError } = await import(
      "../services/KakaoAuthService"
    );
    vi.spyOn(
      KakaoAuthAccountService.prototype,
      "authenticateDeviceSession",
    ).mockResolvedValue({
      ...session,
      payload: { playerId: player.id, authProvider: "kakao" },
    });
    vi.spyOn(KakaoAuthAccountService.prototype, "prepareWithdrawal").mockResolvedValue({
      id: "withdrawal-kakao-unlink-failure",
      playerId: player.id,
      provider: "kakao",
      providerSubject: "123456789",
      status: "prepared",
      avatarUrl: null,
    });
    vi.spyOn(KakaoAuthService.prototype, "unlinkAccount").mockRejectedValue(
      new KakaoUnlinkError({
        reason: "http-error",
        httpStatus: 403,
        kakaoCode: -5,
      }),
    );
    const markResult = vi
      .spyOn(KakaoAuthAccountService.prototype, "markWithdrawalUnlinkResult")
      .mockResolvedValue();
    const complete = vi.spyOn(
      KakaoAuthAccountService.prototype,
      "completeWithdrawal",
    );
    const { app: kakaoApp } = await import("../index");

    const response = await request(kakaoApp)
      .post("/api/me/withdrawal")
      .set("Cookie", "pkelo_session=test-session")
      .set("Origin", "http://localhost:8080")
      .send({ confirmation: "탈퇴" });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: "카카오 연결을 해제하지 못했습니다. 잠시 후 다시 시도해주세요.",
      code: "KAKAO_UNLINK_FAILED",
    });
    expect(markResult).toHaveBeenCalledWith(
      "withdrawal-kakao-unlink-failure",
      false,
      "KAKAO_UNLINK_FAILED",
    );
    expect(complete).not.toHaveBeenCalled();
  });
});
