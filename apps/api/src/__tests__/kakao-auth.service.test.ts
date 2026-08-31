import { createHash } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KakaoAuthService } from "../services/KakaoAuthService";
import type { AuthService } from "../services/AuthService";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const originalEnvironment = {
  KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY,
  KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET,
  KAKAO_ADMIN_KEY: process.env.KAKAO_ADMIN_KEY,
  KAKAO_REDIRECT_URI: process.env.KAKAO_REDIRECT_URI,
  KAKAO_WEB_ORIGIN: process.env.KAKAO_WEB_ORIGIN,
  KAKAO_MOCK_SUBJECT: process.env.KAKAO_MOCK_SUBJECT,
};

const restoreEnvironment = () => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const accounts = (overrides: Partial<AuthService> = {}) =>
  ({
    issueExternalDeviceSession: vi.fn().mockResolvedValue({
      token: "session-token",
      isPersistent: false,
      expiresAt: new Date("2026-09-08T00:00:00.000Z"),
      isFirstLogin: false,
    }),
    registerExternalPlayer: vi.fn().mockResolvedValue({
      token: "session-token",
      isPersistent: false,
      expiresAt: new Date("2026-09-08T00:00:00.000Z"),
      isFirstLogin: false,
    }),
    ...overrides,
  }) as unknown as AuthService;

