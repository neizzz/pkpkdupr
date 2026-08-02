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
};

const restoreEnvironment = () => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const accounts = (overrides: Partial<AuthService> = {}) =>
  ({
    issueExternalAccessToken: vi.fn().mockResolvedValue({
      accessToken: "kakao-access-token",
      isFirstLogin: false,
    }),
    registerExternalPlayer: vi.fn().mockResolvedValue({
      accessToken: "onboarded-access-token",
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
    process.env.KAKAO_WEB_ORIGIN = "http://pkelo.localhost:8081";
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
      /^http:\/\/pkelo\.localhost:8081\/login\/kakao\/callback#ticket=/,
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

  it("Kakao authorization code를 서버에서 교환해 subject를 사용한다", async () => {
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

  it("기존 identity는 JWT를 반환하고 새 identity는 onboarding ticket으로 분기한다", async () => {
    const existingAccounts = accounts();
    const existingFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        transaction: { provider: "kakao-mock" },
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
      accessToken: "kakao-access-token",
      isFirstLogin: false,
    });
    expect(existingAccounts.issueExternalAccessToken).toHaveBeenCalledWith(
      "Pexisting",
      "kakao-mock",
    );

    const newFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        transaction: { provider: "kakao-mock" },
        playerId: null,
      }),
    );
    const newService = new KakaoAuthService(
      "kakao-mock",
      accounts(),
      newFetch as unknown as typeof fetch,
    );
    const result = await newService.exchange("new-handoff-ticket");
    expect(result.status).toBe("onboarding");
    if (result.status === "onboarding") {
      expect(result.registrationTicket).toBeTruthy();
      const payload = JSON.parse(
        String(newFetch.mock.calls[0]?.[1]?.body),
      ) as { handoffHash: string; registrationHash: string };
      expect(payload.handoffHash).toBe(sha256("new-handoff-ticket"));
      expect(payload.registrationHash).toBe(sha256(result.registrationTicket));
    }
  });

  it("onboarding은 원문 ticket 대신 해시와 사용자 프로필만 계정 저장소에 전달한다", async () => {
    const registerExternalPlayer = vi.fn().mockResolvedValue({
      accessToken: "onboarded-access-token",
      isFirstLogin: false,
    });
    const service = new KakaoAuthService(
      "kakao-mock",
      {
        issueExternalAccessToken: vi.fn(),
        registerExternalPlayer,
      } as unknown as AuthService,
      vi.fn() as unknown as typeof fetch,
    );

    await service.completeOnboarding({
      registrationTicket: "registration-ticket",
      username: "same-username-can-exist-in-other-domain",
      gender: "F",
    });

    expect(registerExternalPlayer).toHaveBeenCalledWith({
      registrationTicket: "registration-ticket",
      registrationTicketHash: sha256("registration-ticket"),
      username: "same-username-can-exist-in-other-domain",
      gender: "F",
      provider: "kakao-mock",
    });
  });
});
