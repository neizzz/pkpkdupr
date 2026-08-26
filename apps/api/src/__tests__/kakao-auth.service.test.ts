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
  KAKAO_REDIRECT_URI: process.env.KAKAO_REDIRECT_URI,
  KAKAO_WEB_ORIGIN: process.env.KAKAO_WEB_ORIGIN,
  KAKAO_MOCK_SUBJECT: process.env.KAKAO_MOCK_SUBJECT,
  KAKAO_CONFIDENTIAL_USER_INFO_APPROVED:
    process.env.KAKAO_CONFIDENTIAL_USER_INFO_APPROVED,
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

  it("mock provider가 state를 저장하고 callback handoff ticket을 발급한다", async () => {
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

    const createPayload = JSON.parse(
      String(fetchImpl.mock.calls[0]?.[1]?.body),
    ) as { stateHash: string; provider: string };
    const callbackPayload = JSON.parse(
      String(fetchImpl.mock.calls[1]?.[1]?.body),
    ) as { stateHash: string; providerSubject: string };
    expect(createPayload).toMatchObject({
      provider: "kakao-mock",
      stateHash: sha256(started.state),
    });
    expect(callbackPayload).toMatchObject({
      stateHash: sha256(started.state),
      providerSubject: "mock-subject-1",
      legalName: "카카오 테스트 사용자",
    });
  });

  it.each(["OAUTH_STATE_NOT_FOUND", "OAUTH_STATE_INVALID"])(
    "state 불일치·만료·재사용 오류를 callback에서 거부한다: %s",
    async (error) => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse({ error }, 400),
      );
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

  it("신규 가입에 필요한 본인확인정보가 없으면 원인을 안내한다", async () => {
    const service = new KakaoAuthService(
      "kakao-mock",
      accounts(),
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: "OAUTH_VERIFIED_PROFILE_REQUIRED" }, 400)) as unknown as typeof fetch,
    );

    await expect(service.exchange("handoff-ticket")).rejects.toThrow(
      "카카오 본인확인정보(법정 실명·성별·생년월일)를 받지 못했습니다",
    );
  });

  it("Kakao authorization code를 서버에서 교환해 subject를 사용한다", async () => {
    process.env.KAKAO_REST_API_KEY = "rest-api-key";
    process.env.KAKAO_CLIENT_SECRET = "client-secret";
    process.env.KAKAO_REDIRECT_URI = "https://pkelo.app/auth/kakao/callback";
    process.env.KAKAO_WEB_ORIGIN = "https://pkelo.app";
    process.env.KAKAO_CONFIDENTIAL_USER_INFO_APPROVED = "true";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "kakao-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 123456789,
          kakao_account: {
            legal_name: "홍길동",
            legal_gender: "male",
            legal_birth_date: "19900825",
          },
        }),
      )
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
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://kauth.kakao.com/oauth/token",
    );
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toContain(
      "code=authorization-code",
    );
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      "https://kapi.kakao.com/v2/user/me",
    );
    const dbPayload = JSON.parse(
      String(fetchImpl.mock.calls[2]?.[1]?.body),
    ) as { providerSubject: string };
    expect(dbPayload.providerSubject).toBe("123456789");
  });

  it("기존 identity는 기기 세션을 만들고 신규 identity는 검증정보로 자동 가입한다", async () => {
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

    const newFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        transaction: {
          provider: "kakao-mock",
          persistentSessionRequested: false,
          legalName: "신규 사용자",
          legalGender: "F",
          legalBirthDate: "1990-08-25",
        },
        playerId: null,
      }),
    );
    const newAccounts = accounts();
    const automaticService = new KakaoAuthService(
      "kakao-mock",
      newAccounts,
      newFetch as unknown as typeof fetch,
    );
    await expect(automaticService.exchange("new-handoff-ticket")).resolves.toEqual({
      status: "authenticated",
      session: expect.objectContaining({ token: "session-token" }),
    });
    expect(newAccounts.registerExternalPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "신규 사용자",
        gender: "F",
        birthDate: "1990-08-25",
        provider: "kakao-mock",
      }),
    );
  });

  it("신규 가입은 원문 handoff ticket 대신 해시와 카카오 검증 프로필만 전달한다", async () => {
    const registerExternalPlayer = vi.fn().mockResolvedValue({
      accessToken: "onboarded-access-token",
      isFirstLogin: false,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        transaction: {
          provider: "kakao-mock",
          persistentSessionRequested: false,
          legalName: "홍길동",
          legalGender: "F",
          legalBirthDate: "1990-08-25",
        },
        playerId: null,
      }),
    );
    const service = new KakaoAuthService(
      "kakao-mock",
      {
        issueExternalDeviceSession: vi.fn(),
        registerExternalPlayer,
      } as unknown as AuthService,
      fetchImpl as unknown as typeof fetch,
    );

    await service.exchange("handoff-ticket");

    expect(registerExternalPlayer).toHaveBeenCalledWith(expect.objectContaining({
      gender: "F",
      birthDate: "1990-08-25",
      provider: "kakao-mock",
      registrationTicketHash: expect.any(String),
    }));
  });
});