describe("KakaoAuthService", () => {
  afterEach(() => {
    restoreEnvironment();
    vi.restoreAllMocks();
  });

  it("mock provider가 state를 저장하고 카카오 식별자만 handoff에 전달한다", async () => {
    process.env.KAKAO_WEB_ORIGIN = "http://localhost:8443";
    process.env.KAKAO_MOCK_SUBJECT = "mock-subject-1";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}));
    const service = new KakaoAuthService(
      "kakao-mock",
      accounts(),
      fetchImpl as unknown as typeof fetch,
    );

    const started = await service.start();
    expect(started.redirectUrl).toBe(
      `/auth/kakao/callback?state=${encodeURIComponent(started.state)}&mock=1`,
    );

    const callbackRedirect = await service.handleCallback({
      state: started.state,
      mock: true,
    });
    expect(callbackRedirect).toMatch(
      /^http:\/\/localhost:8443\/login\/kakao\/callback#ticket=/,
    );

    const createPayload = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      stateHash: string;
      provider: string;
    };
    const callbackPayload = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body)) as {
      stateHash: string;
      providerSubject: string;
      legalName?: string;
    };
    expect(createPayload).toMatchObject({
      provider: "kakao-mock",
      stateHash: sha256(started.state),
    });
    expect(callbackPayload).toMatchObject({
      stateHash: sha256(started.state),
      providerSubject: "mock-subject-1",
    });
    expect(callbackPayload.legalName).toBeUndefined();
  });

  it.each(["OAUTH_STATE_NOT_FOUND", "OAUTH_STATE_INVALID"])(
    "state 불일치·만료·재사용 오류를 callback에서 거부한다: %s",
    async (error) => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error }, 400));
      const service = new KakaoAuthService(
        "kakao-mock",
        accounts(),
        fetchImpl as unknown as typeof fetch,
      );

      await expect(
        service.handleCallback({ state: "invalid-or-expired", mock: true }),
      ).rejects.toThrow(error);
    },
  );

  it("Kakao authorization code를 서버에서 교환해 식별자만 사용한다", async () => {
    process.env.KAKAO_REST_API_KEY = "rest-api-key";
    process.env.KAKAO_CLIENT_SECRET = "client-secret";
    process.env.KAKAO_REDIRECT_URI = "https://pkelo.app/auth/kakao/callback";
    process.env.KAKAO_WEB_ORIGIN = "https://pkelo.app";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "kakao-token" }))
      .mockResolvedValueOnce(jsonResponse({ id: 123456789 }))
      .mockResolvedValueOnce(jsonResponse({}));
    const service = new KakaoAuthService(
      "kakao",
      accounts(),
      fetchImpl as unknown as typeof fetch,
    );

    const redirect = await service.handleCallback({
      state: "state-value",
      code: "authorization-code",
    });

    expect(redirect).toMatch(/^https:\/\/pkelo\.app\/login\/kakao\/callback#ticket=/);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://kauth.kakao.com/oauth/token");
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toContain("code=authorization-code");
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("https://kapi.kakao.com/v2/user/me");
    const dbPayload = JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body)) as {
      providerSubject: string;
      legalName?: string;
    };
    expect(dbPayload.providerSubject).toBe("123456789");
    expect(dbPayload.legalName).toBeUndefined();
  });

  it("기존 identity는 기기 세션을 만들고 신규 identity는 PKELO 프로필 만들기로 보낸다", async () => {
    const existingAccounts = accounts();
    const existingFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        transaction: { provider: "kakao-mock", persistentSessionRequested: true },
        playerId: "Pexisting",
      }),
    );
    const existingService = new KakaoAuthService(
      "kakao-mock",
      existingAccounts,
      existingFetch as unknown as typeof fetch,
    );
    await expect(existingService.exchange("handoff-ticket")).resolves.toEqual({
      status: "authenticated",
      session: expect.objectContaining({ token: "session-token" }),
    });
    expect(existingAccounts.issueExternalDeviceSession).toHaveBeenCalledWith(
      "Pexisting",
      "kakao-mock",
      true,
    );

    const newAccounts = accounts();
    const newService = new KakaoAuthService(
      "kakao-mock",
      newAccounts,
      vi.fn().mockResolvedValue(
        jsonResponse({
          transaction: { provider: "kakao-mock", persistentSessionRequested: false },
          playerId: null,
        }),
      ) as unknown as typeof fetch,
    );
    await expect(newService.exchange("new-handoff-ticket")).resolves.toEqual({
      status: "onboarding",
      registrationTicket: expect.any(String),
    });
    expect(newAccounts.registerExternalPlayer).not.toHaveBeenCalled();
  });

  it("PKELO 프로필 값과 해시된 가입 ticket으로 가입을 완료한다", async () => {
    const registerExternalPlayer = vi.fn().mockResolvedValue({ token: "session-token" });
    const service = new KakaoAuthService(
      "kakao-mock",
      { registerExternalPlayer } as unknown as AuthService,
      vi.fn() as unknown as typeof fetch,
    );

    await service.completeOnboarding({
      registrationTicket: "registration-ticket",
      username: "홍길동",
      gender: "F",
    });

    expect(registerExternalPlayer).toHaveBeenCalledWith({
      registrationTicket: "registration-ticket",
      registrationTicketHash: sha256("registration-ticket"),
      username: "홍길동",
      gender: "F",
      provider: "kakao-mock",
    });
  });

  it("Admin Key와 카카오 회원번호로 앱 연결을 해제한다", async () => {
    process.env.KAKAO_ADMIN_KEY = "admin-key";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 123456789 }));
    const service = new KakaoAuthService(
      "kakao",
      accounts(),
      fetchImpl as unknown as typeof fetch,
    );

    await service.unlinkAccount("kakao", "123456789");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://kapi.kakao.com/v1/user/unlink",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "KakaoAK admin-key" }),
      }),
    );
    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("target_id_type")).toBe("user_id");
    expect(body.get("target_id")).toBe("123456789");
  });

  it.each([
    { status: 403, code: -3, msg: "api activation required" },
    { status: 403, code: -5, msg: "permission denied" },
    { status: 401, code: -401, msg: "invalid admin-key-secret" },
    { status: 400, code: -101, msg: "user 123456789 is not registered" },
  ])(
    "카카오 연결 해제 HTTP 실패를 진단하고 일반화된 오류로 반환한다: $status/$code",
    async ({ status, code, msg }) => {
      process.env.KAKAO_REST_API_KEY = "rest-api-key-secret";
      process.env.KAKAO_CLIENT_SECRET = "client-secret-value";
      process.env.KAKAO_ADMIN_KEY = "admin-key-secret";
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const service = new KakaoAuthService(
        "kakao",
        accounts(),
        vi.fn().mockResolvedValue(jsonResponse({ code, msg }, status)) as unknown as typeof fetch,
      );

      await expect(service.unlinkAccount("kakao", "123456789")).rejects.toMatchObject({
        message: expect.stringContaining("카카오 연결을 해제하지 못했습니다"),
        diagnostic: {
          reason: "http-error",
          httpStatus: status,
          kakaoCode: code,
          kakaoMessage: expect.any(String),
        },
      });
      expect(errorLog).toHaveBeenCalledWith(
        "[KAKAO] Unlink failed",
        expect.objectContaining({
          reason: "http-error",
          httpStatus: status,
          kakaoCode: code,
        }),
      );
      const serializedLog = JSON.stringify(errorLog.mock.calls);
      expect(serializedLog).not.toContain("admin-key-secret");
      expect(serializedLog).not.toContain("rest-api-key-secret");
      expect(serializedLog).not.toContain("client-secret-value");
      expect(serializedLog).not.toContain("123456789");
    },
  );

  it("카카오 연결 해제 네트워크 실패를 응답 실패와 구분한다", async () => {
    process.env.KAKAO_ADMIN_KEY = "admin-key-secret";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = new KakaoAuthService(
      "kakao",
      accounts(),
      vi.fn().mockRejectedValue(new Error("network failed for 123456789")) as unknown as typeof fetch,
    );

    await expect(service.unlinkAccount("kakao", "123456789")).rejects.toMatchObject({
      diagnostic: { reason: "network-error" },
    });
    expect(errorLog).toHaveBeenCalledWith("[KAKAO] Unlink failed", {
      reason: "network-error",
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("123456789");
  });

  it("카카오 연결 해제 성공 응답의 회원번호가 다르면 거부한다", async () => {
    process.env.KAKAO_ADMIN_KEY = "admin-key-secret";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = new KakaoAuthService(
      "kakao",
      accounts(),
      vi.fn().mockResolvedValue(jsonResponse({ id: 987654321 })) as unknown as typeof fetch,
    );

    await expect(service.unlinkAccount("kakao", "123456789")).rejects.toMatchObject({
      diagnostic: { reason: "invalid-response", httpStatus: 200 },
    });
    expect(errorLog).toHaveBeenCalledWith("[KAKAO] Unlink failed", {
      reason: "invalid-response",
      httpStatus: 200,
    });
  });

  it("mock provider 연결 해제는 외부 API를 호출하지 않는다", async () => {
    const fetchImpl = vi.fn();
    const service = new KakaoAuthService(
      "kakao-mock",
      accounts(),
      fetchImpl as unknown as typeof fetch,
    );
    await service.unlinkAccount("kakao-mock", "mock-subject");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
